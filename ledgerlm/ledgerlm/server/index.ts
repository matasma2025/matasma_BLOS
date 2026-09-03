import 'dotenv/config'; // Load .env file before anything else
import crypto from 'crypto';
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from "pg";
const { Pool } = pkg;
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { logger } from "./logger";
import { seedDatabase } from "./seed";
import { startPythonBackend } from "./python-backend";
import { scheduler } from "./services/scheduler";
import { multiTenantScheduler } from "./services/multiTenantScheduler";
import { createSchedulerConfig } from "./migrations/create-scheduler-config";
import { runDomainEnhancementsMigration } from "./migrations/domain-enhancements";
import { createKioskTables } from "./migrations/create-kiosk-tables";
import { addBillingTypeColumn } from "./migrations/add-billing-type-column";
import { createKioskFaqEntriesTable } from "./migrations/create-kiosk-faq-entries";
import { addDomainAnaplanCredentials } from "./migrations/add-domain-anaplan-credentials";
import { createDomainApiConnectorsTable } from "./migrations/create-domain-api-connectors";
import { createAzureBlobRegistryTable, dropAzureBlobConnectorUniqueConstraint } from "./migrations/create-azure-blob-registry";
import { runConnectorPreferencesMigration } from "./migrations/add-connector-preferences";
import { addCubeIdToChunks } from "./migrations/add-cube-id-to-chunks";
import { addTargetCubeToSchedulerConfig } from "./migrations/add-target-cube-to-scheduler";
import { createCubeMetadataTable } from "./migrations/create-cube-metadata";
import { runSemanticSqlMigration } from "./migrations/create-semantic-sql-tables";
import { runSchemaConfigMigration } from "./migrations/create-schema-config-tables";
import { createIngestionJobsTable } from "./migrations/create-ingestion-jobs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { createBusinessLogicTables } from "./migrations/create-business-logic-tables";
import { getEntraToken } from "./utils/entraToken";
import { addSsoColumnsToDomains } from "./migrations/add-sso-columns";
import { addSsoGroupColumnsToDomains } from "./migrations/add-sso-group-columns";
import { addEmailConfigColumnsToDomains } from "./migrations/add-email-config-columns";
import { addAiConfigColumnsToDomains } from "./migrations/add-ai-config-columns";
import { fixAzureBlobConnectorSchedules } from "./migrations/fix-azure-blob-connector-schedules";
import { addCustomerColumns } from "./migrations/add-customer-columns";
import { createAuditLogTable } from "./migrations/create-audit-log";
import { createRetentionPoliciesTable } from "./migrations/create-retention-policies";
import { runInvestmentTablesMigration } from "./migrations/create-investment-tables";
import { addSsoGroupMappings } from "./migrations/add-sso-group-mappings";
import { createBoardReportsTable } from "./migrations/create-board-reports";
import { addVarianceDataColumn } from "./migrations/add-variance-data-column";
import { runRetentionEngine } from "./services/retentionEngine";
import { runBackup } from "./services/backupService";
import { startSsoSyncJob } from "./services/ssoSyncJob";
import rateLimit from "express-rate-limit";

const app = express();

// Trust Replit's reverse proxy so express-rate-limit reads X-Forwarded-For correctly
app.set('trust proxy', 1);

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(helmet({
  // Allow inline styles/scripts needed by Vite dev HMR + React
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  } : false,   // Disabled in dev — Vite HMR needs relaxed CSP
  crossOriginEmbedderPolicy: false,  // Required for PDF rendering
  frameguard: process.env.NODE_ENV === 'production' ? { action: 'sameorigin' } : false, // Dev: allow Replit preview iframe
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no Origin header)
    if (!origin) {
      return callback(null, true);
    }
    // If no allowed origins configured, deny all cross-origin requests
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-csrf-token'],
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration_ms = Date.now() - start;
    if (path.startsWith("/api")) {
      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "unknown";

      logger.info({
        method: req.method,
        path,
        status: res.statusCode,
        duration_ms,
        ip,
      });

      // Keep dev-friendly text log for terminal readability
      if (process.env.NODE_ENV === "development") {
        log(`${req.method} ${path} ${res.statusCode} in ${duration_ms}ms`);
      }
    }
  });

  next();
});

// Session middleware with PostgreSQL store
const PgSession = connectPgSimple(session);

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

// ── Session pool — mirrors the auth-mode logic in db.ts ──────────────────────
const _sessionAuthMode = (process.env.DB_AUTH_MODE || '').toLowerCase();
let sessionPool: Pool;

// DB_TLS_REJECT_UNAUTHORIZED=false must be set explicitly in Azure private VNet
// environments where the PostgreSQL cert is signed by a private CA.
const _dbTlsRejectUnauthorized = process.env.DB_TLS_REJECT_UNAUTHORIZED !== 'false';

if (_sessionAuthMode === 'entra' || _sessionAuthMode === 'hybrid') {
  sessionPool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: 5432,
    password: () => getEntraToken(),
    ssl: { rejectUnauthorized: _dbTlsRejectUnauthorized },
  });
} else if (_sessionAuthMode === 'postgres-azure') {
  sessionPool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: 5432,
    ssl: { rejectUnauthorized: _dbTlsRejectUnauthorized },
  });
} else {
  // Default: Neon / local (unchanged)
  const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("NEON_DATABASE_URL environment variable is required");
  }
  const isLocalDb =
    dbUrl.includes('localhost') ||
    dbUrl.includes('ledgerlm-db') ||
    dbUrl.includes('172.17.') ||
    dbUrl.includes('127.0.0.1');
  sessionPool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalDb ? false : { rejectUnauthorized: _dbTlsRejectUnauthorized },
  });
}

app.use(session({
  store: new PgSession({
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  rolling: true,               // SG-39/84: reset 15-min timer on every request (inactivity timeout)
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,  // 15 minutes — Bosch SG-39 / SG-84 requirement
  },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute.' },
  // Security: OTP endpoints must NOT be exempt from rate limiting — the
  // hardcoded skip was the only thing separating the 6-digit space from
  // a brute-force attack. The OTP service's own MAX_OTP_ATTEMPTS=5 per-token
  // counter and the global 100 req/min limiter provide the correct controls.
  // (SAST Finding 3)
});

const chatApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI queries, please wait before sending more.' },
});

const uploadApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many file uploads, please wait 15 minutes.' },
});

app.use('/api/', globalApiLimiter);
app.use('/api/chats', chatApiLimiter);
// Only rate-limit uploads (POST), never reads — GET /api/documents must always work
app.use('/api/documents', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  return uploadApiLimiter(req, res, next);
});

// ── SG-35: Geo-fencing (India only) ──────────────────────────────────────────
// Azure Application Gateway / WAF sets X-Country-Code on each request once the
// geo-filter WAF rule is configured (see SG-35 Azure setup guide).
// Until that header arrives this middleware is a no-op — it does NOT block anyone.
// When WAF is live and starts sending the header, non-IN requests get 403 here as
// a defence-in-depth layer behind the gateway-level block.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'production') return next(); // Skip in dev
  // Static assets and health checks are always allowed
  if (!req.path.startsWith('/api')) return next();
  const countryCode = (req.headers['x-country-code'] as string | undefined)?.toUpperCase();
  if (countryCode && countryCode !== 'IN') {
    logger.warn({ ip: req.ip, country: countryCode, path: req.path }, 'SG-35 geo-fence: access denied outside IN');
    return res.status(403).json({ error: 'Access restricted to authorized regions.' });
  }
  // Header absent → WAF not yet configured; pass through
  next();
});

// ── SG-41: CSRF Token Protection ─────────────────────────────────────────────
// Synchronizer Token Pattern (OWASP recommended).
// GET /api/auth/csrf-token issues a per-session token.
// All state-changing requests (POST/PUT/PATCH/DELETE) must echo it back
// in the x-csrf-token header. Mismatch → 403.
// Public auth endpoints are exempt because the user has no session yet.
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/signin',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/register',
  '/api/auth/csrf-token',       // the token-vending endpoint itself
  '/api/invitations/validate',
  '/api/invitations/accept',
]);

function timingSafeStrEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

app.use((req: Request, res: Response, next: NextFunction) => {
  // Only state-changing methods need CSRF protection
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Exempt public routes
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();
  // SSO routes are all GET redirects — but exempt any POST callbacks defensively
  if (req.path.startsWith('/api/auth/sso/')) return next();

  const sessionToken = (req.session as any).csrfToken as string | undefined;
  const requestToken = req.headers['x-csrf-token'] as string | undefined;

  if (!sessionToken || !requestToken || !timingSafeStrEqual(requestToken, sessionToken)) {
    logger.warn({ path: req.path, method: req.method, ip: req.ip }, 'SG-41: CSRF token validation failed');
    return res.status(403).json({ error: 'CSRF token validation failed. Please refresh and try again.' });
  }
  next();
});

(async () => {
  // ── Step 0: ensure required PostgreSQL extensions exist ──────────────────
  // Must run first — the schema has vector(1024) / vector(3072) columns that
  // require the pgvector extension to exist before any table can be created.
  // Azure Portal prerequisite: Server parameters → azure.extensions → VECTOR
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    log("PostgreSQL extensions ready (vector, pg_trgm)");
  } catch (extErr: unknown) {
    const msg = extErr instanceof Error ? extErr.message : String(extErr);
    log(`⚠️  Extension creation warning (non-fatal): ${msg}`);
    // Non-fatal at runtime — if the extension already exists this is a no-op.
    // If it truly fails, vector queries will fail later with a clear error.
  }

  // Ensure scheduler_config table exists (required for scheduler service)
  await createSchedulerConfig();
  
  // Run domain enhancements migration (adds company_id, user_quota, domain_scheduler_config)
  await runDomainEnhancementsMigration();
  
  // Run kiosk tables migration (for Billing Kiosk feature)
  await createKioskTables();
  
  // Add billing_type column to kiosk_faq_documents
  await addBillingTypeColumn();
  
  // Create kiosk_faq_entries table for parsed FAQ Q&A pairs
  await createKioskFaqEntriesTable();
  
  // Add Anaplan credentials columns to domain_scheduler_config
  await addDomainAnaplanCredentials();
  
  // Create domain API connectors table for plugin-based integrations
  await createDomainApiConnectorsTable();

  // Create azure_blob_file_registry table for delta-sync tracking (new files only)
  await createAzureBlobRegistryTable();
  // Allow multiple Azure Blob connectors per domain (different folders/cubes)
  await dropAzureBlobConnectorUniqueConstraint();
  
  // Add connector_preferences column to user_settings
  await runConnectorPreferencesMigration();
  
  // Add cube_id columns to enterprise chunks and embeddings for cube-level data isolation
  await addCubeIdToChunks();
  
  // Add target_cube_id column to domain_scheduler_config for automation cube targeting
  await addTargetCubeToSchedulerConfig();
  
  // Create cube_metadata table for structured data indexing
  await createCubeMetadataTable();
  
  // Create semantic SQL tables for natural language queries on large Excel files
  await runSemanticSqlMigration();
  
  // Create schema configuration tables for domain-specific column mapping
  await runSchemaConfigMigration();
  
  // Create ingestion jobs table for tracking Excel file processing progress
  await createIngestionJobsTable();
  
  // Create business logic tables for domain-specific SQL generation
  await createBusinessLogicTables();

  // Add Microsoft SSO columns to domains table
  await addSsoColumnsToDomains();

  // Add SSO group access control columns to domains table
  await addSsoGroupColumnsToDomains();

  // Add email provider config columns to domains table
  await addEmailConfigColumnsToDomains();

  // Add AI provider config columns to domains table + embedding_3072 to embedding tables
  await addAiConfigColumnsToDomains();

  // Add project_type and customer columns to cube_fact_data
  await addCustomerColumns();
  await createAuditLogTable();
  await createRetentionPoliciesTable();

  // Create Investment/CAPEX/PMO fact table and add schema_type to cubes
  await runInvestmentTablesMigration();

  // Add sso_group_mappings JSONB column to domains + status column to domain_users
  await addSsoGroupMappings();

  // Create cube_board_reports table for Smart Analysis Board reports
  await createBoardReportsTable();
  // Add varianceData + comparisonPeriodLabel columns (Phase 2)
  await addVarianceDataColumn();

  await seedDatabase();
  await fixAzureBlobConnectorSchedules();
  
  const server = await registerRoutes(app);

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  // Azure App Service sends SIGTERM before stopping a container.
  // We stop accepting new connections, let in-flight requests finish (30s max),
  // then exit — so no user query is cut off mid-response.
  const shutdown = (signal: string) => {
    log(`${signal} received — starting graceful shutdown`);
    server.close(() => {
      log("All connections drained — exiting");
      process.exit(0);
    });
    setTimeout(() => {
      log("Shutdown timeout reached — forcing exit");
      process.exit(1);
    }, 30_000);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  // ── Nightly scheduler jobs (dynamic — reads UTC hour from DB) ───────────────
  const scheduleNightlyJobs = async () => {
    try {
      const { getSchedulerSettings, ensureSchedulerTables } = await import("./services/schedulerService");
      await ensureSchedulerTables();
      const settings = await getSchedulerSettings();
      const utcHour = settings.backupUtcHour ?? 2;

      const now = new Date();
      const nextRun = new Date();
      nextRun.setUTCHours(utcHour, 0, 0, 0);
      if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
      const delay = nextRun.getTime() - now.getTime();

      setTimeout(() => {
        runRetentionEngine("scheduler").catch((e) => logger.error({ e }, "Retention engine error"));
        runBackup("scheduler").catch((e) => logger.error({ e }, "Backup error"));
        // Reschedule every 24 h so it picks up any setting changes on the next cycle
        setInterval(() => {
          scheduleNightlyJobs().catch((e) => logger.error({ e }, "Scheduler reschedule error"));
        }, 24 * 60 * 60 * 1000);
      }, delay);

      log(`Nightly jobs (retention + backup) scheduled at ${String(utcHour).padStart(2, "0")}:00 UTC — first run in ${Math.round(delay / 3600000)}h`);
    } catch (e) {
      logger.error({ e }, "Failed to schedule nightly jobs — falling back to 02:00 UTC");
      const now = new Date();
      const next2am = new Date();
      next2am.setUTCHours(2, 0, 0, 0);
      if (next2am <= now) next2am.setUTCDate(next2am.getUTCDate() + 1);
      const delay = next2am.getTime() - now.getTime();
      setTimeout(() => {
        runRetentionEngine("scheduler").catch(() => {});
        runBackup("scheduler").catch(() => {});
        setInterval(() => {
          runRetentionEngine("scheduler").catch(() => {});
          runBackup("scheduler").catch(() => {});
        }, 24 * 60 * 60 * 1000);
      }, delay);
    }
  };
  scheduleNightlyJobs().catch((e) => logger.error({ e }, "scheduleNightlyJobs failed"));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start Python backend for document processing and RAG
    // In Docker (Supervisor manages Python), skip starting it here
    // Use DOCKER_ENV=true to indicate running in Docker container
    if (process.env.DOCKER_ENV !== 'true') {
      startPythonBackend();
    } else {
      log('Docker mode: Python backend managed by Supervisor');
    }
    
    // Start Anaplan automation scheduler (6 AM IST daily) - legacy global scheduler
    scheduler.start();
    
    // Start multi-tenant domain schedulers for per-domain Anaplan automation
    multiTenantScheduler.startAllDomainSchedulers();

    // Start SSO group membership sync job (every 15 min — deactivates removed users, syncs roles)
    startSsoSyncJob();
  });
})();

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, dbAuthMode } from "./db";
import { getTokenStatus } from "./utils/entraToken";
import { generateAuthUrl, exchangeCodeForUser, validateEmailDomain, buildRedirectUri, resolveGroupRole, hasSsoGroupMappings } from "./services/ssoService";
import { encryptValue, decryptValue } from "./utils/encryption";
import {
  insertChatSchema,
  insertMessageSchema,
  insertUserSchema,
  insertDocumentSchema,
  insertBoardSchema,
  insertQueryAuditSchema,
  enterpriseDocuments,
} from "@shared/schema";
import { eq, desc, sql as sqlTag, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { existsSync, unlinkSync } from "fs";
import { streamFinancialAnalysis, checkPromptSafety, type DomainAiConfig } from "./openai";
import { runBoardAnalysis, getCubeVersions, previewBoardData, FOLLOW_UP_INTENTS } from "./services/boardAnalysisService";
import { cubeBoardReports } from "@shared/schema";
import { queryOrchestrator } from "./services/queryOrchestrator";
import { evidenceBroker } from "./services/evidenceBroker";
import { requireAdmin } from "./middleware/rbac";
import {
  requireAdmin as requireAdminAuth,
  requireAuth,
} from "./middleware/auth";
import { invitationService } from "./services/invitationService";
import { emailService } from "./services/emailService";
import { otpService } from "./services/otpService";
import { strongPasswordSchema } from "@shared/schema";
import rateLimit from "express-rate-limit";
import { scheduler } from "./services/scheduler";
import { anaplanAutomation } from "./services/anaplanAutomation";
import { versionManager } from "./services/versionManager";
import { multiTenantScheduler } from "./services/multiTenantScheduler";
import {
  connectorRegistry,
  AVAILABLE_CONNECTOR_TYPES,
} from "./services/connectors/connectorRegistry";
import {
  insertDomainApiConnectorSchema,
  anaplanConfigSchema,
  azureBlobConfigSchema,
  CONNECTOR_TYPES,
  insertCubeSchema,
  insertCubeUserAccessSchema,
  cubeBusinessTerms,
  cubeCalculationRules,
  cubeFilterRules,
  cubeQueryPatterns,
  cubeColumnValues,
  cubeColumnRelationships,
} from "@shared/schema";
import {
  encryptSensitiveFields,
  redactSensitiveFields,
} from "./utils/encryption";
import { writeAuditLog, extractIp } from "./services/auditLogger";
import { runBackup, listBackups } from "./services/backupService";
import { listRetentionPolicies, updateRetentionPolicy, runRetentionEngine } from "./services/retentionEngine";

const signinSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  deviceToken: z.string().optional(),
});

const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  otpCode: z.string().length(6, "OTP code must be 6 digits"),
  rememberDevice: z.boolean().optional(),
  deviceFingerprint: z.string().optional(),
});

const resendOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const createDomainSchema = z.object({
  name:               z.string().min(1).max(253),
  adminEmail:         z.string().email(),
  defaultOtp:         z.string().length(6).optional().nullable(),
  authMethod:         z.enum(["otp", "microsoft_sso"]).optional(),
  ssoTenantId:        z.string().max(200).optional().nullable(),
  ssoClientId:        z.string().max(200).optional().nullable(),
  ssoClientSecret:    z.string().max(500).optional().nullable(),
  ssoGroupId:         z.string().max(200).optional().nullable(),
  ssoDefaultRole:     z.enum(["admin", "standard"]).optional(),
  ssoGroupMappings:   z.array(z.object({
    groupId: z.string().min(1).max(200),
    role:    z.enum(["admin", "standard"]),
  })).optional().nullable(),
  emailProvider:      z.string().max(50).optional(),
  emailSmtpUser:      z.string().max(200).optional().nullable(),
  emailSmtpPass:      z.string().max(500).optional().nullable(),
  emailFromAddress:   z.string().email().optional().nullable(),
  emailFromName:      z.string().max(100).optional().nullable(),
  aiProvider:         z.string().max(50).optional(),
  aiAuthMethod:       z.enum(['api_key', 'entra_id', 'private_endpoint']).optional(),
  aiEndpoint:         z.string().url().optional().nullable(),
  aiApiKey:           z.string().max(500).optional().nullable(),
  aiChatModel:        z.string().max(100).optional().nullable(),
  aiChatApiVersion:   z.string().max(50).optional().nullable(),
  aiEmbeddingModel:   z.string().max(100).optional().nullable(),
  aiEmbeddingApiVersion: z.string().max(50).optional().nullable(),
  aiSystemPrompt:     z.string().max(5000).optional().nullable(),
});

const createCubeSchema = z.object({
  name:            z.string().min(1).max(255),
  description:     z.string().max(1000).optional().nullable(),
  domainId:        z.string().optional(),
  sourceType:      z.string().max(50).optional(),
  schemaType:      z.enum(['kpi', 'investment_capex_pmo']).optional().default('kpi'),
  connectorId:     z.string().optional(),
  ingestionConfig: z.record(z.unknown()).optional().nullable(),
});

const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdir(uploadDir, { recursive: true }).catch(() => {});
fs.mkdir(path.join(uploadDir, "ppt-exports"), { recursive: true }).catch(() => {});

// SG-43 / SG-67: Allowed MIME types — reject anything outside this set at intake.
const ALLOWED_MIME_TYPES = new Set([
  // Spreadsheets
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                       // .doc
  // Presentations
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint',                                              // .ppt
  // Text / data
  'text/csv',
  'application/csv',
  'text/plain',
  // Images (for kiosk / supporting uploads)
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// SG-SEC: Blocklist of dangerous file extensions — rejected regardless of MIME type.
// Covers executables, scripts, macros, archives-with-code, and web payloads.
const BLOCKED_EXTENSIONS = new Set([
  // Executables
  '.exe', '.com', '.scr', '.pif', '.msi', '.msp', '.application',
  // Scripts
  '.bat', '.cmd', '.sh', '.bash', '.zsh', '.fish', '.ksh', '.csh',
  '.ps1', '.psm1', '.psd1', '.ps1xml', '.vbs', '.vbe', '.wsf', '.wsh', '.js',
  '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.py', '.pyw', '.rb', '.pl', '.php',
  '.php3', '.php4', '.php5', '.phtml', '.asp', '.aspx', '.jsp', '.jspx',
  // Web payloads
  '.html', '.htm', '.xhtml', '.svg', '.xml',
  // Office macros
  '.xlsm', '.xltm', '.xlam', '.docm', '.dotm', '.pptm', '.potm', '.ppam',
  // Libraries / native code
  '.dll', '.so', '.dylib', '.ocx', '.sys', '.drv',
  // Archives (can contain malicious payloads)
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.img',
  // Shortcuts / links
  '.lnk', '.url', '.desktop', '.jar', '.class', '.war', '.ear',
  // Other risky
  '.reg', '.inf', '.ini', '.cpl', '.hta', '.chm',
]);

// SG-SEC: For text/plain MIME, only these safe extensions are permitted.
const ALLOWED_TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.tsv', '.log', '.md']);

// SG-SEC: Sanitise a filename — strip path separators, null bytes, leading dots,
// and collapse to a safe basename. Returns the safe name.
function sanitiseFilename(raw: string): string {
  // Decode any URL encoding
  let name = decodeURIComponent(raw).replace(/\0/g, '');
  // Strip path traversal
  name = path.basename(name);
  // Remove leading dots (hidden files) and spaces
  name = name.replace(/^[.\s]+/, '');
  // Collapse unsafe chars to underscores
  name = name.replace(/[^\w\s.\-]/g, '_');
  return name || 'upload';
}

// SG-SEC: Validate the original filename — blocked extension, double-extension,
// and text/plain extension allowlist. Returns an error string or null if OK.
function validateFilename(originalname: string, mimetype: string): string | null {
  const safe = sanitiseFilename(originalname);
  const ext  = path.extname(safe).toLowerCase();

  // Block dangerous extensions
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `File extension "${ext}" is not permitted.`;
  }

  // Block double-extension attacks (e.g. "report.pdf.exe" → ext=".exe" already caught,
  // but catch "invoice.js.txt" style where only the last ext looks safe)
  const allParts  = safe.split('.');
  if (allParts.length > 2) {
    for (const part of allParts.slice(1, -1)) {
      if (BLOCKED_EXTENSIONS.has(`.${part.toLowerCase()}`)) {
        return `Filename contains a blocked extension ".${part}".`;
      }
    }
  }

  // For text/plain MIME, restrict to safe text extensions only
  if ((mimetype === 'text/plain' || mimetype === 'application/csv') &&
      ext !== '' && !ALLOWED_TEXT_EXTENSIONS.has(ext)) {
    return `Files with extension "${ext}" are not accepted as plain text.`;
  }

  return null;
}

// SG-43: Magic-byte validation — verify actual file content matches declared type.
// Called AFTER multer writes the file to disk; deletes the file if invalid.
async function validateFileMagicBytes(filePath: string, mimetype: string): Promise<boolean> {
  try {
    const fd = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(8);
    await fd.read(buf, 0, 8, 0);
    await fd.close();

    const isPdf  = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
    const isPkZip = buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04; // PK\x03\x04
    const isOle2  = buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0; // OLE2 (xls/doc/ppt)
    const isJpeg  = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const isPng   = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isGif   = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
    const isWebP  = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;

    // Map MIME to expected magic bytes
    const valid: Record<string, boolean> = {
      'application/pdf': isPdf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': isPkZip,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': isPkZip,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': isPkZip,
      'application/vnd.ms-excel': isOle2,
      'application/msword': isOle2,
      'application/vnd.ms-powerpoint': isOle2,
      'image/jpeg': isJpeg,
      'image/png': isPng,
      'image/gif': isGif,
      'image/webp': isWebP,
      // Text files have no magic bytes — accept them by declared MIME
      'text/csv': true,
      'application/csv': true,
      'text/plain': true,
    };

    return valid[mimetype] ?? false;
  } catch {
    return false;
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString("hex")}`;
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB outer limit — covers Enterprise (500MB); Vault/Chat caps enforced client-side
  },
  fileFilter: (req, file, cb) => {
    // Gate 1 — MIME type whitelist
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error(
        `File type not allowed: "${file.mimetype}". Accepted formats: PDF, Excel, Word, PowerPoint, CSV, and images.`
      ));
    }
    // Gate 2 — extension blocklist + double-extension + text/plain allowlist
    const extErr = validateFilename(file.originalname, file.mimetype);
    if (extErr) {
      return cb(new Error(extErr));
    }
    cb(null, true);
  },
});

const PUBLIC_EMAIL_PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "mail.com",
  "protonmail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "inbox.com",
  "mail.ru",
];

async function ensureCompanyMembershipForUser(
  userId: string,
  email: string,
): Promise<void> {
  try {
    const emailParts = email.toLowerCase().split("@");
    if (emailParts.length !== 2 || !emailParts[1]) {
      console.warn(`Invalid email format: ${email}`);
      return;
    }

    const domain = emailParts[1].trim();

    if (
      !domain ||
      domain.includes("..") ||
      domain.startsWith(".") ||
      domain.endsWith(".")
    ) {
      console.warn(`Invalid domain format: ${domain}`);
      return;
    }

    if (PUBLIC_EMAIL_PROVIDERS.includes(domain)) {
      console.log(
        `Skipping auto-assignment for public email provider: ${domain}`,
      );
      return;
    }

    const domainParts = domain.split(".");
    if (domainParts.length < 2) {
      console.warn(`Invalid domain structure: ${domain}`);
      return;
    }

    const companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
    const companySlug = domain.replace(/\./g, "-");

    let company = await storage.findCompanyByNormalizedDomain(domain);

    if (company) {
      console.log(
        `Found existing company "${company.name}" (slug: ${company.slug}) for domain: ${domain}`,
      );
    } else {
      console.log(`Creating new company for domain: ${domain}`);
      try {
        company = await storage.createCompany({
          name: companyName,
          slug: companySlug,
          description: `Auto-created company for ${domain} domain`,
        });
      } catch (companyError: any) {
        if (
          companyError?.message?.includes("duplicate") ||
          companyError?.code === "23505"
        ) {
          console.log(
            `Company for ${domain} was created by another request, fetching it`,
          );
          company = await storage.getCompanyBySlug(companySlug);
          if (!company) {
            company = await storage.findCompanyByNormalizedDomain(domain);
            if (!company) {
              throw new Error(
                `Failed to fetch company after duplicate error for domain: ${domain}`,
              );
            }
          }
        } else {
          throw companyError;
        }
      }
    }

    const existingMembership = await storage.getCompanyMembership(
      userId,
      company.id,
    );
    if (!existingMembership) {
      console.log(
        `Creating company membership for user ${email} in company ${companyName}`,
      );
      try {
        await storage.createCompanyMembership({
          userId,
          companyId: company.id,
          role: "member",
        });
      } catch (membershipError: any) {
        if (
          !(
            membershipError?.message?.includes("duplicate") ||
            membershipError?.code === "23505"
          )
        ) {
          throw membershipError;
        }
      }
    }

    let userSettings = await storage.getUserSettings(userId);
    if (!userSettings) {
      console.log(`Creating user settings for ${email}`);
      try {
        await storage.createUserSettings({
          userId,
          enterpriseEnabled: 0,
          activeCompanyId: company.id,
        });
      } catch (settingsError: any) {
        if (
          !(
            settingsError?.message?.includes("duplicate") ||
            settingsError?.code === "23505"
          )
        ) {
          throw settingsError;
        }
      }
    }
  } catch (error) {
    console.error("Failed to ensure company membership:", error);
  }
}

// Helper function to ensure domain user also exists in the main users table
async function ensureUserAccountForDomainUser(
  email: string,
  displayName?: string,
): Promise<string> {
  const emailLower = email.toLowerCase();

  // Check if user already exists in users table
  let user = await storage.getUserByUsername(emailLower);

  if (!user) {
    // Create user in the main users table
    // Use a random password since domain users use OTP-based login
    const randomPassword = randomBytes(32).toString('hex');
    const name = displayName || emailLower.split("@")[0];

    user = await storage.createUser({
      username: emailLower,
      password: randomPassword,
      displayName: name,
      role: "user",
    });

    console.log(`✅ Created user account for domain user: ${emailLower}`);
  }

  return user.id;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // ── SG-41: CSRF token vending endpoint ───────────────────────────────────
  // Generates a random per-session token on first call and returns it.
  // The client fetches this once after login and sends it as x-csrf-token
  // on every state-changing request.
  app.get("/api/auth/csrf-token", (req, res) => {
    if (!(req.session as any).csrfToken) {
      (req.session as any).csrfToken = randomBytes(32).toString('hex');
    }
    res.json({ csrfToken: (req.session as any).csrfToken });
  });

  // ── Microsoft SSO routes ─────────────────────────────────────────────────

  // Returns the auth method configured for a given domain (public)
  app.get("/api/auth/sso/config", async (req, res) => {
    try {
      const domainName = (req.query.domain as string || '').toLowerCase().trim();
      if (!domainName) return res.json({ authMethod: 'otp' });
      const domain = await storage.getDomainByName(domainName);
      if (!domain) return res.json({ authMethod: 'otp' });
      res.json({ authMethod: domain.authMethod || 'otp' });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Initiates Microsoft SSO login — redirects user to Microsoft login page
  app.get("/api/auth/sso/microsoft/initiate", async (req, res) => {
    try {
      const domainName = (req.query.domain as string || '').toLowerCase().trim();
      if (!domainName) return res.status(400).json({ error: "Domain required" });

      const domain = await storage.getDomainByName(domainName);
      if (!domain || domain.authMethod !== 'microsoft_sso') {
        return res.status(400).json({ error: "SSO not configured for this domain" });
      }
      if (!domain.ssoTenantId || !domain.ssoClientId || !domain.ssoClientSecret) {
        return res.status(400).json({ error: "SSO credentials incomplete for this domain" });
      }

      // CSRF state: encode domain name so callback knows which domain this belongs to
      const csrfToken = Buffer.from(
        JSON.stringify({ domain: domainName, nonce: randomBytes(16).toString('hex') })
      ).toString('base64url');

      (req.session as any).ssoState = csrfToken;

      const redirectUri = buildRedirectUri(req);
      const authUrl = await generateAuthUrl(domain, csrfToken, redirectUri);
      res.redirect(authUrl);
    } catch (error: any) {
      console.error("SSO initiate error:", error);
      res.redirect(`/?sso_error=config_error`);
    }
  });

  // Microsoft SSO callback — exchanges code, validates user, creates session
  app.get("/api/auth/sso/microsoft/callback", async (req, res) => {
    try {
      const { code, state, error: msError } = req.query;

      if (msError) {
        console.error("Microsoft SSO error:", msError, req.query.error_description);
        return res.redirect(`/?sso_error=microsoft_error`);
      }

      if (!code || !state) {
        return res.redirect(`/?sso_error=missing_params`);
      }

      // Verify CSRF state
      const sessionState = (req.session as any).ssoState;
      if (!sessionState || sessionState !== state) {
        return res.redirect(`/?sso_error=invalid_state`);
      }
      delete (req.session as any).ssoState;

      // Decode domain from state
      let domainName: string;
      try {
        const parsed = JSON.parse(Buffer.from(state as string, 'base64url').toString('utf8'));
        domainName = parsed.domain;
      } catch {
        return res.redirect(`/?sso_error=invalid_state`);
      }

      const domain = await storage.getDomainByName(domainName);
      if (!domain || domain.authMethod !== 'microsoft_sso') {
        return res.redirect(`/?sso_error=domain_not_found`);
      }

      // Exchange code for user identity — use same redirect URI that was sent in the initiate request
      const redirectUri = buildRedirectUri(req);
      const { email, displayName } = await exchangeCodeForUser(domain, code as string, redirectUri);

      // Validate the email belongs to this domain
      if (!validateEmailDomain(email, domainName)) {
        console.warn(`SSO callback: email ${email} does not match domain ${domainName}`);
        writeAuditLog({ action: 'SSO_LOGIN_FAILED', resource: domainName, ipAddress: extractIp(req as any), status: 'failed', details: { email, domain: domainName, reason: 'domain_mismatch', triggeredBy: 'login' } });
        return res.redirect(`/?sso_error=domain_mismatch`);
      }

      // Check existing domain user record
      let domainUser = await storage.getDomainUserByEmail(email);

      // Check if this domain uses group-based access control
      const groupsConfigured = hasSsoGroupMappings(domain);

      if (!domainUser || domainUser.domainId !== domain.id) {
        // User not manually invited — check if group-based access is configured
        if (groupsConfigured) {
          // One Graph API call checks ALL configured groups at once
          const resolvedRole = await resolveGroupRole(domain, email);
          if (!resolvedRole) {
            console.warn(`SSO callback: ${email} is not a member of any configured group for domain ${domainName}`);
            writeAuditLog({ action: 'SSO_LOGIN_FAILED', resource: domainName, ipAddress: extractIp(req as any), status: 'failed', details: { email, domain: domainName, reason: 'not_in_group', triggeredBy: 'login' } });
            return res.redirect(`/?sso_error=not_in_group`);
          }
          // Auto-provision this user with the role resolved from their AD group
          console.log(`SSO callback: auto-provisioning ${email} with role=${resolvedRole}`);
          domainUser = await storage.createDomainUser({
            domainId: domain.id,
            email: email,
            role: resolvedRole,
            hardcodedOtp: null,
          });
          writeAuditLog({ action: 'SSO_USER_PROVISIONED', resource: domainName, ipAddress: extractIp(req as any), status: 'success', details: { email, domain: domainName, role: resolvedRole, triggeredBy: 'login' } });
        } else {
          // No groups configured — fall back to invite-only
          console.warn(`SSO callback: ${email} not registered in domain ${domainName}`);
          writeAuditLog({ action: 'SSO_LOGIN_FAILED', resource: domainName, ipAddress: extractIp(req as any), status: 'failed', details: { email, domain: domainName, reason: 'not_registered', triggeredBy: 'login' } });
          return res.redirect(`/?sso_error=not_registered`);
        }
      } else {
        // Existing domain user — block if deactivated by SSO sync
        if ((domainUser as any).status === 'inactive') {
          console.warn(`SSO callback: ${email} account is inactive (deactivated by SSO sync)`);
          writeAuditLog({ action: 'SSO_LOGIN_FAILED', resource: domainName, ipAddress: extractIp(req as any), status: 'failed', details: { email, domain: domainName, reason: 'account_inactive', triggeredBy: 'login' } });
          return res.redirect(`/?sso_error=account_inactive`);
        }

        if (groupsConfigured) {
          // Re-check group membership on every login — AD is source of truth
          const resolvedRole = await resolveGroupRole(domain, email);
          if (!resolvedRole) {
            console.warn(`SSO callback: ${email} is no longer in any configured group`);
            writeAuditLog({ action: 'SSO_LOGIN_FAILED', resource: domainName, ipAddress: extractIp(req as any), status: 'failed', details: { email, domain: domainName, reason: 'not_in_group', triggeredBy: 'login' } });
            return res.redirect(`/?sso_error=not_in_group`);
          }
          // Sync role if it changed (promotion or demotion in AD)
          if (domainUser.role !== resolvedRole) {
            console.log(`SSO callback: syncing role for ${email}: ${domainUser.role} → ${resolvedRole}`);
            await storage.updateDomainUser(domainUser.id, { role: resolvedRole });
            writeAuditLog({ action: 'SSO_ROLE_SYNCED', resource: domainName, ipAddress: extractIp(req as any), status: 'success', details: { email, domain: domainName, oldRole: domainUser.role, newRole: resolvedRole, triggeredBy: 'login' } });
            domainUser = { ...domainUser, role: resolvedRole };
          }
        }
      }

      // Ensure user account exists in main users table
      const userId = await ensureUserAccountForDomainUser(email, displayName);

      // Regenerate session and log user in
      await new Promise<void>((resolve, reject) =>
        req.session.regenerate((err) => (err ? reject(err) : resolve()))
      );
      (req.session as any).userId = userId;

      // Audit: successful SSO login
      writeAuditLog({ userId, action: 'SSO_LOGIN', resource: domainName, ipAddress: extractIp(req as any), status: 'success', details: { email, domain: domainName, role: domainUser.role, triggeredBy: 'login' } });

      res.redirect('/dashboard');
    } catch (error: any) {
      console.error("SSO callback error:", error);
      res.redirect(`/?sso_error=server_error`);
    }
  });

  // ── End Microsoft SSO routes ──────────────────────────────────────────────

  // Destroy the server-side session so the HttpOnly cookie becomes invalid.
  // Must be called on logout — client-only clearAuthUser() is not sufficient
  // because the session cookie persists and /api/auth/me would re-authenticate.
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("[auth] session.destroy error on logout:", err);
      }
      // Clear the session cookie regardless of destroy outcome
      res.clearCookie("connect.sid", { path: "/" });
      res.json({ success: true });
    });
  });

  // Return current session user — used by SSO flow to sync localStorage after callback
  app.get("/api/auth/me", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      return res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role || 'user',
      });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, deviceToken } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      const emailLower = email.toLowerCase();

      // Block OTP for SSO-configured domains — OTP must never be sent to SSO users
      const emailDomain = emailLower.split('@')[1];
      let signinDomainEmailConfig = null;
      if (emailDomain) {
        // Try exact domain match first, then parent domain (e.g. in.bosch.com → bosch.com)
        let domain = await storage.getDomainByName(emailDomain);
        if (!domain) {
          const parts = emailDomain.split('.');
          if (parts.length > 2) {
            const parentDomain = parts.slice(1).join('.');
            domain = await storage.getDomainByName(parentDomain);
          }
        }
        if (domain?.authMethod === 'microsoft_sso') {
          return res.status(400).json({
            error: 'sso_required',
            message: 'This domain uses Microsoft SSO. Please sign in with your Microsoft account.',
          });
        }
        if (domain?.emailProvider && domain.emailProvider !== 'default') {
          signinDomainEmailConfig = {
            emailProvider: domain.emailProvider,
            emailSmtpUser: domain.emailSmtpUser,
            emailSmtpPass: domain.emailSmtpPass ? decryptValue(domain.emailSmtpPass) : null,
            emailFromAddress: domain.emailFromAddress,
            emailFromName: domain.emailFromName,
          };
        }
      }

      let user = await storage.getUserByUsername(emailLower);

      // If user doesn't exist in main users table, check if they're an invited domain user
      if (!user) {
        const domainUser = await storage.getDomainUserByEmail(emailLower);
        if (domainUser) {
          // Domain user exists but main user account is missing - create it now
          console.log(
            `🔧 Auto-creating user account for domain user: ${emailLower}`,
          );
          await ensureUserAccountForDomainUser(emailLower);
          user = await storage.getUserByUsername(emailLower);
        }
      }

      if (!user) {
        return res.status(401).json({
          error: "No account found with this email",
        });
      }

      const requiresOtp = await otpService.shouldRequireOtp(
        user.id,
        deviceToken,
      );

      if (!requiresOtp) {
        req.session.userId = user.id;
        await storage.updateUserLastLogin(user.id);

        await ensureCompanyMembershipForUser(user.id, user.username);

        return res.json({
          success: true,
          requiresOtp: false,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
          },
        });
      }

      await otpService.createAndSendOtp(
        user.id,
        user.username,
        user.displayName,
        "login",
        signinDomainEmailConfig,
      );

      res.json({
        success: true,
        requiresOtp: true,
        message: "Verification code sent to your email",
      });
    } catch (error) {
      console.error("Sign in error:", error);
      res.status(400).json({ error: "Authentication failed" });
    }
  });

  // Security (SAST Finding 10): removed HARDCODED_OTP_ADMINS list, getHardcodedOtpForUser,
  // and the per-user hardcoded OTP fallback. Static OTP backdoors (domain.defaultOtp,
  // NEMKO_ADMIN_OTP, hardcoded email list) are a standing privilege-escalation path that
  // Bosch security auditors will flag regardless of whether OTP auth is actively used.
  // The verify-otp endpoint now accepts only the time-limited, bcrypt-hashed OTP that
  // was emailed to the user. Rate limiting is provided by the global API limiter
  // (100 req/min) plus MAX_OTP_ATTEMPTS=5 enforced inside otpService.verifyOtp().

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otpCode, rememberDevice, deviceFingerprint } =
        verifyOtpSchema.parse(req.body);

      const user = await storage.getUserByUsername(email.toLowerCase());

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const verification = await otpService.verifyOtp(user.id, otpCode, "login");

      if (!verification.success) {
        return res.status(401).json({ error: verification.error });
      }

      req.session.userId = user.id;
      await storage.updateUserLastLogin(user.id);

      await ensureCompanyMembershipForUser(user.id, user.username);

      writeAuditLog({
        userId:    user.id,
        action:    "LOGIN",
        resource:  "auth",
        ipAddress: extractIp(req),
        status:    "success",
        details:   { email: user.username, method: "otp" },
      }).catch(() => {});

      let deviceToken: string | undefined;
      if (rememberDevice) {
        const userAgent = req.headers["user-agent"];
        const ipAddress = req.ip || req.connection.remoteAddress;

        deviceToken = await otpService.createTrustedDevice(
          user.id,
          userAgent,
          ipAddress,
          deviceFingerprint,
        );
      }

      res.json({
        success: true,
        deviceToken,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(400).json({ error: "Verification failed" });
    }
  });

  const resendOtpLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 2, // limit each email to 2 requests per minute
    message: "Too many requests. Please wait before requesting another code.",
  });

  app.post("/api/auth/resend-otp", resendOtpLimiter, async (req, res) => {
    try {
      const { email } = resendOtpSchema.parse(req.body);

      const user = await storage.getUserByUsername(email.toLowerCase());

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await otpService.createAndSendOtp(
        user.id,
        user.username,
        user.displayName,
        "login",
      );

      res.json({
        success: true,
        message: "New verification code sent to your email",
      });
    } catch (error) {
      console.error("Resend OTP error:", error);
      res.status(400).json({ error: "Failed to resend verification code" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      // Normalize username (email) to lowercase for case-insensitive login
      const normalizedData = { ...data, username: data.username.toLowerCase() };

      const existingUser = await storage.getUserByUsername(
        normalizedData.username,
      );
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const user = await storage.createUser(normalizedData);

      await ensureCompanyMembershipForUser(user.id, user.username);

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
    } catch (error) {
      res.status(400).json({ error: "Registration failed" });
    }
  });

  app.get("/api/chats", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const chats = await storage.getChats(userId);
      res.json(chats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chats" });
    }
  });

  app.get("/api/chats/:id", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const chat = await storage.getChat(req.params.id);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (chat.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Forbidden - you don't have access to this chat" });
      }

      res.json(chat);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chat" });
    }
  });

  app.post("/api/chats", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      console.log("Creating chat with body:", req.body);

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res
          .status(401)
          .json({ error: "Session expired - please sign in again" });
      }

      const data = insertChatSchema.parse({
        ...req.body,
        userId: userId,
      });

      const chat = await storage.createChat(data);
      res.status(201).json(chat);
    } catch (error) {
      console.error("Chat creation error:", error);

      // Check if it's a foreign key error
      if (
        error instanceof Error &&
        error.message.includes("foreign key constraint")
      ) {
        return res
          .status(401)
          .json({ error: "Session expired - please sign in again" });
      }

      res
        .status(400)
        .json({
          error: "Invalid chat data",
        });
    }
  });

  app.patch("/api/chats/:id", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const chat = await storage.getChat(req.params.id);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (chat.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Forbidden - you don't have access to this chat" });
      }

      const { title } = req.body;
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required" });
      }

      const updatedChat = await storage.updateChatTitle(
        req.params.id,
        title.trim(),
      );
      res.json(updatedChat);
    } catch (error) {
      console.error("Chat update error:", error);
      res.status(500).json({ error: "Failed to update chat" });
    }
  });

  app.delete("/api/chats/:id", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const chat = await storage.getChat(req.params.id);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (chat.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Forbidden - you don't have access to this chat" });
      }

      await storage.deleteChat(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Chat deletion error:", error);
      res.status(500).json({ error: "Failed to delete chat" });
    }
  });

  app.get("/api/chats/:chatId/messages", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const chat = await storage.getChat(req.params.chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (chat.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Forbidden - you don't have access to this chat" });
      }

      const messages = await storage.getMessages(req.params.chatId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/chats/:chatId/messages", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const chat = await storage.getChat(req.params.chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (chat.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Forbidden - you don't have access to this chat" });
      }

      const data = insertMessageSchema.parse({
        ...req.body,
        chatId: req.params.chatId,
      });

      const message = await storage.createMessage(data);

      // Auto-update chat title from first user message if title is "New Analysis"
      if (data.role === "user" && chat.title === "New Analysis") {
        const messageCount = await storage.getChatMessageCount(
          req.params.chatId,
        );
        if (messageCount <= 1) {
          // Generate title from first message (first 50 chars)
          const newTitle =
            data.content.length > 50
              ? data.content.slice(0, 47) + "..."
              : data.content;
          await storage.updateChatTitle(req.params.chatId, newTitle);
        }
      }

      if (data.role === "user") {
        // SG-50: Prompt injection guard — blocks before hitting orchestrator/LLM
        const promptSafety = checkPromptSafety(data.content);
        if (!promptSafety.safe) {
          writeAuditLog({
            userId,
            action: 'PROMPT_BLOCKED',
            resource: 'chat',
            resourceId: req.params.chatId,
            ipAddress: extractIp(req),
            status: 'blocked',
            details: { reason: promptSafety.reason, promptLength: data.content.length },
          }).catch(() => {});
          return res.status(400).json({
            error: 'Your message could not be processed. Please rephrase your query.',
          });
        }

        const conversationHistory = await storage.getMessages(
          req.params.chatId,
        );
        const historyFormatted = conversationHistory
          .filter((m) => m.id !== message.id)
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        let fullResponse = "";

        try {
          const orchestratorResult = await queryOrchestrator.query({
            query: data.content,
            chatId: req.params.chatId,
            userId,
            db: storage.db,
          });

          const rankedEvidence = evidenceBroker.rankEvidence(
            orchestratorResult.evidence,
          );
          const context = evidenceBroker.buildContext(rankedEvidence, data.content);
          const multiSourcePrompt = evidenceBroker.generatePromptWithCitations(
            data.content,
            context,
            orchestratorResult.queryType,
          );

          await storage.createQueryAudit({
            chatId: req.params.chatId,
            messageId: message.id,
            query: data.content,
            sourcesUsed: orchestratorResult.sourcesUsed,
            sourcesSucceeded: orchestratorResult.sourcesSucceeded,
            sourcesFailed: orchestratorResult.sourcesFailed,
            latencyMs: orchestratorResult.latencyMs,
          });

          // SG-53: Log LLM interaction (prompt input) to central audit log
          writeAuditLog({
            userId,
            action: 'AI_QUERY',
            resource: 'chat',
            resourceId: req.params.chatId,
            ipAddress: extractIp(req),
            status: 'success',
            details: {
              promptLength: data.content.length,
              promptPreview: data.content.slice(0, 200),
              sourcesUsed: orchestratorResult.sourcesUsed,
            },
          }).catch(() => {});

          if (context.text && context.text.trim().length > 0) {
            for await (const chunk of streamFinancialAnalysis({
              query: data.content,
              conversationHistory: historyFormatted,
              multiSourceContext: multiSourcePrompt,
              citations: context.citations,
            })) {
              fullResponse += chunk;
            }
          } else {
            for await (const chunk of streamFinancialAnalysis({
              query: data.content,
              conversationHistory: historyFormatted,
            })) {
              fullResponse += chunk;
            }
          }

          if (context.chartBlock) {
            fullResponse += context.chartBlock;
          }

          const nonStreamMeta: Record<string, unknown> = {};
          if (context.citations.length > 0) nonStreamMeta.citations = context.citations;
          if (context.dataCoverage) nonStreamMeta.dataCoverage = context.dataCoverage;
          const assistantMessage = await storage.createMessage({
            chatId: req.params.chatId,
            content: fullResponse,
            role: "assistant",
            metadata: Object.keys(nonStreamMeta).length > 0 ? nonStreamMeta : null,
          });

          return res.status(201).json([message, assistantMessage]);
        } catch (aiError) {
          console.error("AI generation error:", aiError);
          const fallbackMessage = await storage.createMessage({
            chatId: req.params.chatId,
            content:
              "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
            role: "assistant",
          });

          return res.status(201).json([message, fallbackMessage]);
        }
      }

      res.status(201).json([message]);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });

  // SSE Streaming endpoint for real-time AI responses (like ChatGPT)
  app.post("/api/chats/:chatId/messages/stream", async (req, res) => {
    const userId = (req.session?.userId ?? "");

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - please sign in" });
    }

    try {
      const chat = await storage.getChat(req.params.chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (chat.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Forbidden - you don't have access to this chat" });
      }

      const data = insertMessageSchema.parse({
        ...req.body,
        chatId: req.params.chatId,
      });

      // Optional pre-parsed query context forwarded from frontend (skips LLM intent re-parse)
      const incomingQueryContext: Record<string, any> | undefined = req.body.queryContext ?? undefined;

      // Save user message immediately
      const userMessage = await storage.createMessage(data);

      // Auto-update chat title from first user message if title is "New Analysis"
      if (data.role === "user" && chat.title === "New Analysis") {
        const messageCount = await storage.getChatMessageCount(
          req.params.chatId,
        );
        if (messageCount <= 1) {
          // Generate title from first message (first 50 chars)
          const newTitle =
            data.content.length > 50
              ? data.content.slice(0, 47) + "..."
              : data.content;
          await storage.updateChatTitle(req.params.chatId, newTitle);
          console.log(`Updated chat title to: ${newTitle}`);
        }
      }

      // Abort controller — cancelled when client disconnects (Stop button)
      const streamAbortController = new AbortController();
      req.on("close", () => streamAbortController.abort());

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
      res.flushHeaders();

      // Send user message ID first
      res.write(
        `data: ${JSON.stringify({ type: "user_message", message: userMessage })}\n\n`,
      );

      if (data.role === "user") {
        const conversationHistory = await storage.getMessages(
          req.params.chatId,
        );
        const historyFormatted = conversationHistory
          .filter((m) => m.id !== userMessage.id)
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        let fullResponse = "";
        let citations: string[] = [];

        try {
          // Get context from orchestrator
          const orchestratorResult = await queryOrchestrator.query({
            query: data.content,
            chatId: req.params.chatId,
            userId,
            db: storage.db,
            queryContext: incomingQueryContext,
          });

          const rankedEvidence = evidenceBroker.rankEvidence(
            orchestratorResult.evidence,
          );
          const context = evidenceBroker.buildContext(rankedEvidence, data.content);
          const multiSourcePrompt = evidenceBroker.generatePromptWithCitations(
            data.content,
            context,
            orchestratorResult.queryType,
          );
          citations = context.citations;

          // Log query audit
          await storage.createQueryAudit({
            chatId: req.params.chatId,
            messageId: userMessage.id,
            query: data.content,
            sourcesUsed: orchestratorResult.sourcesUsed,
            sourcesSucceeded: orchestratorResult.sourcesSucceeded,
            sourcesFailed: orchestratorResult.sourcesFailed,
            latencyMs: orchestratorResult.latencyMs,
          });

          // Signal that streaming is starting
          res.write(`data: ${JSON.stringify({ type: "stream_start" })}\n\n`);

          // Look up domain AI config for this user (determines Azure vs Ollama)
          let domainAiConfig: DomainAiConfig | undefined;
          try {
            const currentUser = await storage.getUser(userId);
            const emailToLookup = currentUser?.email || currentUser?.username;
            if (emailToLookup) {
              const domainUser = await storage.getDomainUserByEmail(emailToLookup);
              if (domainUser?.domainId) {
                const domain = await storage.getDomain(domainUser.domainId);
                const isAzureKeyless1 = domain?.aiAuthMethod === 'entra_id' || domain?.aiAuthMethod === 'private_endpoint';
                if (domain?.aiProvider === 'azure_openai' && domain.aiEndpoint && (isAzureKeyless1 || domain.aiApiKey)) {
                  domainAiConfig = {
                    provider: 'azure_openai',
                    authMethod: (domain.aiAuthMethod as DomainAiConfig['authMethod']) || 'api_key',
                    endpoint: domain.aiEndpoint,
                    apiKey: domain.aiApiKey ? decryptValue(domain.aiApiKey) : undefined,
                    chatModel: domain.aiChatModel || undefined,
                    chatApiVersion: domain.aiChatApiVersion || undefined,
                    systemPrompt: domain.aiSystemPrompt || undefined,
                  };
                  console.log(`[AI Router] Using Azure OpenAI for domain ${domain.name} (model: ${domain.aiChatModel}, auth: ${domain.aiAuthMethod || 'api_key'})`);
                }
              }
            }
          } catch (configErr) {
            console.warn('[AI Router] Could not load domain AI config, falling back to Ollama:', configErr);
          }

          // Stream AI response
          const streamParams =
            context.text && context.text.trim().length > 0
              ? {
                  query: data.content,
                  conversationHistory: historyFormatted,
                  multiSourceContext: multiSourcePrompt,
                  citations: context.citations,
                  signal: streamAbortController.signal,
                  domainAiConfig,
                }
              : {
                  query: data.content,
                  conversationHistory: historyFormatted,
                  signal: streamAbortController.signal,
                  domainAiConfig,
                };

          for await (const chunk of streamFinancialAnalysis(streamParams)) {
            if (streamAbortController.signal.aborted) break;
            fullResponse += chunk;
            // Send each chunk as an SSE event and flush immediately
            res.write(
              `data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`,
            );
            // Force flush to prevent buffering - ensures real-time streaming
            if (typeof (res as any).flush === "function") {
              (res as any).flush();
            }
          }

          // If client stopped generation, skip saving and sending complete event
          if (streamAbortController.signal.aborted) {
            console.log(`Stream cancelled by client for chat ${req.params.chatId}`);
            return;
          }

          // Append server-generated chart block (bypasses LLM for reliable chart output)
          if (context.chartBlock) {
            fullResponse += context.chartBlock;
            res.write(
              `data: ${JSON.stringify({ type: "chunk", content: context.chartBlock })}\n\n`,
            );
            if (typeof (res as any).flush === "function") {
              (res as any).flush();
            }
          }

          // Save assistant message to database
          const msgMeta: Record<string, unknown> = {};
          if (citations.length > 0) msgMeta.citations = citations;
          if (context.tableData) msgMeta.tableData = context.tableData;
          if (context.tableSections) msgMeta.tableSections = context.tableSections;
          if (context.dataCoverage) msgMeta.dataCoverage = context.dataCoverage;
          if (orchestratorResult.queryContext) msgMeta.queryContext = orchestratorResult.queryContext;
          const assistantMessage = await storage.createMessage({
            chatId: req.params.chatId,
            content: fullResponse,
            role: "assistant",
            metadata: Object.keys(msgMeta).length > 0 ? msgMeta : null,
          });

          // Send completion event with full message
          res.write(
            `data: ${JSON.stringify({
              type: "complete",
              message: assistantMessage,
            })}\n\n`,
          );
        } catch (aiError: any) {
          if (streamAbortController.signal.aborted) {
            console.log(`Stream cancelled by client for chat ${req.params.chatId}`);
            return;
          }
          console.error("AI streaming error:", aiError);
          const fallbackMessage = await storage.createMessage({
            chatId: req.params.chatId,
            content:
              "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
            role: "assistant",
          });

          res.write(
            `data: ${JSON.stringify({
              type: "error",
              message: fallbackMessage,
            })}\n\n`,
          );
        }
      }

      // Send done event BEFORE closing connection
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      // Small delay to ensure event is flushed
      await new Promise((resolve) => setTimeout(resolve, 100));
      res.end();
    } catch (error) {
      console.error("Streaming error:", error);
      if (!res.headersSent) {
        res.status(400).json({ error: "Invalid message data" });
      } else {
        // Always send error event before closing
        try {
          res.write(
            `data: ${JSON.stringify({ type: "error", error: "Invalid message data" })}\n\n`,
          );
          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (e) {
          // Ignore write errors if connection already closed
        }
        res.end();
      }
    }
  });

  // Chat-Document Association Routes
  app.get("/api/chats/:chatId/documents", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const documents = await storage.getChatDocuments(req.params.chatId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chat documents" });
    }
  });

  app.get("/api/chats/:chatId/has-messages", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      // Verify chat exists and belongs to user
      const chat = await storage.getChat(req.params.chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const messageCount = await storage.getChatMessageCount(req.params.chatId);
      res.json({ hasMessages: messageCount > 0, messageCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to check chat messages" });
    }
  });

  app.post("/api/chats/:chatId/documents", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      // Support both single documentId (old behavior) and documentIds array (new behavior)
      const { documentId, documentIds } = req.body;

      // Verify chat exists and belongs to user
      const chat = await storage.getChat(req.params.chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Look up domain AI config so Python uses the right embedding provider
      let vaultAiConfig: Record<string, string> | null = null;
      try {
        const currentUser = await storage.getUser(userId);
        const emailToLookupVault = currentUser?.email || currentUser?.username;
        if (emailToLookupVault) {
          const domainUser = await storage.getDomainUserByEmail(emailToLookupVault);
          if (domainUser?.domainId) {
            const domain = await storage.getDomain(domainUser.domainId);
            const isAzureKeylessVault = domain?.aiAuthMethod === 'entra_id' || domain?.aiAuthMethod === 'private_endpoint';
            if (domain?.aiProvider === 'azure_openai' && domain.aiEndpoint && (isAzureKeylessVault || domain.aiApiKey)) {
              vaultAiConfig = {
                provider: 'azure_openai',
                auth_method: domain.aiAuthMethod || 'api_key',
                endpoint: domain.aiEndpoint,
                ...(domain.aiApiKey ? { api_key: decryptValue(domain.aiApiKey) } : {}),
                chat_model: domain.aiChatModel || '',
                chat_api_version: domain.aiChatApiVersion || '2024-12-01-preview',
                embedding_model: domain.aiEmbeddingModel || '',
                embedding_api_version: domain.aiEmbeddingApiVersion || '2024-02-01',
              };
            }
          }
        }
      } catch (_) { /* fallback to Python's get_default_ai_config() */ }

      // Handle bulk replacement (new behavior)
      if (documentIds !== undefined) {
        if (!Array.isArray(documentIds)) {
          return res
            .status(400)
            .json({ error: "documentIds must be an array" });
        }

        // Delete all existing document associations for this chat
        await storage.deleteChatDocuments(req.params.chatId);

        // Add new document associations
        for (const docId of documentIds) {
          await storage.associateDocumentWithChat(req.params.chatId, docId);

          // Trigger document processing in the background
          const document = await storage.getDocument(docId);
          if (document && document.filePath) {
            fetch(`http://localhost:8000/api/v2/documents/process/${docId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ file_path: document.filePath, ai_config: vaultAiConfig }),
            }).catch((err) =>
              console.error(
                `Failed to trigger processing for document ${docId}:`,
                err,
              ),
            );
          }
        }

        return res
          .status(200)
          .json({ success: true, count: documentIds.length });
      }

      // Handle single document (old behavior - for backward compatibility)
      if (!documentId) {
        return res
          .status(400)
          .json({ error: "Document ID or documentIds required" });
      }

      // Associate document with chat
      await storage.associateDocumentWithChat(req.params.chatId, documentId);

      // Trigger document processing in the background
      const document = await storage.getDocument(documentId);
      if (document && document.filePath) {
        fetch(`http://localhost:8000/api/v2/documents/process/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: document.filePath, ai_config: vaultAiConfig }),
        }).catch((err) =>
          console.error(
            `Failed to trigger processing for document ${documentId}:`,
            err,
          ),
        );
      }

      res.status(201).json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to associate document with chat" });
    }
  });

  app.get("/api/documents", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const documents = await storage.getDocuments(userId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/vault/stats", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const stats = await storage.getVaultStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Vault stats error:", error);
      res.status(500).json({ error: "Failed to fetch vault statistics" });
    }
  });

  app.post("/api/documents", upload.single("file"), async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Gate 3 — magic-byte validation (checks actual file content vs declared MIME)
      const magicOk = await validateFileMagicBytes(req.file.path, req.file.mimetype);
      if (!magicOk) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: "File content does not match its declared type. Upload rejected.",
        });
      }

      // Gate 4 — server-side size cap (100 MB for vault/chat uploads).
      // The global multer ceiling is 500 MB (covers Enterprise); enforce the
      // tighter Vault/Chat limit here so the server rejects oversized files
      // regardless of what the client allows through.
      const VAULT_MAX_BYTES = 100 * 1024 * 1024;
      if (req.file.size > VAULT_MAX_BYTES) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(413).json({ error: 'File too large. Maximum upload size is 100 MB.' });
      }

      // Sanitise the display name stored in DB (never use raw originalname)
      const safeName = sanitiseFilename(req.file.originalname);

      const document = await storage.createDocument({
        userId,
        name: safeName,
        filePath: req.file.filename,
        fileSize: req.file.size.toString(),
        fileType: req.file.mimetype,
      });

      writeAuditLog({
        userId:     userId,
        action:     "FILE_UPLOAD",
        resource:   "document",
        resourceId: document.id,
        ipAddress:  extractIp(req),
        status:     "success",
        details:    { fileName: safeName, fileSize: req.file.size, mimeType: req.file.mimetype },
      }).catch(() => {});

      res.status(201).json(document);
    } catch (error) {
      console.error("Document upload error:", error);
      res
        .status(400)
        .json({
          error: "Failed to upload document",
        });
    }
  });

  app.post("/api/documents/import-from-url", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const { url, driveType } = req.body;

      if (!url || !driveType) {
        return res
          .status(400)
          .json({ error: "URL and drive type are required" });
      }

      // Security: Validate URL format, hostname, and protocol
      let downloadUrl: string;
      let fileName: string;
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit
      const ALLOWED_MIME_TYPES = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/csv",
        "text/plain",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/bmp",
        "image/gif",
      ];

      try {
        const parsedUrl = new URL(url);

        // Enforce HTTPS only
        if (parsedUrl.protocol !== "https:") {
          throw new Error("Only HTTPS URLs are allowed");
        }

        if (driveType === "google_drive") {
          // Google Drive: strict hostname and path validation
          if (
            !["drive.google.com", "docs.google.com"].includes(
              parsedUrl.hostname,
            )
          ) {
            throw new Error("Invalid Google Drive hostname");
          }

          const fileIdMatch = parsedUrl.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (!fileIdMatch) {
            throw new Error("Invalid Google Drive URL format");
          }
          const fileId = fileIdMatch[1];
          downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
          fileName = `google-drive-${fileId}`;
        } else if (driveType === "onedrive") {
          // OneDrive: strict hostname validation
          const allowedOneDriveHosts = ["1drv.ms", "onedrive.live.com"];
          const allowedSharePointDomains = [".sharepoint.com"];

          const isValidHost =
            allowedOneDriveHosts.includes(parsedUrl.hostname) ||
            allowedSharePointDomains.some((domain) =>
              parsedUrl.hostname.endsWith(domain),
            );

          if (!isValidHost) {
            throw new Error("Invalid OneDrive/SharePoint hostname");
          }

          downloadUrl = url.replace("?", "/download?");
          fileName = `onedrive-${Date.now()}`;
        } else if (driveType === "dropbox") {
          // Dropbox: strict hostname validation
          if (
            ![
              "www.dropbox.com",
              "dropbox.com",
              "dl.dropboxusercontent.com",
            ].includes(parsedUrl.hostname)
          ) {
            throw new Error("Invalid Dropbox hostname");
          }

          downloadUrl = url.replace("dl=0", "dl=1");
          if (!downloadUrl.includes("dl=1")) {
            downloadUrl = downloadUrl + (url.includes("?") ? "&dl=1" : "?dl=1");
          }
          fileName = `dropbox-${Date.now()}`;
        } else {
          throw new Error("Unsupported drive type");
        }
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Invalid URL format",
        });
      }

      // Security: HEAD request first to validate file before download
      const headResponse = await fetch(downloadUrl, {
        method: "HEAD",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LedgerLM/1.0)",
        },
        redirect: "follow",
      });

      if (!headResponse.ok) {
        throw new Error(`File not accessible: ${headResponse.statusText}`);
      }

      // Validate content-length before download
      const contentLength = headResponse.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
        return res.status(400).json({
          error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        });
      }

      // Validate content-type
      const contentType = headResponse.headers.get("content-type") || "";

      // Detect HTML responses (error pages)
      if (contentType.includes("text/html")) {
        throw new Error(
          "Received HTML instead of file - check if URL requires authentication or has expired",
        );
      }

      // Validate against allowed MIME types
      const isAllowedType = ALLOWED_MIME_TYPES.some((type) =>
        contentType.includes(type),
      );
      if (!isAllowedType && contentType !== "application/octet-stream") {
        return res.status(400).json({
          error: `Unsupported file type: ${contentType}`,
        });
      }

      // Download file with streaming to prevent memory exhaustion
      const response = await fetch(downloadUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LedgerLM/1.0)",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get("content-disposition");
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
        );
        if (filenameMatch && filenameMatch[1]) {
          fileName = filenameMatch[1].replace(/['"]/g, "");
        }
      }

      // Add extension based on content type if needed
      if (
        fileName.startsWith("google-drive-") ||
        fileName.startsWith("onedrive-") ||
        fileName.startsWith("dropbox-")
      ) {
        const ext = contentType.includes("pdf")
          ? ".pdf"
          : contentType.includes("sheet") || contentType.includes("excel")
            ? ".xlsx"
            : contentType.includes("word") || contentType.includes("document")
              ? ".docx"
              : contentType.includes("text/csv")
                ? ".csv"
                : contentType.includes("text/plain")
                  ? ".txt"
                  : contentType.includes("image/png")
                    ? ".png"
                    : contentType.includes("image/jpeg") ||
                        contentType.includes("image/jpg")
                      ? ".jpg"
                      : "";
        fileName = fileName + ext;
      }

      // Generate unique filename
      const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString("hex")}`;
      const safeFileName = `${uniqueSuffix}-${fileName}`;
      const filePath = path.join(uploadDir, safeFileName);

      // Stream to disk with size limit enforcement
      const { Readable } = await import("stream");
      const { createWriteStream } = await import("fs");
      const { pipeline } = await import("stream/promises");

      const writeStream = createWriteStream(filePath);
      let downloadedBytes = 0;

      // Convert Web ReadableStream to Node.js Readable
      const nodeStream = Readable.fromWeb(response.body as any);

      // Create a transform stream to enforce size limits
      const { Transform } = await import("stream");
      const sizeLimitTransform = new Transform({
        transform(chunk, encoding, callback) {
          downloadedBytes += chunk.length;

          if (downloadedBytes > MAX_FILE_SIZE) {
            callback(
              new Error(
                `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
              ),
            );
            return;
          }

          callback(null, chunk);
        },
      });

      try {
        await pipeline(nodeStream, sizeLimitTransform, writeStream);
      } catch (error) {
        // Clean up partial file on error
        await fs.unlink(filePath).catch(() => {});

        if (
          error instanceof Error &&
          error.message.includes("exceeds maximum size")
        ) {
          return res.status(400).json({ error: error.message });
        }
        throw error;
      }

      // Get final file size
      const stats = await fs.stat(filePath);

      // Final content-type validation on actual file would go here
      // For now, trust the header validation

      // Create document record with cloud source info
      const document = await storage.createDocument({
        userId,
        name: fileName,
        filePath: safeFileName,
        fileSize: stats.size.toString(),
        fileType: contentType,
        cloudSource: driveType,
        cloudFileId:
          driveType === "google_drive"
            ? downloadUrl.match(/id=([^&]+)/)?.[1]
            : undefined,
        cloudUrl: url,
      });

      // Trigger automatic processing
      fetch(
        `http://localhost:${process.env.PYTHON_PORT || 8000}/api/v2/process`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: document.filePath }),
        },
      ).catch((err) => console.error("Failed to trigger processing:", err));

      res.status(201).json({
        success: true,
        document: {
          id: document.id,
          name: document.name,
          fileSize: document.fileSize,
        },
      });
    } catch (error) {
      console.error("Import from URL error:", error);
      res.status(400).json({
        error: "Failed to import document",
      });
    }
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.userId !== userId) {
        return res
          .status(403)
          .json({
            error: "Forbidden - you don't have access to this document",
          });
      }

      const filePath = path.join(uploadDir, document.filePath);

      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: "File not found on disk" });
      }

      res.download(filePath, document.name);
    } catch (error) {
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.userId !== userId) {
        return res
          .status(403)
          .json({
            error: "Forbidden - you don't have access to this document",
          });
      }

      const filePath = path.join(uploadDir, document.filePath);

      try {
        await fs.unlink(filePath);
      } catch {
        // File may not exist, continue with database deletion
      }

      await storage.deleteDocument(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Data Sources Management Routes
  app.get("/api/sources", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const { dataSources } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const sources = await storage.db
        .select()
        .from(dataSources)
        .where(eq(dataSources.userId, userId));

      res.json(sources);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch data sources" });
    }
  });

  app.post("/api/sources/google-search", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const { dataSources } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const existing = await storage.db
        .select()
        .from(dataSources)
        .where(
          and(
            eq(dataSources.userId, userId),
            eq(dataSources.type, "google_search"),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return res.json(existing[0]);
      }

      const newSource = await storage.db
        .insert(dataSources)
        .values({
          userId,
          type: "google_search",
          label: "Google Search",
          config: { enabled: true },
          status: "active",
        })
        .returning();

      res.status(201).json(newSource[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to create Google Search source" });
    }
  });

  app.post("/api/chats/:chatId/sources", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const chat = await storage.getChat(req.params.chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (chat.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { sourceId, enabled } = req.body;
      if (!sourceId) {
        return res.status(400).json({ error: "sourceId is required" });
      }

      const { chatSources, dataSources } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const source = await storage.db
        .select()
        .from(dataSources)
        .where(eq(dataSources.id, sourceId))
        .limit(1);

      if (source.length === 0) {
        return res.status(404).json({ error: "Source not found" });
      }

      if (source[0].userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const existing = await storage.db
        .select()
        .from(chatSources)
        .where(
          and(
            eq(chatSources.chatId, req.params.chatId),
            eq(chatSources.sourceId, sourceId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await storage.db
          .update(chatSources)
          .set({ enabled: enabled ? 1 : 0 })
          .where(eq(chatSources.id, existing[0].id));
      } else {
        await storage.db.insert(chatSources).values({
          chatId: req.params.chatId,
          sourceId,
          enabled: enabled ? 1 : 0,
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update chat sources" });
    }
  });

  // Python Backend Proxy Routes
  const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

  app.post("/api/documents/:id/process", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.userId !== userId) {
        return res
          .status(403)
          .json({
            error: "Forbidden - you don't have access to this document",
          });
      }

      const filePath = path.join(uploadDir, document.filePath);

      // Look up user's domain AI config so Python embeds with the right provider
      let processAiConfig: Record<string, string> | null = null;
      try {
        const currentUser = await storage.getUser(userId);
        const emailToLookupProc = currentUser?.email || currentUser?.username;
        if (emailToLookupProc) {
          const domainUser = await storage.getDomainUserByEmail(emailToLookupProc);
          if (domainUser?.domainId) {
            const domain = await storage.getDomain(domainUser.domainId);
            const isAzureKeylessProc = domain?.aiAuthMethod === 'entra_id' || domain?.aiAuthMethod === 'private_endpoint';
            if (domain?.aiProvider === 'azure_openai' && domain.aiEndpoint && (isAzureKeylessProc || domain.aiApiKey)) {
              processAiConfig = {
                provider: 'azure_openai',
                auth_method: domain.aiAuthMethod || 'api_key',
                endpoint: domain.aiEndpoint,
                ...(domain.aiApiKey ? { api_key: decryptValue(domain.aiApiKey) } : {}),
                chat_model: domain.aiChatModel || '',
                chat_api_version: domain.aiChatApiVersion || '2024-12-01-preview',
                embedding_model: domain.aiEmbeddingModel || '',
                embedding_api_version: domain.aiEmbeddingApiVersion || '2024-02-01',
              };
            }
          }
        }
      } catch (_) { /* fallback to Python's get_default_ai_config() */ }

      const response = await fetch(
        `${PYTHON_API_URL}/api/v2/documents/process/${req.params.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: filePath, ai_config: processAiConfig }),
        },
      );

      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to start document processing" });
    }
  });

  app.get("/api/documents/:id/status", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.userId !== userId) {
        return res
          .status(403)
          .json({
            error: "Forbidden - you don't have access to this document",
          });
      }

      const response = await fetch(
        `${PYTHON_API_URL}/api/v2/documents/${req.params.id}/status`,
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document status" });
    }
  });

  app.get("/api/documents/:id/sessions", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.userId !== userId) {
        return res
          .status(403)
          .json({
            error: "Forbidden - you don't have access to this document",
          });
      }

      const sessionCount = await storage.getDocumentSessionCount(req.params.id);
      res.json({ count: sessionCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document session count" });
    }
  });

  app.post("/api/rag/analyze", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const response = await fetch(`${PYTHON_API_URL}/api/v2/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to perform RAG analysis" });
    }
  });

  app.post("/api/search", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const response = await fetch(`${PYTHON_API_URL}/api/v2/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to perform semantic search" });
    }
  });

  app.get("/api/boards", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const boards = await storage.getBoards(userId);
      res.json(boards);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch boards" });
    }
  });

  app.get("/api/boards/:id", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }

      if (board.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Forbidden - you don't have access to this board" });
      }

      res.json(board);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch board" });
    }
  });

  app.post("/api/boards", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const data = insertBoardSchema.parse({
        ...req.body,
        userId,
      });

      const board = await storage.createBoard(data);
      res.status(201).json(board);
    } catch (error) {
      res.status(400).json({ error: "Invalid board data" });
    }
  });

  app.delete("/api/boards/:id", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }

      if (board.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Forbidden - you don't have access to this board" });
      }

      await storage.deleteBoard(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete board" });
    }
  });

  // ── PUT /api/boards/:id — fix missing update route ────────────────────────
  app.put("/api/boards/:id", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const board = await storage.getBoard(req.params.id);
      if (!board) return res.status(404).json({ error: "Board not found" });
      if (board.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      const { title, description, templateId, settings } = req.body;
      const updated = await storage.updateBoard(req.params.id, {
        title:      title      ?? board.title,
        description: description ?? board.description,
        templateId:  templateId  ?? board.templateId,
        settings:    settings    ?? board.settings,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update board" });
    }
  });

  // ── GET /api/cubes/:cubeId/versions — available version values in a cube ──
  app.get("/api/cubes/:cubeId/versions", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const versions = await getCubeVersions(req.params.cubeId);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cube versions" });
    }
  });

  // ── GET /api/boards/:id/preview-data — lightweight data check + dimension values ──
  app.get("/api/boards/:id/preview-data", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      const settings = (board.settings as any) ?? {};
      const cubeId: string = settings.cubeId;
      if (!cubeId) return res.status(400).json({ error: "No cube configured on this board" });

      const columnMapping = settings.columnMapping;
      if (!columnMapping?.actuals || !columnMapping?.budget) {
        return res.status(400).json({ error: "Column mapping (actuals + budget) required" });
      }

      const year   = Number(req.query.year);
      const months = String(req.query.months || '').split(',').map(Number).filter(Boolean);
      if (!year || months.length === 0) return res.status(400).json({ error: "year and months are required" });

      const preview = await previewBoardData({ cubeId, columnMapping, year, months });
      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to fetch preview data" });
    }
  });

  // ── POST /api/boards/:id/reports/:reportId/follow-up — quick-intent chat ──
  app.post("/api/boards/:id/reports/:reportId/follow-up", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      // Fetch the report
      const reportRows = await db
        .select()
        .from(cubeBoardReports)
        .where(sql`id = ${req.params.reportId} AND board_id = ${req.params.id}`)
        .limit(1);
      if (reportRows.length === 0) return res.status(404).json({ error: "Report not found" });
      const report = reportRows[0];

      const intent = req.body.intent as string;
      const intentDef = FOLLOW_UP_INTENTS[intent];
      if (!intentDef) return res.status(400).json({ error: `Unknown intent: ${intent}` });

      // Build context for the seeded chat message
      const mapping = (report.columnMapping as any) ?? {};
      const summary = report.rawAnalysis
        ? report.rawAnalysis.slice(0, 800) + (report.rawAnalysis.length > 800 ? '\n\n[... report continues ...]' : '')
        : 'No analysis content available.';

      const contextBlock = `You are continuing an analysis of board: "${board.title}".

**Report context:**
- Period: ${report.periodLabel}${report.comparisonPeriodLabel ? ` (compared to ${report.comparisonPeriodLabel})` : ''}
- Actuals column: ${mapping.actuals ?? 'N/A'}
- Budget column: ${mapping.budget ?? 'N/A'}
- Dimensions analysed: ${(report.dimensions as string[] | null)?.join(', ') ?? 'N/A'}

**Report summary (excerpt):**
${summary}

---
**Your specific question:**
${intentDef.question}`;

      // Create the linked chat + seed it with the context message
      const chatTitle = `${intentDef.icon} ${intentDef.label} — ${report.periodLabel}`;
      const chat = await storage.createChat({ userId, title: chatTitle });

      // Insert a seeded user message so the context is pre-loaded when opened
      await storage.createMessage({ chatId: chat.id, role: 'user', content: contextBlock });

      // Link it to the board as a thread
      await storage.addBoardThread({ boardId: req.params.id, chatId: chat.id });

      res.status(201).json({ chatId: chat.id });
    } catch (error: any) {
      console.error("follow-up error:", error);
      res.status(500).json({ error: error?.message || "Failed to create follow-up chat" });
    }
  });

  // ── GET /api/boards/:id/reports — list reports for a board ────────────────
  app.get("/api/boards/:id/reports", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      const reports = await db
        .select()
        .from(cubeBoardReports)
        .where(eq(cubeBoardReports.boardId, req.params.id))
        .orderBy(desc(cubeBoardReports.createdAt));
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch board reports" });
    }
  });

  // ── POST /api/boards/:id/run-analysis — generate a Smart Board report ─────
  app.post("/api/boards/:id/run-analysis", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      const settings = (board.settings as any) ?? {};
      const cubeId: string = settings.cubeId;
      if (!cubeId) return res.status(400).json({ error: "No data cube configured on this board. Edit the board and select a cube first." });

      const columnMapping = settings.columnMapping;
      if (!columnMapping?.actuals || !columnMapping?.budget) {
        return res.status(400).json({ error: "Column mapping (actuals + budget) is required. Edit the board to configure it." });
      }

      const { year, months, userPromptTemplate, extraContext } = req.body;
      if (!year || !months?.length) return res.status(400).json({ error: "year and months are required" });

      // Look up domain AI config for the requesting user
      let domainAiConfig: DomainAiConfig | undefined;
      try {
        const domainUser = await db.execute(
          sql`SELECT du.domain_id FROM domain_users du WHERE du.user_id = ${userId} LIMIT 1`
        );
        const domainId = (domainUser.rows?.[0] as any)?.domain_id;
        if (domainId) {
          const domainRow = await db.execute(
            sql`SELECT ai_provider, ai_auth_method, ai_endpoint, ai_api_key, ai_chat_model, ai_chat_api_version, ai_system_prompt
                FROM domains WHERE id = ${domainId} LIMIT 1`
          );
          const d = domainRow.rows?.[0] as any;
          const isKeyless2 = d?.ai_auth_method === 'entra_id' || d?.ai_auth_method === 'private_endpoint';
          if (d?.ai_provider === 'azure_openai' && d?.ai_endpoint && (isKeyless2 || d?.ai_api_key)) {
            domainAiConfig = {
              provider: 'azure_openai',
              authMethod: (d.ai_auth_method as DomainAiConfig['authMethod']) || 'api_key',
              endpoint: d.ai_endpoint,
              apiKey: d.ai_api_key ? decryptValue(d.ai_api_key) : undefined,
              chatModel: d.ai_chat_model,
              chatApiVersion: d.ai_chat_api_version,
              systemPrompt: d.ai_system_prompt,
            };
          }
        }
      } catch { /* fall back to default AI */ }

      const dimensions: string[] = req.body.dimensions ?? ['Entity', 'Sector', 'Cost Category'];

      const report = await runBoardAnalysis({
        boardId:             req.params.id,
        cubeId,
        columnMapping,
        year:                Number(year),
        months:              (months as number[]).map(Number),
        dimensions,
        systemPromptTemplate: settings.analysisPrompts || '',
        userPromptTemplate:   userPromptTemplate || '',
        extraContext:         extraContext || '',
        domainAiConfig,
      });

      res.status(201).json(report);
    } catch (error: any) {
      console.error("run-analysis error:", error);
      res.status(500).json({ error: error?.message || "Failed to run analysis" });
    }
  });

  // ── DELETE /api/boards/:id/reports/:reportId ──────────────────────────────
  app.delete("/api/boards/:id/reports/:reportId", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      await db
        .delete(cubeBoardReports)
        .where(
          sql`id = ${req.params.reportId} AND board_id = ${req.params.id}`
        );
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  app.get("/api/board-templates", async (_req, res) => {
    try {
      const templates = await storage.getBoardTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch board templates" });
    }
  });

  app.post("/api/board-templates", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const template = await storage.createBoardTemplate(req.body);
      res.status(201).json(template);
    } catch (error) {
      console.error("Failed to create template:", error);
      res.status(400).json({ error: "Failed to create template" });
    }
  });

  app.put("/api/board-templates/:id", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const template = await storage.updateBoardTemplate(
        req.params.id,
        req.body,
      );
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Failed to update template:", error);
      res.status(400).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/board-templates/:id", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      await storage.deleteBoardTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  app.post("/api/templates/:id/use", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const template = await storage.getBoardTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const defaultConfig = template.defaultConfig as any;
      const analysisPrompts = defaultConfig?.analysisPrompts || "";
      const dataSources = defaultConfig?.dataSources || {};

      const chat = await storage.createChat({
        userId,
        title: template.name,
        preview: template.description,
      });

      if (analysisPrompts) {
        await storage.createMessage({
          chatId: chat.id,
          content: analysisPrompts,
          role: "assistant",
          metadata: {
            isTemplateSeeded: true,
            templateId: template.id,
            dataSources,
          },
        });
      }

      res.status(201).json({
        chatId: chat.id,
        template: {
          name: template.name,
          dataSources,
        },
      });
    } catch (error) {
      console.error("Failed to use template:", error);
      res.status(500).json({ error: "Failed to create chat from template" });
    }
  });

  app.get("/api/boards/:id/threads", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const threads = await storage.getBoardThreads(req.params.id);
      res.json(threads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch board threads" });
    }
  });

  app.post("/api/boards/:id/threads", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { chatId } = req.body;
      const thread = await storage.addBoardThread({
        boardId: req.params.id,
        chatId,
      });
      res.status(201).json(thread);
    } catch (error) {
      res.status(400).json({ error: "Failed to add thread to board" });
    }
  });

  app.delete("/api/boards/:id/threads/:chatId", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.removeBoardThread(req.params.id, req.params.chatId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove thread from board" });
    }
  });

  app.get("/api/boards/:id/documents", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const documents = await storage.getBoardDocuments(req.params.id);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch board documents" });
    }
  });

  app.post("/api/boards/:id/documents", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { documentId } = req.body;
      const boardDoc = await storage.addBoardDocument({
        boardId: req.params.id,
        documentId,
      });
      res.status(201).json(boardDoc);
    } catch (error) {
      res.status(400).json({ error: "Failed to add document to board" });
    }
  });

  app.delete("/api/boards/:id/documents/:documentId", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.removeBoardDocument(req.params.id, req.params.documentId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove document from board" });
    }
  });

  app.get("/api/boards/:id/data-sources", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const dataSources = await storage.getBoardDataSources(req.params.id);
      res.json(dataSources);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch board data sources" });
    }
  });

  app.post("/api/boards/:id/data-sources", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const dataSource = await storage.createBoardDataSource({
        ...req.body,
        boardId: req.params.id,
      });
      res.status(201).json(dataSource);
    } catch (error) {
      res.status(400).json({ error: "Failed to create board data source" });
    }
  });

  app.patch("/api/boards/:id/data-sources/:sourceId", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const dataSource = await storage.updateBoardDataSource(
        req.params.sourceId,
        req.body,
      );
      if (!dataSource) {
        return res.status(404).json({ error: "Data source not found" });
      }
      res.json(dataSource);
    } catch (error) {
      res.status(400).json({ error: "Failed to update board data source" });
    }
  });

  app.delete("/api/boards/:id/data-sources/:sourceId", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deleteBoardDataSource(req.params.sourceId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete board data source" });
    }
  });

  app.post("/api/boards/:id/data-sources/reorder", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const board = await storage.getBoard(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { sourceIds } = req.body;
      await storage.reorderBoardDataSources(req.params.id, sourceIds);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to reorder board data sources" });
    }
  });

  app.get(
    "/api/admin/companies/:companyId/documents",
    requireAdmin,
    async (req, res) => {
      try {
        const adminCompanyId = (req as any).adminCompanyId;

        if (req.params.companyId !== adminCompanyId) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You can only access your own company's documents",
          });
        }

        const documents = await storage.getEnterpriseDocuments(
          req.params.companyId,
        );
        res.json(documents);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch enterprise documents" });
      }
    },
  );

  app.post(
    "/api/admin/companies/:companyId/documents",
    requireAdmin,
    upload.array("files", 10),
    async (req, res) => {
      try {
        const adminCompanyId = (req as any).adminCompanyId;
        const userId = (req.session?.userId ?? "");
        const files = req.files as Express.Multer.File[];

        if (req.params.companyId !== adminCompanyId) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You can only upload to your own company",
          });
        }

        if (!files || files.length === 0) {
          return res.status(400).json({ error: "No files uploaded" });
        }

        // Gate 3 — magic-byte validation for every file; reject and delete any that fail
        const validFiles: Express.Multer.File[] = [];
        const rejectedNames: string[] = [];
        for (const file of files) {
          const magicOk = await validateFileMagicBytes(file.path, file.mimetype);
          if (!magicOk) {
            await fs.unlink(file.path).catch(() => {});
            rejectedNames.push(file.originalname);
          } else {
            validFiles.push(file);
          }
        }
        if (rejectedNames.length > 0 && validFiles.length === 0) {
          return res.status(400).json({
            error: "All uploaded files were rejected — content does not match declared type.",
            rejected: rejectedNames,
          });
        }

        const documents = await Promise.all(
          validFiles.map((file) =>
            storage.createEnterpriseDocument({
              companyId: req.params.companyId,
              uploadedBy: userId,
              name: sanitiseFilename(file.originalname),
              filePath: file.filename,
              fileSize: file.size.toString(),
              fileType: file.mimetype,
            }),
          ),
        );

        res.status(201).json(documents);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to upload enterprise documents" });
      }
    },
  );

  app.post(
    "/api/admin/companies/:companyId/documents/:id/process",
    requireAdmin,
    async (req, res) => {
      try {
        const adminCompanyId = (req as any).adminCompanyId;

        if (req.params.companyId !== adminCompanyId) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You can only process your own company's documents",
          });
        }

        const document = await storage.getEnterpriseDocument(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        if (document.companyId !== req.params.companyId) {
          return res
            .status(403)
            .json({ error: "Document doesn't belong to this company" });
        }

        const filePath = path.join(uploadDir, document.filePath);

        const response = await fetch(
          `${PYTHON_API_URL}/api/v2/enterprise/process/${req.params.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_path: filePath,
              company_id: req.params.companyId,
            }),
          },
        );

        const data = await response.json();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: "Failed to start document processing" });
      }
    },
  );

  app.get(
    "/api/admin/companies/:companyId/documents/:id/status",
    requireAdmin,
    async (req, res) => {
      try {
        const adminCompanyId = (req as any).adminCompanyId;

        if (req.params.companyId !== adminCompanyId) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You can only access your own company's documents",
          });
        }

        const document = await storage.getEnterpriseDocument(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        if (document.companyId !== req.params.companyId) {
          return res
            .status(403)
            .json({ error: "Document doesn't belong to this company" });
        }

        const response = await fetch(
          `${PYTHON_API_URL}/api/v2/enterprise/${req.params.id}/status`,
        );
        const data = await response.json();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch document status" });
      }
    },
  );

  app.delete(
    "/api/admin/companies/:companyId/documents/:id",
    requireAdmin,
    async (req, res) => {
      try {
        const adminCompanyId = (req as any).adminCompanyId;

        if (req.params.companyId !== adminCompanyId) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You can only delete your own company's documents",
          });
        }

        const document = await storage.getEnterpriseDocument(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        if (document.companyId !== req.params.companyId) {
          return res
            .status(403)
            .json({ error: "Document doesn't belong to this company" });
        }

        const filePath = path.join(uploadDir, document.filePath);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }

        await storage.deleteEnterpriseDocument(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete enterprise document" });
      }
    },
  );

  app.get("/api/user/settings", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      let settings = await storage.getUserSettings(userId);

      if (!settings) {
        const memberships = await storage.getUserCompanyMemberships(userId);
        settings = await storage.createUserSettings({
          userId,
          enterpriseEnabled: 0,
          activeCompanyId: memberships[0]?.companyId || null,
        });
      }

      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user settings" });
    }
  });

  app.patch("/api/user/settings", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      console.log(`📝 Updating user settings for ${userId}:`, req.body);

      const settings = await storage.updateUserSettings(userId, req.body);

      if (!settings) {
        return res.status(404).json({ error: "User settings not found" });
      }

      console.log(
        `✅ User settings updated - enterpriseEnabled: ${settings.enterpriseEnabled}`,
      );
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user settings" });
    }
  });

  // Get available data sources for standard users (display names only, no config)
  app.get("/api/user/data-sources", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      // Get user to find their email and look up domain membership
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Look up domain membership by email
      const domainUser = await storage.getDomainUserByEmail(user.username);
      if (!domainUser) {
        return res.json({ sources: [], userSourcePrefs: {} });
      }

      const domainId = domainUser.domainId;

      // Get enabled connectors for this domain (metadata only - no config)
      const connectors = await storage.getDomainApiConnectors(domainId);

      // Get user's connector preferences
      const userSettings = await storage.getUserSettings(userId);
      const userSourcePrefs: Record<string, boolean> =
        userSettings?.connectorPreferences
          ? JSON.parse(userSettings.connectorPreferences)
          : {};

      // Return only display-friendly info
      const sources = connectors
        .filter((c) => c.enabled === 1)
        .map((connector) => ({
          id: connector.id,
          connectorType: connector.connectorType,
          name: connector.name,
          tags: connector.tags || [],
          status: connector.status,
          documentCount: connector.documentCount || 0,
        }));

      res.json({ sources, userSourcePrefs });
    } catch (error: any) {
      console.error("Error fetching user data sources:", error);
      res.status(500).json({ error: "Failed to fetch data sources" });
    }
  });

  // Update user's data source preferences (which connectors are enabled for their AI sessions)
  app.patch("/api/user/data-sources/preferences", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const { connectorPreferences } = req.body;
      if (typeof connectorPreferences !== "object") {
        return res
          .status(400)
          .json({ error: "connectorPreferences must be an object" });
      }

      // Get user to find their email and look up domain membership
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Look up domain membership by email
      const domainUser = await storage.getDomainUserByEmail(user.username);
      if (!domainUser) {
        return res.status(403).json({ error: "User has no domain membership" });
      }

      const domainId = domainUser.domainId;
      const domainConnectors = await storage.getDomainApiConnectors(domainId);
      const validConnectorIds = new Set(domainConnectors.map((c) => c.id));

      // Filter to only valid connector IDs
      const validPrefs: Record<string, boolean> = {};
      for (const [id, enabled] of Object.entries(connectorPreferences)) {
        if (validConnectorIds.has(id)) {
          validPrefs[id] = enabled as boolean;
        }
      }

      const settings = await storage.updateUserSettings(userId, {
        connectorPreferences: JSON.stringify(validPrefs),
      });

      res.json({ success: true, connectorPreferences: validPrefs });
    } catch (error: any) {
      console.error("Error updating data source preferences:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // Get user's accessible cubes with saved preferences
  app.get("/api/user/accessible-cubes", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const email = user.username.toLowerCase();
      const domainUser = await storage.getDomainUserByEmail(email);
      if (!domainUser) {
        return res.json({ cubes: [], cubePreferences: {} });
      }

      const accessibleCubeIds = await storage.getAccessibleCubeIds(
        email,
        domainUser.domainId,
      );

      if (accessibleCubeIds.length === 0) {
        return res.json({ cubes: [], cubePreferences: {} });
      }

      // Get user's saved cube preferences
      const userSettingsRecord = await storage.getUserSettings(userId);
      const cubePreferences: Record<string, boolean> =
        userSettingsRecord?.cubePreferences
          ? JSON.parse(userSettingsRecord.cubePreferences)
          : {};

      const cubes = await storage.getCubes(domainUser.domainId);
      const filteredCubes = cubes.filter((cube) =>
        accessibleCubeIds.includes(cube.id),
      );

      // Get document counts for each cube
      const accessibleCubes = await Promise.all(
        filteredCubes.map(async (cube) => ({
          id: cube.id,
          name: cube.name,
          description: cube.description,
          sourceType: cube.sourceType,
          documentCount: await storage.getCubeDocumentCount(cube.id),
        })),
      );

      res.json({ cubes: accessibleCubes, cubePreferences });
    } catch (error: any) {
      console.error("Error fetching accessible cubes:", error);
      res.status(500).json({ error: "Failed to fetch accessible cubes" });
    }
  });

  // Update user's cube preferences (which cubes to include in queries)
  app.patch("/api/user/cube-preferences", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const { cubePreferences } = req.body;
      if (typeof cubePreferences !== "object") {
        return res
          .status(400)
          .json({ error: "cubePreferences must be an object" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const email = user.username.toLowerCase();
      const domainUser = await storage.getDomainUserByEmail(email);
      if (!domainUser) {
        return res.status(403).json({ error: "User has no domain membership" });
      }

      const accessibleCubeIds = await storage.getAccessibleCubeIds(
        email,
        domainUser.domainId,
      );
      const validCubeIds = new Set(accessibleCubeIds);

      const validPrefs: Record<string, boolean> = {};
      for (const [id, enabled] of Object.entries(cubePreferences)) {
        if (validCubeIds.has(id)) {
          validPrefs[id] = enabled as boolean;
        }
      }

      const settings = await storage.updateUserSettings(userId, {
        cubePreferences: JSON.stringify(validPrefs),
      });

      res.json({ success: true, cubePreferences: validPrefs });
    } catch (error: any) {
      console.error("Error updating cube preferences:", error);
      res.status(500).json({ error: "Failed to update cube preferences" });
    }
  });

  app.get("/api/companies", async (req, res) => {
    try {
      const userId = (req.session?.userId ?? "");
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized - please sign in" });
      }

      const memberships = await storage.getUserCompanyMemberships(userId);
      const companies = await Promise.all(
        memberships.map((m) => storage.getCompany(m.companyId)),
      );

      res.json(companies.filter(Boolean));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.post("/api/admin/invitations", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required" });
      }

      const { email } = req.body;
      if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return res.status(400).json({ error: "Valid email required" });
      }

      const token = await invitationService.createInvitation(email, userId);

      res.status(201).json({
        success: true,
        message: `Invitation sent to ${email}`,
        token,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/invitations", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const invitations = await invitationService.getPendingInvitations();
      res.json(invitations);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/admin/invitations/:id/resend", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      await invitationService.resendInvitation(req.params.id);
      res.json({ success: true, message: "Invitation resent" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/invitations/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      await invitationService.deleteInvitation(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // SG-82: Token moved from GET URL path to POST body so it never appears in
  // server logs, browser history, or referrer headers.
  app.post("/api/invitations/validate", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }
      const result = await invitationService.validateToken(token);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/invitations/accept", async (req, res) => {
    try {
      const { token, displayName } = req.body;

      if (!token || !displayName) {
        return res
          .status(400)
          .json({ error: "Token and display name required" });
      }

      const user = await invitationService.acceptInvitation(token, displayName);

      await otpService.createAndSendOtp(
        user.id,
        user.username,
        user.displayName,
        "login",
      );

      res.status(201).json({
        success: true,
        requiresOtp: true,
        email: user.username,
        message: "Account created! Verification code sent to your email.",
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (targetUser.role === "admin") {
        return res.status(403).json({ error: "Cannot delete admin users" });
      }

      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Anaplan Automation Routes
  app.post("/api/admin/anaplan/trigger", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required" });
      }

      console.log(
        `Manual Anaplan sync triggered by admin user: ${user.username}`,
      );

      const result = await scheduler.triggerManualSync(userId);

      res.json({
        success: result.success,
        logId: result.logId,
        filesDownloaded: result.filesDownloaded,
        filesProcessed: result.filesProcessed,
        filesFailed: result.filesFailed,
        newVersionsCreated: result.newVersionsCreated,
        archivedVersions: result.archivedVersions,
        message: result.success
          ? "Anaplan sync completed successfully"
          : `Anaplan sync failed: ${result.error}`,
      });
    } catch (error: any) {
      console.error("Manual Anaplan sync error:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/admin/anaplan/logs", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required" });
      }

      const userSettings = await storage.getUserSettings(userId);
      const companyId = userSettings?.activeCompanyId;

      if (!companyId) {
        return res.status(400).json({ error: "No active company found" });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const logs = await anaplanAutomation.getRecentLogs(companyId, limit);

      res.json({ logs });
    } catch (error: any) {
      console.error("Error fetching Anaplan logs:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/admin/anaplan/status", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required" });
      }

      res.json({
        schedulerRunning: scheduler.isSchedulerRunning(),
        nextRunTime: scheduler.getNextRunTime(),
        configured: Boolean(
          process.env.ANAPLAN_WORKSPACE_ID &&
            process.env.ANAPLAN_MODEL_ID &&
            process.env.ANAPLAN_EXPORT_PROCESS_ID &&
            process.env.ANAPLAN_USERNAME &&
            process.env.ANAPLAN_PASSWORD,
        ),
      });
    } catch (error: any) {
      console.error("Error fetching Anaplan status:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── DB Connection Status ────────────────────────────────────────────────────
  app.get("/api/admin/db-status", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      const mode = dbAuthMode;
      const isEntra = mode === "entra" || mode === "hybrid";
      const tokenStatus = isEntra ? getTokenStatus() : null;

      // Quick connectivity probe
      let connected = false;
      try {
        await storage.db.execute("SELECT 1" as any);
        connected = true;
      } catch (_) {
        connected = false;
      }

      res.json({
        mode,
        connected,
        host: process.env.DB_HOST
          ? process.env.DB_HOST.replace(/^([^.]{4}).*/, "$1****")
          : null,
        database: process.env.DB_NAME || null,
        tokenStatus,
      });
    } catch (error: any) {
      console.error("Error fetching DB status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Scheduler Configuration Routes
  app.get("/api/admin/scheduler/config", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required" });
      }

      let config = await storage.getSchedulerConfig();

      if (!config) {
        config = await storage.upsertSchedulerConfig({
          enabled: 0,
          hour: 6,
          minute: 0,
          timezone: "Asia/Kolkata",
        });
      }

      res.json(config);
    } catch (error: any) {
      console.error("Error fetching scheduler config:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put("/api/admin/scheduler/config", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required" });
      }

      const { enabled, hour, minute, timezone } = req.body;

      if (hour !== undefined && (hour < 0 || hour > 23)) {
        return res.status(400).json({ error: "Hour must be between 0 and 23" });
      }

      if (minute !== undefined && (minute < 0 || minute > 59)) {
        return res
          .status(400)
          .json({ error: "Minute must be between 0 and 59" });
      }

      const config = await storage.upsertSchedulerConfig({
        enabled,
        hour,
        minute,
        timezone,
        updatedBy: userId,
      });

      await scheduler.restart();

      res.json({
        success: true,
        config,
        schedulerRunning: scheduler.isSchedulerRunning(),
        nextRunTime: scheduler.getNextRunTime(),
      });
    } catch (error: any) {
      console.error("Error updating scheduler config:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/admin/enterprise/versions", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required" });
      }

      const userSettings = await storage.getUserSettings(userId);
      const companyId = userSettings?.activeCompanyId;

      if (!companyId) {
        return res.status(400).json({ error: "No active company found" });
      }

      const documentName = req.query.documentName as string;

      if (!documentName) {
        return res
          .status(400)
          .json({ error: "documentName query parameter required" });
      }

      const versions = await versionManager.getDocumentVersionHistory(
        companyId,
        documentName,
      );

      res.json({ versions });
    } catch (error: any) {
      console.error("Error fetching version history:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // SUPER ADMIN ROUTES - Only accessible by customer@ledgerlm.ai
  // ============================================================================

  const SUPER_ADMIN_EMAIL = "customer@ledgerlm.ai";

  // Middleware to check if user is super admin
  const requireSuperAdmin = async (req: any, res: any, next: any) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user || user.username.toLowerCase() !== SUPER_ADMIN_EMAIL) {
      return res
        .status(403)
        .json({ error: "Forbidden: Super Admin access required" });
    }

    req.user = user;
    next();
  };

  // Get all domains (Super Admin only)
  app.get("/api/super-admin/domains", requireSuperAdmin, async (req, res) => {
    try {
      const domains = await storage.getAllDomains();

      // Add user count for each domain
      const domainsWithCounts = await Promise.all(
        domains.map(async (domain) => ({
          ...domain,
          ssoClientSecret: domain.ssoClientSecret ? '********' : null,
          emailSmtpPass: domain.emailSmtpPass ? '********' : null,
          aiApiKey: domain.aiApiKey ? '********' : null,
          userCount: await storage.getDomainUserCount(domain.id),
        })),
      );

      res.json(domainsWithCounts);
    } catch (error: any) {
      console.error("Error fetching domains:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create a new domain (Super Admin only)
  app.post("/api/super-admin/domains", requireSuperAdmin, async (req, res) => {
    try {
      const parsed = createDomainSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
      }
      const { name, adminEmail, defaultOtp, authMethod, ssoTenantId, ssoClientId, ssoClientSecret,
              ssoGroupId, ssoDefaultRole,
              emailProvider, emailSmtpUser, emailSmtpPass, emailFromAddress, emailFromName,
              aiProvider, aiAuthMethod, aiEndpoint, aiApiKey, aiChatModel, aiChatApiVersion,
              aiEmbeddingModel, aiEmbeddingApiVersion, aiSystemPrompt } = parsed.data;

      if (!name || !adminEmail) {
        return res
          .status(400)
          .json({ error: "Domain name and admin email are required" });
      }

      // Check if domain already exists
      const existingDomain = await storage.getDomainByName(name);
      if (existingDomain) {
        return res.status(409).json({ error: "Domain already exists" });
      }

      const createPayload: Record<string, any> = {
        name: name.toLowerCase(),
        adminEmail: adminEmail.toLowerCase(),
        defaultOtp: defaultOtp || null,
        authMethod: authMethod || 'otp',
        createdBy: (req as any).user.id,
      };

      if (authMethod === 'microsoft_sso') {
        createPayload.ssoTenantId = ssoTenantId || null;
        createPayload.ssoClientId = ssoClientId || null;
        createPayload.ssoClientSecret = ssoClientSecret ? encryptValue(ssoClientSecret) : null;
        // New: group-to-role mappings (preferred); keep legacy fields for backward compat
        const { ssoGroupMappings } = parsed.data as any;
        if (ssoGroupMappings && Array.isArray(ssoGroupMappings) && ssoGroupMappings.length > 0) {
          createPayload.ssoGroupMappings = ssoGroupMappings;
          // Clear legacy fields when using new mappings
          createPayload.ssoGroupId = null;
          createPayload.ssoDefaultRole = 'standard';
        } else {
          createPayload.ssoGroupMappings = null;
          createPayload.ssoGroupId = ssoGroupId || null;
          createPayload.ssoDefaultRole = ssoDefaultRole || 'standard';
        }
      }

      const resolvedEmailProvider = emailProvider || 'default';
      createPayload.emailProvider = resolvedEmailProvider;
      createPayload.emailFromAddress = emailFromAddress || null;
      createPayload.emailFromName = emailFromName || null;
      if (resolvedEmailProvider !== 'default') {
        createPayload.emailSmtpUser = emailSmtpUser || null;
        createPayload.emailSmtpPass = emailSmtpPass ? encryptValue(emailSmtpPass) : null;
      }

      // AI provider config
      const resolvedAiProvider = aiProvider || 'ollama';
      createPayload.aiProvider = resolvedAiProvider;
      if (resolvedAiProvider === 'azure_openai') {
        const resolvedAiAuthMethod = aiAuthMethod || 'api_key';
        createPayload.aiAuthMethod = resolvedAiAuthMethod;
        createPayload.aiEndpoint = aiEndpoint || null;
        // Only store API key for key-based auth; keyless modes need no stored key
        createPayload.aiApiKey = resolvedAiAuthMethod === 'api_key' && aiApiKey ? encryptValue(aiApiKey) : null;
        createPayload.aiChatModel = aiChatModel || null;
        createPayload.aiChatApiVersion = aiChatApiVersion || null;
        createPayload.aiEmbeddingModel = aiEmbeddingModel || null;
        createPayload.aiEmbeddingApiVersion = aiEmbeddingApiVersion || null;
        createPayload.aiSystemPrompt = aiSystemPrompt || null;
      }

      const domain = await storage.createDomain(createPayload as any);

      // Create user in the main users table first (so they can login)
      await ensureUserAccountForDomainUser(adminEmail.toLowerCase());

      // Also create the admin as the first domain user
      await storage.createDomainUser({
        domainId: domain.id,
        email: adminEmail.toLowerCase(),
        role: "admin",
        hardcodedOtp: defaultOtp || null,
        invitedBy: (req as any).user.id,
      });

      const domainEmailConfig = resolvedEmailProvider !== 'default' ? {
        emailProvider: resolvedEmailProvider,
        emailSmtpUser: emailSmtpUser || null,
        emailSmtpPass: emailSmtpPass || null,
        emailFromAddress: emailFromAddress || null,
        emailFromName: emailFromName || null,
      } : null;

      // Send invitation email to domain admin
      try {
        await emailService.sendDomainAdminInvitation(
          adminEmail.toLowerCase(),
          name.toLowerCase(),
          defaultOtp || null,
          domainEmailConfig,
        );
        console.log(`✅ Domain admin invitation sent to ${adminEmail}`);
      } catch (emailError) {
        console.error(
          `⚠️ Failed to send domain admin invitation email:`,
          emailError,
        );
        // Don't fail the request if email fails
      }

      res.json(domain);
    } catch (error: any) {
      console.error("Error creating domain:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update a domain (Super Admin only)
  app.put(
    "/api/super-admin/domains/:id",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { adminEmail, defaultOtp, authMethod, ssoTenantId, ssoClientId, ssoClientSecret,
                ssoGroupId, ssoDefaultRole,
                emailProvider, emailSmtpUser, emailSmtpPass, emailFromAddress, emailFromName,
                aiProvider, aiAuthMethod, aiEndpoint, aiApiKey, aiChatModel, aiChatApiVersion,
                aiEmbeddingModel, aiEmbeddingApiVersion, aiSystemPrompt } = req.body;

        const domain = await storage.getDomain(id);
        if (!domain) {
          return res.status(404).json({ error: "Domain not found" });
        }

        const updatePayload: Record<string, any> = {
          adminEmail: adminEmail?.toLowerCase(),
          defaultOtp: defaultOtp || null,
          authMethod: authMethod || 'otp',
        };

        if (authMethod === 'microsoft_sso') {
          if (ssoTenantId !== undefined) updatePayload.ssoTenantId = ssoTenantId || null;
          if (ssoClientId !== undefined) updatePayload.ssoClientId = ssoClientId || null;
          if (ssoClientSecret && ssoClientSecret !== '********') {
            updatePayload.ssoClientSecret = encryptValue(ssoClientSecret);
          }
          // New: group-to-role mappings (preferred); keep legacy fields for backward compat
          const { ssoGroupMappings } = req.body as any;
          if (ssoGroupMappings && Array.isArray(ssoGroupMappings) && ssoGroupMappings.length > 0) {
            updatePayload.ssoGroupMappings = ssoGroupMappings;
            updatePayload.ssoGroupId = null;
            updatePayload.ssoDefaultRole = 'standard';
          } else {
            updatePayload.ssoGroupMappings = null;
            if (ssoGroupId !== undefined) updatePayload.ssoGroupId = ssoGroupId || null;
            if (ssoDefaultRole !== undefined) updatePayload.ssoDefaultRole = ssoDefaultRole || 'standard';
          }
        } else {
          // Clearing SSO when switching back to OTP
          updatePayload.ssoTenantId = null;
          updatePayload.ssoClientId = null;
          updatePayload.ssoClientSecret = null;
          updatePayload.ssoGroupId = null;
          updatePayload.ssoDefaultRole = 'standard';
          updatePayload.ssoGroupMappings = null;
        }

        const resolvedEmailProvider = emailProvider || 'default';
        updatePayload.emailProvider = resolvedEmailProvider;
        updatePayload.emailFromAddress = emailFromAddress || null;
        updatePayload.emailFromName = emailFromName || null;
        if (resolvedEmailProvider !== 'default') {
          if (emailSmtpUser !== undefined) updatePayload.emailSmtpUser = emailSmtpUser || null;
          // Only re-encrypt if a new non-placeholder password is provided
          if (emailSmtpPass && emailSmtpPass !== '********') {
            updatePayload.emailSmtpPass = encryptValue(emailSmtpPass);
          }
        } else {
          // Clearing email config when switching back to default
          updatePayload.emailSmtpUser = null;
          updatePayload.emailSmtpPass = null;
        }

        // AI provider config
        const resolvedAiProvider = aiProvider || 'ollama';
        updatePayload.aiProvider = resolvedAiProvider;
        if (resolvedAiProvider === 'azure_openai') {
          const resolvedAiAuthMethod = aiAuthMethod || 'api_key';
          updatePayload.aiAuthMethod = resolvedAiAuthMethod;
          if (aiEndpoint !== undefined) updatePayload.aiEndpoint = aiEndpoint || null;
          if (aiChatModel !== undefined) updatePayload.aiChatModel = aiChatModel || null;
          if (aiChatApiVersion !== undefined) updatePayload.aiChatApiVersion = aiChatApiVersion || null;
          if (aiEmbeddingModel !== undefined) updatePayload.aiEmbeddingModel = aiEmbeddingModel || null;
          if (aiEmbeddingApiVersion !== undefined) updatePayload.aiEmbeddingApiVersion = aiEmbeddingApiVersion || null;
          if (aiSystemPrompt !== undefined) updatePayload.aiSystemPrompt = aiSystemPrompt || null;
          if (resolvedAiAuthMethod === 'api_key') {
            // Key-based: re-encrypt only if a new non-placeholder key is provided
            if (aiApiKey && aiApiKey !== '********') {
              updatePayload.aiApiKey = encryptValue(aiApiKey);
            }
          } else {
            // Keyless (entra_id / private_endpoint): clear any stored key
            updatePayload.aiApiKey = null;
          }
        } else {
          // Clearing AI config when switching back to ollama
          updatePayload.aiEndpoint = null;
          updatePayload.aiApiKey = null;
          updatePayload.aiAuthMethod = 'api_key';
          updatePayload.aiChatModel = null;
          updatePayload.aiChatApiVersion = null;
          updatePayload.aiEmbeddingModel = null;
          updatePayload.aiEmbeddingApiVersion = null;
          updatePayload.aiSystemPrompt = null;
        }

        const updatedDomain = await storage.updateDomain(id, updatePayload);

        // Never expose encrypted secrets in the response
        const safeResponse = {
          ...updatedDomain,
          ssoClientSecret: updatedDomain?.ssoClientSecret ? '********' : null,
          emailSmtpPass: updatedDomain?.emailSmtpPass ? '********' : null,
          aiApiKey: updatedDomain?.aiApiKey ? '********' : null,
        };
        res.json(safeResponse);
      } catch (error: any) {
        console.error("Error updating domain:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Delete a domain (Super Admin only)
  app.delete(
    "/api/super-admin/domains/:id",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;

        const domain = await storage.getDomain(id);
        if (!domain) {
          return res.status(404).json({ error: "Domain not found" });
        }

        await storage.deleteDomain(id);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting domain:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Get domain users (Super Admin only - can see all domains)
  app.get(
    "/api/super-admin/domains/:domainId/users",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const { domainId } = req.params;

        const domain = await storage.getDomain(domainId);
        if (!domain) {
          return res.status(404).json({ error: "Domain not found" });
        }

        const users = await storage.getDomainUsers(domainId);
        res.json(users);
      } catch (error: any) {
        console.error("Error fetching domain users:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // ============================================================================
  // DOMAIN ADMIN ROUTES - For domain admins to manage their domain users
  // ============================================================================

  // Middleware to check if user is domain admin
  const requireDomainAdmin = async (req: any, res: any, next: any) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Super admin can access everything
    if (user.username.toLowerCase() === SUPER_ADMIN_EMAIL) {
      req.user = user;
      req.isSuperAdmin = true;
      return next();
    }

    // Check if user is a domain admin — first check the primary adminEmail on the domain,
    // then fall back to the domain_users table (covers additional admins added later)
    let domain = await storage.getDomainByAdminEmail(user.username.toLowerCase());

    if (!domain) {
      const domainUser = await storage.getDomainUserByEmail(user.username.toLowerCase());
      if (domainUser && domainUser.role === 'admin') {
        domain = await storage.getDomain(domainUser.domainId);
      }
    }

    if (!domain) {
      return res
        .status(403)
        .json({ error: "Forbidden: Domain Admin access required" });
    }

    req.user = user;
    req.domain = domain;
    next();
  };

  // Get current user's domain (for domain admins)
  app.get(
    "/api/domain-admin/my-domain",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const user = (req as any).user;
        const isSuperAdmin = (req as any).isSuperAdmin;

        if (isSuperAdmin) {
          // Super admin sees all domains with user counts
          const domains = await storage.getAllDomains();
          const domainsWithCounts = await Promise.all(
            domains.map(async (domain) => {
              const userCount = await storage.getDomainUserCount(domain.id);
              return { ...domain, userCount };
            }),
          );
          return res.json({ isSuperAdmin: true, domains: domainsWithCounts });
        }

        const domain = (req as any).domain;
        const userCount = await storage.getDomainUserCount(domain.id);

        res.json({
          isSuperAdmin: false,
          domain: { ...domain, userCount },
        });
      } catch (error: any) {
        console.error("Error fetching domain:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Get users in my domain (Domain Admin only)
  app.get("/api/domain-admin/users", requireDomainAdmin, async (req, res) => {
    try {
      const isSuperAdmin = (req as any).isSuperAdmin;

      if (isSuperAdmin) {
        // Super admin must specify domainId
        const domainId = req.query.domainId as string;
        if (!domainId) {
          return res
            .status(400)
            .json({
              error: "domainId query parameter required for super admin",
            });
        }
        const users = await storage.getDomainUsers(domainId);
        return res.json(users);
      }

      const domain = (req as any).domain;
      const users = await storage.getDomainUsers(domain.id);
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching domain users:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Add user to domain (Domain Admin only)
  app.post("/api/domain-admin/users", requireDomainAdmin, async (req, res) => {
    try {
      const { email, role, hardcodedOtp, domainId: requestDomainId } = req.body;
      const user = (req as any).user;
      const isSuperAdmin = (req as any).isSuperAdmin;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      let domainId: string;
      if (isSuperAdmin) {
        if (!requestDomainId) {
          return res
            .status(400)
            .json({ error: "domainId is required for super admin" });
        }
        domainId = requestDomainId;
      } else {
        domainId = (req as any).domain.id;
      }

      // Verify domain exists
      const domain = await storage.getDomain(domainId);
      if (!domain) {
        return res.status(404).json({ error: "Domain not found" });
      }

      // Check user quota (skip for super admin)
      if (!isSuperAdmin && domain.userQuota) {
        const currentUserCount = await storage.getDomainUserCount(domainId);
        if (currentUserCount >= domain.userQuota) {
          return res.status(403).json({
            error: `User quota exceeded. Maximum ${domain.userQuota} users allowed for this domain.`,
          });
        }
      }

      // Check if email domain matches
      const emailDomain = email.toLowerCase().split("@")[1];
      if (emailDomain !== domain.name.toLowerCase()) {
        return res.status(400).json({
          error: `Email domain must match ${domain.name}`,
        });
      }

      // Check if user already exists in domain_users
      const existingUser = await storage.getDomainUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }

      // Create user in the main users table first (so they can login)
      await ensureUserAccountForDomainUser(email.toLowerCase());

      const domainUser = await storage.createDomainUser({
        domainId,
        email: email.toLowerCase(),
        role: role || "standard",
        hardcodedOtp: hardcodedOtp || null,
        invitedBy: user.id,
      });

      // Build domain email config for the invite email
      const inviteDomainEmailConfig = domain.emailProvider && domain.emailProvider !== 'default' ? {
        emailProvider: domain.emailProvider,
        emailSmtpUser: domain.emailSmtpUser,
        emailSmtpPass: domain.emailSmtpPass ? decryptValue(domain.emailSmtpPass) : null,
        emailFromAddress: domain.emailFromAddress,
        emailFromName: domain.emailFromName,
      } : null;

      // Send invitation email to domain user
      try {
        await emailService.sendDomainUserInvitation(
          email.toLowerCase(),
          domain.name,
          role || "standard",
          hardcodedOtp || null,
          inviteDomainEmailConfig,
        );
        console.log(`✅ Domain user invitation sent to ${email}`);
      } catch (emailError) {
        console.error(
          `⚠️ Failed to send domain user invitation email:`,
          emailError,
        );
        // Don't fail the request if email fails
      }

      res.json(domainUser);
    } catch (error: any) {
      console.error("Error creating domain user:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update domain user (Domain Admin only)
  app.put(
    "/api/domain-admin/users/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { role, hardcodedOtp } = req.body;
        const isSuperAdmin = (req as any).isSuperAdmin;

        const domainUser = await storage.getDomainUser(id);
        if (!domainUser) {
          return res.status(404).json({ error: "User not found" });
        }

        // Verify user belongs to admin's domain (unless super admin)
        if (!isSuperAdmin) {
          const domain = (req as any).domain;
          if (domainUser.domainId !== domain.id) {
            return res
              .status(403)
              .json({ error: "Cannot modify users in other domains" });
          }
        }

        const updatedUser = await storage.updateDomainUser(id, {
          role,
          hardcodedOtp,
        });

        // Sync role to main users table so sidebar permissions are correct
        if (role) {
          const mainUser = await storage.getUserByUsername(domainUser.email);
          if (mainUser) {
            // Map domain role to user role: 'admin' -> 'admin', 'standard' -> 'user'
            const userRole = role === "admin" ? "admin" : "user";
            await storage.updateUserRole(mainUser.id, userRole);
            console.log(
              `✅ Synced role for ${domainUser.email}: domain=${role}, user=${userRole}`,
            );
          }
        }

        res.json(updatedUser);
      } catch (error: any) {
        console.error("Error updating domain user:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Delete domain user (Domain Admin only)
  app.delete(
    "/api/domain-admin/users/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const isSuperAdmin = (req as any).isSuperAdmin;

        const domainUser = await storage.getDomainUser(id);
        if (!domainUser) {
          return res.status(404).json({ error: "User not found" });
        }

        // Verify user belongs to admin's domain (unless super admin)
        if (!isSuperAdmin) {
          const domain = (req as any).domain;
          if (domainUser.domainId !== domain.id) {
            return res
              .status(403)
              .json({ error: "Cannot delete users in other domains" });
          }
        }

        await storage.deleteDomainUser(id);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting domain user:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // =====================================================
  // Domain-scoped Enterprise Documents
  // =====================================================

  // Get enterprise documents for current user's domain
  app.get(
    "/api/domain-admin/enterprise-documents",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;

        if (isSuperAdmin) {
          const domainId = req.query.domainId as string;
          if (!domainId) {
            return res
              .status(400)
              .json({
                error: "domainId query parameter required for super admin",
              });
          }
          const documents =
            await storage.getEnterpriseDocumentsByDomain(domainId);
          return res.json(documents);
        }

        const domain = (req as any).domain;
        const documents = await storage.getEnterpriseDocumentsByDomain(
          domain.id,
        );
        res.json(documents);
      } catch (error: any) {
        console.error("Error fetching domain enterprise documents:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Upload enterprise documents for domain
  app.post(
    "/api/domain-admin/enterprise-documents",
    requireDomainAdmin,
    upload.array("files", 10),
    async (req, res) => {
      try {
        const user = (req as any).user;
        const isSuperAdmin = (req as any).isSuperAdmin;
        const files = req.files as Express.Multer.File[];
        const requestDomainId = req.body.domainId;
        const requestCubeId = req.body.cubeId; // Optional cube assignment

        if (!files || files.length === 0) {
          return res.status(400).json({ error: "No files uploaded" });
        }

        let domainId: string;
        if (isSuperAdmin) {
          if (!requestDomainId) {
            return res
              .status(400)
              .json({ error: "domainId is required for super admin" });
          }
          domainId = requestDomainId;
        } else {
          domainId = (req as any).domain.id;
        }

        // Verify domain exists
        const domain = await storage.getDomain(domainId);
        if (!domain) {
          return res.status(404).json({ error: "Domain not found" });
        }

        // Verify cube belongs to domain if specified
        let cubeId: string | null = null;
        if (requestCubeId) {
          const cube = await storage.getCube(requestCubeId);
          if (!cube) {
            return res.status(404).json({ error: "Cube not found" });
          }
          if (cube.domainId !== domainId) {
            return res
              .status(403)
              .json({ error: "Cube does not belong to this domain" });
          }
          cubeId = requestCubeId;
        }

        // Find or create a company for this domain
        let company = await storage.findCompanyByNormalizedDomain(domain.name);
        if (!company) {
          // Create a company for this domain
          const companyName =
            domain.name.split(".")[0].charAt(0).toUpperCase() +
            domain.name.split(".")[0].slice(1);
          company = await storage.createCompany({
            name: companyName,
            slug: domain.name.replace(/\./g, "-"),
            description: `Company for ${domain.name} domain`,
          });
        }

        // Gate 3 — magic-byte validation for every file; reject and delete any that fail
        const validFiles: Express.Multer.File[] = [];
        const rejectedNames: string[] = [];
        for (const file of files) {
          const magicOk = await validateFileMagicBytes(file.path, file.mimetype);
          if (!magicOk) {
            await fs.unlink(file.path).catch(() => {});
            rejectedNames.push(file.originalname);
          } else {
            validFiles.push(file);
          }
        }
        if (rejectedNames.length > 0 && validFiles.length === 0) {
          return res.status(400).json({
            error: "All uploaded files were rejected — content does not match declared type.",
            rejected: rejectedNames,
          });
        }

        const documents = await Promise.all(
          validFiles.map((file) =>
            storage.createEnterpriseDocument({
              companyId: company!.id,
              domainId: domainId,
              uploadedBy: user.id,
              name: sanitiseFilename(file.originalname),
              filePath: file.filename,
              fileSize: file.size.toString(),
              fileType: file.mimetype,
              cubeId: cubeId,
            }),
          ),
        );

        // Auto-process Excel files uploaded to cubes (for SQL ingestion)
        let jobId: string | null = null;
        if (cubeId) {
          const excelDocs = documents.filter(
            (doc) =>
              doc.name.toLowerCase().endsWith(".xlsx") ||
              doc.name.toLowerCase().endsWith(".xls"),
          );

          // Process the first Excel file and capture job_id for progress tracking
          if (excelDocs.length > 0) {
            const doc = excelDocs[0];
            try {
              const filePath = path.join(uploadDir, doc.filePath);
              console.log(
                `[AUTO-PROCESS] Triggering SQL ingestion for ${doc.name} -> cube ${cubeId}`,
              );

              // Build ai_config for domain-specific AI providers
              const isAzureKeylessAuto = domain.aiAuthMethod === 'entra_id' || domain.aiAuthMethod === 'private_endpoint';
              const domainAiConfig = (domain.aiProvider === 'azure_openai' && domain.aiEndpoint && (isAzureKeylessAuto || domain.aiApiKey))
                ? {
                    provider: 'azure_openai',
                    auth_method: domain.aiAuthMethod || 'api_key',
                    endpoint: domain.aiEndpoint,
                    ...(domain.aiApiKey ? { api_key: decryptValue(domain.aiApiKey!) } : {}),
                    chat_model: domain.aiChatModel || '',
                    chat_api_version: domain.aiChatApiVersion || '2024-12-01-preview',
                    embedding_model: domain.aiEmbeddingModel || '',
                    embedding_api_version: domain.aiEmbeddingApiVersion || '2024-02-01',
                    system_prompt: domain.aiSystemPrompt || '',
                  }
                : null;

              const processResponse = await fetch(
                `${PYTHON_API_URL}/api/v2/enterprise/process/${doc.id}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    file_path: filePath,
                    company_id: doc.companyId,
                    cube_id: cubeId,
                    ai_config: domainAiConfig,
                  }),
                },
              );

              if (processResponse.ok) {
                const processData = await processResponse.json();
                jobId = processData.job_id || null;
                console.log(
                  `[AUTO-PROCESS] Started ingestion job ${jobId} for ${doc.name}`,
                );
              }
            } catch (err) {
              console.error(
                `[AUTO-PROCESS] Failed to trigger processing for ${doc.name}:`,
                err,
              );
            }
          }
        }

        res.status(201).json({ documents, job_id: jobId });
      } catch (error: any) {
        console.error("Error uploading domain enterprise documents:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Process document for domain
  app.post(
    "/api/domain-admin/enterprise-documents/:id/process",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;

        const document = await storage.getEnterpriseDocument(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        // Verify document belongs to admin's domain (unless super admin)
        if (!isSuperAdmin) {
          const domain = (req as any).domain;
          if (document.domainId !== domain.id) {
            return res
              .status(403)
              .json({ error: "Cannot process documents in other domains" });
          }
        }

        const filePath = path.join(uploadDir, document.filePath);

        // Look up domain AI config for this document
        const docDomain = document.domainId ? await storage.getDomain(document.domainId) : null;
        const isAzureKeylessDoc = docDomain?.aiAuthMethod === 'entra_id' || docDomain?.aiAuthMethod === 'private_endpoint';
        const domainAiConfig = (docDomain?.aiProvider === 'azure_openai' && docDomain.aiEndpoint && (isAzureKeylessDoc || docDomain.aiApiKey))
          ? {
              provider: 'azure_openai',
              auth_method: docDomain.aiAuthMethod || 'api_key',
              endpoint: docDomain.aiEndpoint,
              ...(docDomain.aiApiKey ? { api_key: decryptValue(docDomain.aiApiKey!) } : {}),
              chat_model: docDomain.aiChatModel || '',
              chat_api_version: docDomain.aiChatApiVersion || '2024-12-01-preview',
              embedding_model: docDomain.aiEmbeddingModel || '',
              embedding_api_version: docDomain.aiEmbeddingApiVersion || '2024-02-01',
              system_prompt: docDomain.aiSystemPrompt || '',
            }
          : null;

        const response = await fetch(
          `${PYTHON_API_URL}/api/v2/enterprise/process/${req.params.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_path: filePath,
              company_id: document.companyId,
              ai_config: domainAiConfig,
            }),
          },
        );

        const data = await response.json();
        res.json(data);
      } catch (error: any) {
        console.error("Error processing domain enterprise document:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Download domain enterprise document
  app.get(
    "/api/domain-admin/enterprise-documents/:id/download",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;

        const document = await storage.getEnterpriseDocument(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        // Verify document belongs to admin's domain (unless super admin)
        if (!isSuperAdmin) {
          const domain = (req as any).domain;
          if (document.domainId !== domain.id) {
            return res
              .status(403)
              .json({ error: "Cannot download documents in other domains" });
          }
        }

        const filePath = path.join(uploadDir, document.filePath);

        // Check if file exists
        try {
          await fs.access(filePath);
        } catch {
          return res.status(404).json({ error: "File not found on disk" });
        }

        // Sanitize filename for Content-Disposition header (remove CRLF, quotes, control chars)
        const sanitizedFilename = document.name
          .replace(/[\r\n]/g, "")
          .replace(/"/g, "'")
          .replace(/[^\x20-\x7E]/g, "_");

        // Set headers for download
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${sanitizedFilename}"`,
        );
        res.setHeader(
          "Content-Type",
          document.fileType || "application/octet-stream",
        );

        // Stream the file
        const fileBuffer = await fs.readFile(filePath);
        res.send(fileBuffer);
      } catch (error: any) {
        console.error("Error downloading domain enterprise document:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Delete domain enterprise document
  app.delete(
    "/api/domain-admin/enterprise-documents/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;

        const document = await storage.getEnterpriseDocument(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        // Verify document belongs to admin's domain (unless super admin)
        if (!isSuperAdmin) {
          const domain = (req as any).domain;
          if (document.domainId !== domain.id) {
            return res
              .status(403)
              .json({ error: "Cannot delete documents in other domains" });
          }
        }

        await storage.deleteEnterpriseDocument(req.params.id);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting domain enterprise document:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Delete all documents for a cube
  app.delete(
    "/api/domain-admin/cubes/:cubeId/documents",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const { cubeId } = req.params;

        // Get the cube and verify it exists
        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify cube belongs to admin's domain (unless super admin)
        if (!isSuperAdmin) {
          const domain = (req as any).domain;
          if (cube.domainId !== domain.id) {
            return res
              .status(403)
              .json({ error: "Cannot delete documents in other domains" });
          }
        }

        // Get all documents for this cube
        const documentsToDelete = await db
          .select({ id: enterpriseDocuments.id })
          .from(enterpriseDocuments)
          .where(eq(enterpriseDocuments.cubeId, cubeId));

        // Delete each document (this also cleans up chunks/embeddings via storage.deleteEnterpriseDocument)
        let deletedCount = 0;
        for (const doc of documentsToDelete) {
          await storage.deleteEnterpriseDocument(doc.id);
          deletedCount++;
        }

        // Clear KPI fact data
        const factDataDeleted = await storage.clearCubeFactData(cubeId);
        console.log(`[AUDIT] Cleared ${factDataDeleted} rows from cube_fact_data for cube ${cubeId}`);

        // Clear Investment/CAPEX/PMO data for this cube
        const invDataResult = await db.execute(
          sql`DELETE FROM cube_investment_data WHERE cube_id = ${cubeId}`
        );
        const invDataDeleted = (invDataResult as any).rowCount ?? 0;
        if (invDataDeleted > 0) {
          console.log(`[AUDIT] Cleared ${invDataDeleted} rows from cube_investment_data for cube ${cubeId}`);
        }

        res.json({ success: true, deletedCount, factDataDeleted, invDataDeleted });
      } catch (error: any) {
        console.error("Error deleting cube documents:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Update document cube assignment
  app.patch(
    "/api/domain-admin/enterprise-documents/:id/cube",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { cubeId } = req.body;

        const document = await storage.getEnterpriseDocument(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        // Verify document belongs to admin's domain (unless super admin)
        let domainId: string;
        if (!isSuperAdmin) {
          domainId = (req as any).domain.id;
          if (document.domainId !== domainId) {
            return res
              .status(403)
              .json({ error: "Cannot modify documents in other domains" });
          }
        } else {
          domainId = document.domainId!;
        }

        // Verify cube belongs to the same domain if specified
        if (cubeId) {
          const cube = await storage.getCube(cubeId);
          if (!cube) {
            return res.status(404).json({ error: "Cube not found" });
          }
          if (cube.domainId !== domainId) {
            return res
              .status(403)
              .json({ error: "Cube does not belong to this domain" });
          }
        }

        // Update the document's cube assignment
        await db
          .update(enterpriseDocuments)
          .set({ cubeId: cubeId || null })
          .where(eq(enterpriseDocuments.id, req.params.id));

        const updatedDoc = await storage.getEnterpriseDocument(req.params.id);
        console.log(
          `[AUDIT] Document ${document.name} cube assignment updated to ${cubeId || "none"} by ${user.username}`,
        );
        res.json(updatedDoc);
      } catch (error: any) {
        console.error("Error updating document cube assignment:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Get document version history for domain
  app.get(
    "/api/domain-admin/enterprise-documents/versions",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.query.domainId as string;
          if (!domainId) {
            return res
              .status(400)
              .json({
                error: "domainId query parameter required for super admin",
              });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        // Get domain to find company ID
        const domain = await storage.getDomain(domainId);
        if (!domain?.companyId) {
          return res.json({ versions: [] });
        }

        // Get all documents for this domain with version info
        const documents = await db
          .select({
            id: enterpriseDocuments.id,
            name: enterpriseDocuments.name,
            version: enterpriseDocuments.version,
            filePath: enterpriseDocuments.filePath,
            fileSize: enterpriseDocuments.fileSize,
            fileType: enterpriseDocuments.fileType,
            source: enterpriseDocuments.source,
            isActive: enterpriseDocuments.isActive,
            uploadedAt: enterpriseDocuments.uploadedAt,
            uploadedBy: enterpriseDocuments.uploadedBy,
            previousVersionId: enterpriseDocuments.previousVersionId,
            anaplanMetadata: enterpriseDocuments.anaplanMetadata,
            cubeId: enterpriseDocuments.cubeId,
          })
          .from(enterpriseDocuments)
          .where(eq(enterpriseDocuments.domainId, domainId))
          .orderBy(
            desc(enterpriseDocuments.name),
            desc(enterpriseDocuments.version),
          );

        // Get user display names for uploadedBy
        const userIds = Array.from(new Set(documents.map((d) => d.uploadedBy)));
        const usersData: Record<string, string> = {};
        for (const userId of userIds) {
          try {
            const user = await storage.getUser(userId);
            if (user) {
              usersData[userId] = user.displayName || user.username;
            }
          } catch (e) {
            // Skip if user not found
          }
        }

        // Map documents with uploader display names
        const versions = documents.map((doc) => ({
          id: doc.id,
          fileName: doc.name,
          version: doc.version,
          filePath: doc.filePath,
          fileSize: doc.fileSize,
          fileType: doc.fileType,
          source: doc.source,
          isActive: doc.isActive === 1,
          uploadedAt: doc.uploadedAt,
          uploadedBy: usersData[doc.uploadedBy] || "System",
          previousVersionId: doc.previousVersionId,
          metadata: doc.anaplanMetadata,
          cubeId: doc.cubeId,
        }));

        res.json({ versions });
      } catch (error: any) {
        console.error("Error fetching document versions:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // ============================================================================
  // DOMAIN SCHEDULER CONFIG ROUTES - For domain admins to configure automation
  // ============================================================================

  // Get domain scheduler config
  app.get(
    "/api/domain-admin/scheduler-config",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.query.domainId as string;
          if (!domainId) {
            return res
              .status(400)
              .json({
                error: "domainId query parameter required for super admin",
              });
          }
          // Validate domain exists for super admin
          const domain = await storage.getDomain(domainId);
          if (!domain) {
            return res.status(404).json({ error: "Domain not found" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const config = await storage.getDomainSchedulerConfig(domainId);

        if (!config) {
          // Return default config if none exists
          return res.json({
            domainId,
            enabled: false,
            hour: 6,
            minute: 0,
            timezone: "Asia/Kolkata",
          });
        }

        res.json(config);
      } catch (error: any) {
        console.error("Error fetching domain scheduler config:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Update domain scheduler config
  app.put(
    "/api/domain-admin/scheduler-config",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;

        let domainId: string;
        if (isSuperAdmin) {
          const requestDomainId = req.body.domainId;
          if (!requestDomainId) {
            return res
              .status(400)
              .json({ error: "domainId is required for super admin" });
          }
          // Validate domain exists for super admin
          const domain = await storage.getDomain(requestDomainId);
          if (!domain) {
            return res.status(404).json({ error: "Domain not found" });
          }
          domainId = requestDomainId;
          console.log(
            `[AUDIT] Super admin ${user.username} updating scheduler config for domain ${domain.name}`,
          );
        } else {
          domainId = (req as any).domain.id;
        }

        const {
          enabled,
          hour,
          minute,
          timezone,
        } = req.body;

        const config = await storage.upsertDomainSchedulerConfig(domainId, {
          enabled: enabled ? 1 : 0,
          hour: hour ?? 6,
          minute: minute ?? 0,
          timezone: timezone ?? "Asia/Kolkata",
          updatedBy: user.id,
        });

        console.log(
          `[AUDIT] Domain scheduler config updated for domain ${domainId} by user ${user.username}`,
        );

        // Restart the scheduler for this domain with new config
        await multiTenantScheduler.restartDomainScheduler(domainId);

        res.json(config);
      } catch (error: any) {
        console.error("Error updating domain scheduler config:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Trigger manual Anaplan sync for domain
  app.post(
    "/api/domain-admin/anaplan/trigger",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.body.domainId as string;
          if (!domainId) {
            return res
              .status(400)
              .json({ error: "domainId is required for super admin" });
          }
          // Validate domain exists
          const domain = await storage.getDomain(domainId);
          if (!domain) {
            return res.status(404).json({ error: "Domain not found" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        console.log(
          `[AUDIT] Manual Anaplan sync triggered for domain ${domainId} by user ${user.username}`,
        );

        const result = await multiTenantScheduler.triggerManualSync(
          domainId,
          user.id,
        );

        res.json({
          success: result.success,
          logId: result.logId,
          filesDownloaded: result.filesDownloaded,
          filesProcessed: result.filesProcessed,
          filesFailed: result.filesFailed,
          newVersionsCreated: result.newVersionsCreated,
          archivedVersions: result.archivedVersions,
          message: result.success
            ? "Anaplan sync completed successfully"
            : `Anaplan sync failed: ${result.error}`,
        });
      } catch (error: any) {
        console.error("Domain Anaplan sync error:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Get domain Anaplan scheduler status
  app.get(
    "/api/domain-admin/anaplan/status",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.query.domainId as string;
          if (!domainId) {
            return res
              .status(400)
              .json({
                error: "domainId query parameter required for super admin",
              });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const config = await storage.getDomainSchedulerConfig(domainId);
        const status = multiTenantScheduler.getDomainStatus(domainId);

        res.json({
          enabled: config?.enabled === 1,
          nextRun: status.nextRun,
          lastRun: null, // TODO: Track last run in audit logs
          schedule: config
            ? `${String(config.hour).padStart(2, "0")}:${String(config.minute).padStart(2, "0")} ${config.timezone}`
            : "Not configured",
          isRunning: status.isRunning,
          isConfigured: status.isConfigured,
        });
      } catch (error: any) {
        console.error("Error fetching domain Anaplan status:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Get domain automation logs (sync history)
  app.get(
    "/api/domain-admin/anaplan/logs",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.query.domainId as string;
          if (!domainId) {
            return res
              .status(400)
              .json({
                error: "domainId query parameter required for super admin",
              });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        // Get the domain to find its company
        const domain = await storage.getDomain(domainId);
        if (!domain?.companyId) {
          return res.json({ logs: [] });
        }

        const limit = parseInt(req.query.limit as string) || 20;
        const logs = await anaplanAutomation.getRecentLogs(
          domain.companyId,
          limit,
        );

        res.json({ logs });
      } catch (error: any) {
        console.error("Error fetching domain Anaplan logs:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // ============================================================================
  // DOMAIN API CONNECTORS ROUTES - Plugin-based data source management
  // ============================================================================

  // Get available connector types
  app.get(
    "/api/domain-admin/connector-types",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const availableTypes = connectorRegistry.getAvailableConnectorTypes();
        const allTypes = connectorRegistry.getAllConnectorTypes();
        res.json({ available: availableTypes, all: allTypes });
      } catch (error: any) {
        console.error("Error fetching connector types:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Get all connectors for a domain
  app.get(
    "/api/domain-admin/connectors",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.query.domainId as string;
          if (!domainId) {
            return res
              .status(400)
              .json({
                error: "domainId query parameter required for super admin",
              });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const connectors = await storage.getDomainApiConnectors(domainId);

        // Return metadata only - no config (sensitive data never leaves server)
        const safeConnectors = connectors.map((connector) => ({
          id: connector.id,
          domainId: connector.domainId,
          connectorType: connector.connectorType,
          name: connector.name,
          enabled: connector.enabled,
          tags: connector.tags,
          status: connector.status,
          documentCount: connector.documentCount,
          lastSyncAt: connector.lastSyncAt,
          lastSyncResult: connector.lastSyncResult,
          scheduleEnabled: connector.scheduleEnabled,
          scheduleHour: connector.scheduleHour,
          scheduleMinute: connector.scheduleMinute,
          scheduleTimezone: connector.scheduleTimezone,
          blobPrefix: connector.blobPrefix,
          targetCubeId: connector.targetCubeId,
          createdAt: connector.createdAt,
          updatedAt: connector.updatedAt,
        }));

        res.json(safeConnectors);
      } catch (error: any) {
        console.error("Error fetching domain connectors:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Get a specific connector by ID
  app.get(
    "/api/domain-admin/connectors/:connectorId",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const { connectorId } = req.params;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.query.domainId as string;
          if (!domainId) {
            return res.status(400).json({ error: "domainId query parameter required for super admin" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const connector = await storage.getDomainApiConnectorById(connectorId);
        if (!connector || connector.domainId !== domainId) {
          return res.status(404).json({ error: "Connector not found" });
        }

        res.json({
          id: connector.id,
          domainId: connector.domainId,
          connectorType: connector.connectorType,
          name: connector.name,
          enabled: connector.enabled,
          tags: connector.tags,
          status: connector.status,
          targetCubeId: connector.targetCubeId,
          documentCount: connector.documentCount,
          lastSyncAt: connector.lastSyncAt,
          lastSyncResult: connector.lastSyncResult,
          scheduleEnabled: connector.scheduleEnabled,
          scheduleHour: connector.scheduleHour,
          scheduleMinute: connector.scheduleMinute,
          scheduleTimezone: connector.scheduleTimezone,
          createdAt: connector.createdAt,
          updatedAt: connector.updatedAt,
        });
      } catch (error: any) {
        console.error("Error fetching connector:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Create a new connector
  app.post(
    "/api/domain-admin/connectors",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.body.domainId as string;
          if (!domainId) {
            return res
              .status(400)
              .json({ error: "domainId is required for super admin" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const { connectorType, name, config, tags, enabled, blobPrefix } = req.body;

        // Validate connector type
        const validType = AVAILABLE_CONNECTOR_TYPES.find(
          (t) => t.type === connectorType,
        );
        if (!validType) {
          return res
            .status(400)
            .json({ error: `Invalid connector type: ${connectorType}` });
        }

        // Validate config based on connector type
        let validatedConfig: Record<string, any>;
        try {
          if (connectorType === CONNECTOR_TYPES.ANAPLAN) {
            validatedConfig = anaplanConfigSchema.parse(config);
          } else if (connectorType === CONNECTOR_TYPES.AZURE_BLOB) {
            validatedConfig = azureBlobConfigSchema.parse(config);
          } else {
            validatedConfig = config || {};
          }
        } catch (validationError: any) {
          return res
            .status(400)
            .json({
              error: `Invalid configuration: ${validationError.message}`,
            });
        }

        // Encrypt sensitive fields
        const encryptedConfig = connectorRegistry.encryptConfig(
          connectorType,
          validatedConfig,
        );

        const connector = await storage.createDomainApiConnector({
          domainId,
          connectorType,
          name: name || validType.name,
          enabled: enabled !== false ? 1 : 0,
          config: encryptedConfig,
          tags: tags || [],
          status: "pending",
          updatedBy: user.id,
          ...(blobPrefix ? { blobPrefix: blobPrefix.trim() } : {}),
        });

        console.log(
          `[AUDIT] Connector ${connectorType} created for domain ${domainId} by user ${user.username}`,
        );

        // Clear connector cache
        connectorRegistry.clearCache(domainId);

        // Return metadata only - no config (sensitive data never leaves server)
        res.status(201).json({
          id: connector.id,
          domainId: connector.domainId,
          connectorType: connector.connectorType,
          name: connector.name,
          enabled: connector.enabled,
          tags: connector.tags,
          status: connector.status,
          documentCount: connector.documentCount,
          lastSyncAt: connector.lastSyncAt,
          lastSyncResult: connector.lastSyncResult,
          createdAt: connector.createdAt,
          updatedAt: connector.updatedAt,
        });
      } catch (error: any) {
        console.error("Error creating connector:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Update a connector
  app.put(
    "/api/domain-admin/connectors/:connectorId",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { connectorId } = req.params;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.body.domainId as string;
          if (!domainId) {
            return res.status(400).json({ error: "domainId is required for super admin" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const existing = await storage.getDomainApiConnectorById(connectorId);
        if (!existing || existing.domainId !== domainId) {
          return res.status(404).json({ error: "Connector not found" });
        }

        const connectorType = existing.connectorType;
        const { name, config, tags, enabled, targetCubeId, blobPrefix } = req.body;

        const updates: any = { updatedBy: user.id };

        if (name !== undefined) updates.name = name;
        if (tags !== undefined) updates.tags = tags;
        if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
        if (targetCubeId !== undefined) updates.targetCubeId = targetCubeId || null;
        if (blobPrefix !== undefined) updates.blobPrefix = blobPrefix?.trim() || null;

        if (config) {
          // Validate config based on connector type
          let validatedConfig: Record<string, any>;
          try {
            if (connectorType === CONNECTOR_TYPES.ANAPLAN) {
              validatedConfig = anaplanConfigSchema.parse(config);
            } else if (connectorType === CONNECTOR_TYPES.AZURE_BLOB) {
              validatedConfig = azureBlobConfigSchema.parse(config);
            } else {
              validatedConfig = config;
            }
          } catch (validationError: any) {
            return res
              .status(400)
              .json({
                error: `Invalid configuration: ${validationError.message}`,
              });
          }

          // Encrypt sensitive fields
          updates.config = connectorRegistry.encryptConfig(
            connectorType,
            validatedConfig,
          );
        }

        const connector = await storage.updateDomainApiConnector(
          existing.id,
          updates,
        );

        console.log(
          `[AUDIT] Connector ${connectorType} updated for domain ${domainId} by user ${user.username}`,
        );

        // Clear connector cache — pass both domainId and connectorId so the
        // by-id cache entry (used by the sync service) is also evicted.
        connectorRegistry.clearCache(domainId, connectorId);

        // Return metadata only - no config (sensitive data never leaves server)
        res.json({
          id: connector?.id,
          domainId: connector?.domainId,
          connectorType: connector?.connectorType,
          name: connector?.name,
          enabled: connector?.enabled,
          tags: connector?.tags,
          status: connector?.status,
          documentCount: connector?.documentCount,
          lastSyncAt: connector?.lastSyncAt,
          lastSyncResult: connector?.lastSyncResult,
          createdAt: connector?.createdAt,
          updatedAt: connector?.updatedAt,
        });
      } catch (error: any) {
        console.error("Error updating connector:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Delete a connector
  app.delete(
    "/api/domain-admin/connectors/:connectorId",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { connectorId } = req.params;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.query.domainId as string;
          if (!domainId) {
            return res.status(400).json({ error: "domainId query parameter required for super admin" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const existing = await storage.getDomainApiConnectorById(connectorId);
        if (!existing || existing.domainId !== domainId) {
          return res.status(404).json({ error: "Connector not found" });
        }

        await storage.deleteDomainApiConnector(existing.id);

        console.log(`[AUDIT] Connector ${existing.connectorType} (${connectorId}) deleted for domain ${domainId} by user ${user.username}`);

        connectorRegistry.clearCache(domainId);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting connector:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Test a connector connection
  app.post(
    "/api/domain-admin/connectors/:connectorId/test",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const { connectorId } = req.params;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.body.domainId as string;
          if (!domainId) {
            return res.status(400).json({ error: "domainId is required for super admin" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const { config } = req.body;

        const existing = await storage.getDomainApiConnectorById(connectorId);
        if (!existing || existing.domainId !== domainId) {
          return res.status(404).json({ error: "Connector not found" });
        }

        const connectorType = existing.connectorType;

        // Use provided config or decrypt stored config
        const testConfig: Record<string, any> = config
          ? config
          : connectorRegistry.decryptConfig(connectorType, existing.config as Record<string, any>);

        const result = await connectorRegistry.testConnection(domainId, connectorType, testConfig);

        // Update connector status
        await storage.updateDomainApiConnectorStatus(
          existing.id,
          result.success ? "connected" : "error",
          result.message,
        );

        // Clear cache so next sync picks up fresh state
        connectorRegistry.clearCache(domainId);

        res.json(result);
      } catch (error: any) {
        console.error("Error testing connector:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Toggle connector enabled/disabled
  app.patch(
    "/api/domain-admin/connectors/:connectorId/toggle",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { connectorId } = req.params;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.body.domainId as string;
          if (!domainId) {
            return res.status(400).json({ error: "domainId is required for super admin" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const existing = await storage.getDomainApiConnectorById(connectorId);
        if (!existing || existing.domainId !== domainId) {
          return res.status(404).json({ error: "Connector not found" });
        }

        const newEnabled = existing.enabled === 1 ? 0 : 1;
        const connector = await storage.updateDomainApiConnector(existing.id, {
          enabled: newEnabled,
          updatedBy: user.id,
        });

        console.log(`[AUDIT] Connector ${existing.connectorType} (${connectorId}) ${newEnabled ? "enabled" : "disabled"} for domain ${domainId} by user ${user.username}`);
        connectorRegistry.clearCache(domainId);

        res.json({
          id: connector?.id,
          domainId: connector?.domainId,
          connectorType: connector?.connectorType,
          name: connector?.name,
          enabled: connector?.enabled,
          tags: connector?.tags,
          status: connector?.status,
          targetCubeId: connector?.targetCubeId,
          documentCount: connector?.documentCount,
          lastSyncAt: connector?.lastSyncAt,
          lastSyncResult: connector?.lastSyncResult,
          createdAt: connector?.createdAt,
          updatedAt: connector?.updatedAt,
        });
      } catch (error: any) {
        console.error("Error toggling connector:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Update connector schedule
  app.patch(
    "/api/domain-admin/connectors/:connectorId/schedule",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { connectorId } = req.params;
        const {
          scheduleEnabled,
          scheduleHour,
          scheduleMinute,
          scheduleTimezone,
          domainId: bodyDomainId,
        } = req.body;

        // Validate schedule fields
        const validTimezones = [
          "Asia/Kolkata",
          "UTC",
          "America/New_York",
          "America/Los_Angeles",
          "Europe/London",
          "Europe/Paris",
          "Asia/Tokyo",
          "Asia/Singapore",
        ];
        const validMinutes = [0, 15, 30, 45];

        if (
          scheduleHour !== undefined &&
          (typeof scheduleHour !== "number" ||
            scheduleHour < 0 ||
            scheduleHour > 23)
        ) {
          return res
            .status(400)
            .json({ error: "scheduleHour must be between 0 and 23" });
        }
        if (
          scheduleMinute !== undefined &&
          (typeof scheduleMinute !== "number" ||
            !validMinutes.includes(scheduleMinute))
        ) {
          return res
            .status(400)
            .json({ error: "scheduleMinute must be 0, 15, 30, or 45" });
        }
        if (
          scheduleTimezone !== undefined &&
          !validTimezones.includes(scheduleTimezone)
        ) {
          return res
            .status(400)
            .json({
              error:
                "Invalid timezone. Valid options: " + validTimezones.join(", "),
            });
        }
        if (
          scheduleEnabled !== undefined &&
          ![0, 1].includes(scheduleEnabled)
        ) {
          return res
            .status(400)
            .json({ error: "scheduleEnabled must be 0 or 1" });
        }

        let domainId: string;
        if (isSuperAdmin) {
          domainId = bodyDomainId as string;
          if (!domainId) {
            return res
              .status(400)
              .json({ error: "domainId is required for super admin" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        const existing = await storage.getDomainApiConnectorById(connectorId);
        if (!existing || existing.domainId !== domainId) {
          return res.status(404).json({ error: "Connector not found" });
        }

        // Update schedule fields using nullish coalescing to preserve 0 values
        const connector = await storage.updateDomainApiConnector(existing.id, {
          scheduleEnabled: scheduleEnabled ?? existing.scheduleEnabled,
          scheduleHour: scheduleHour ?? existing.scheduleHour,
          scheduleMinute: scheduleMinute ?? existing.scheduleMinute,
          scheduleTimezone: scheduleTimezone ?? existing.scheduleTimezone,
          updatedBy: user.id,
        });

        console.log(
          `[AUDIT] Connector ${existing.connectorType} (${connectorId}) schedule updated for domain ${domainId} by user ${user.username}: enabled=${scheduleEnabled}, ${scheduleHour}:${scheduleMinute} ${scheduleTimezone}`,
        );

        // Return metadata only
        res.json({
          id: connector?.id,
          domainId: connector?.domainId,
          connectorType: connector?.connectorType,
          name: connector?.name,
          enabled: connector?.enabled,
          tags: connector?.tags,
          status: connector?.status,
          documentCount: connector?.documentCount,
          lastSyncAt: connector?.lastSyncAt,
          lastSyncResult: connector?.lastSyncResult,
          scheduleEnabled: connector?.scheduleEnabled,
          scheduleHour: connector?.scheduleHour,
          scheduleMinute: connector?.scheduleMinute,
          scheduleTimezone: connector?.scheduleTimezone,
          createdAt: connector?.createdAt,
          updatedAt: connector?.updatedAt,
        });
      } catch (error: any) {
        console.error("Error updating connector schedule:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Helper function to convert file extension to MIME type (matches domainAnaplanAutomation.getFileType)
  function getFileMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split(".").pop() || "";
    const mimeMap: Record<string, string> = {
      // Excel formats
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
      xlsb: "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
      xls: "application/vnd.ms-excel",
      csv: "text/csv",
      // Word formats
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      docm: "application/vnd.ms-word.document.macroEnabled.12",
      // PowerPoint formats
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      pptm: "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
      // PDF
      pdf: "application/pdf",
      // Text/Data formats
      txt: "text/plain",
      json: "application/json",
      xml: "application/xml",
      // Image formats
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      tiff: "image/tiff",
      tif: "image/tiff",
      // Archive formats
      zip: "application/zip",
      rar: "application/x-rar-compressed",
    };
    return mimeMap[ext] || "application/octet-stream";
  }

  // Sync connector - fetch data from source and create enterprise documents
  app.post(
    "/api/domain-admin/connectors/:connectorId/sync",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { connectorId } = req.params;

        let domainId: string;
        if (isSuperAdmin) {
          domainId = req.body.domainId as string;
          if (!domainId) {
            return res.status(400).json({ error: "domainId is required for super admin" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        // Fetch connector record by ID and verify ownership
        const connectorRecord = await storage.getDomainApiConnectorById(connectorId);
        if (!connectorRecord || connectorRecord.domainId !== domainId) {
          return res.status(404).json({ error: "Connector not found" });
        }

        const connectorType = connectorRecord.connectorType;

        console.log(`[SYNC] Starting ${connectorType} (${connectorId}) sync for domain ${domainId} triggered by ${user.username}`);

        // Get domain info for company ID
        const domain = await storage.getDomain(domainId);
        if (!domain?.companyId) {
          return res.status(400).json({ error: "Domain has no company linked" });
        }

        if (connectorType === "azure_blob") {
          const connector = await connectorRegistry.getAzureBlobConnectorById(connectorId);
          if (!connector) {
            return res.status(404).json({ error: "Azure Blob connector not configured or disabled" });
          }

          const targetCubeId = connectorRecord?.targetCubeId || null;
          if (targetCubeId) {
            console.log(`[SYNC] Using target cube: ${targetCubeId}`);
          }

          // List all blobs
          const blobs = await connector.listBlobsWithMetadata();
          console.log(`[SYNC] Found ${blobs.length} blobs in Azure container`);

          const results: Array<{
            name: string;
            status: string;
            error?: string;
            documentId?: string;
          }> = [];
          let filesProcessed = 0;
          let filesSkipped = 0;
          let filesFailed = 0;

          // Ensure uploads directory exists
          const uploadsDir = path.join(
            process.cwd(),
            "uploads",
            "enterprise",
            domain.companyId,
          );
          await fs.mkdir(uploadsDir, { recursive: true });

          for (const blob of blobs) {
            // Skip unsupported file types
            if (!connector.isSupportedFileType(blob.name)) {
              results.push({
                name: blob.name,
                status: "skipped",
                error: "Unsupported file type",
              });
              filesSkipped++;
              continue;
            }

            try {
              // Download blob to buffer
              const downloadResult = await connector.downloadBlobToBuffer(
                blob.name,
              );
              if (!downloadResult) {
                results.push({
                  name: blob.name,
                  status: "failed",
                  error: "Download failed",
                });
                filesFailed++;
                continue;
              }

              // Generate unique filename
              const ext = path.extname(blob.name);
              const baseName = path.basename(blob.name, ext);
              const uniqueFileName = `${baseName}_${Date.now()}${ext}`;
              const filePath = path.join(uploadsDir, uniqueFileName);

              // Save file to disk
              await fs.writeFile(filePath, downloadResult.buffer);

              // Create enterprise document with version management (with cube assignment)
              const versionResult = await versionManager.createNewVersion(
                domain.companyId,
                user.id,
                blob.name,
                filePath,
                String(downloadResult.size),
                getFileMimeType(blob.name),
                "azure_blob",
                { blobName: blob.name, syncDate: new Date().toISOString() },
                domainId,
                targetCubeId,
              );

              // Trigger Python RAG processing
              try {
                const processResponse = await fetch(
                  `http://localhost:8000/api/v2/enterprise/process/${versionResult.documentId}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      file_path: filePath,
                      company_id: domain.companyId,
                    }),
                  },
                );
                if (processResponse.ok) {
                  console.log(
                    `[SYNC] 🔄 Triggered RAG processing for ${blob.name}`,
                  );
                }
              } catch (processError) {
                console.warn(
                  `[SYNC] ⚠️ RAG processing trigger failed for ${blob.name}:`,
                  processError,
                );
              }

              results.push({
                name: blob.name,
                status: "success",
                documentId: versionResult.documentId,
              });
              filesProcessed++;
              console.log(
                `[SYNC] ✅ Imported: ${blob.name} (v${versionResult.version}, archived ${versionResult.archivedCount} old versions)`,
              );
            } catch (error: any) {
              results.push({
                name: blob.name,
                status: "failed",
                error: error.message,
              });
              filesFailed++;
              console.error(
                `[SYNC] ❌ Failed to import ${blob.name}:`,
                error.message,
              );
            }
          }

          // Update connector status (reuse connectorRecord from above)
          if (connectorRecord) {
            await storage.updateDomainApiConnector(connectorRecord.id, {
              status:
                filesFailed > 0 && filesProcessed === 0 ? "error" : "active",
              lastSyncAt: new Date(),
              lastSyncResult: `Processed: ${filesProcessed}, Skipped: ${filesSkipped}, Failed: ${filesFailed}`,
              documentCount:
                (connectorRecord.documentCount || 0) + filesProcessed,
            });
          }

          console.log(
            `[SYNC] Azure Blob sync complete: ${filesProcessed} processed, ${filesSkipped} skipped, ${filesFailed} failed`,
          );

          res.json({
            success: true,
            filesProcessed,
            filesSkipped,
            filesFailed,
            files: results,
          });
        } else if (connectorType === "anaplan") {
          // Anaplan sync - trigger full export
          const anaplanConnector = await connectorRegistry.getAnaplanConnectorById(connectorId);
          if (!anaplanConnector) {
            return res.status(404).json({ error: "Anaplan connector not configured or disabled" });
          }

          const anaplanConnectorRecord = connectorRecord;
          const anaplanTargetCubeId = anaplanConnectorRecord?.targetCubeId || null;
          if (anaplanTargetCubeId) {
            console.log(`[SYNC] Using target cube: ${anaplanTargetCubeId}`);
          }

          // Trigger Anaplan full export sync
          const config = anaplanConnector.getConfig();
          const destinationDir = path.join(
            process.cwd(),
            "uploads",
            "enterprise",
            config.companyId,
            "anaplan",
          );

          const result =
            await anaplanConnector.runFullExportSync(destinationDir);

          // Create enterprise documents with version management for downloaded files
          let filesCreated = 0;
          let totalArchived = 0;
          for (const file of result.files) {
            if (file.success) {
              try {
                const versionResult = await versionManager.createNewVersion(
                  config.companyId,
                  user.id,
                  file.fileName,
                  file.filePath,
                  String(file.fileSize),
                  getFileMimeType(file.fileName),
                  "anaplan_manual",
                  {
                    processId: config.processId,
                    exportName: file.fileName,
                    syncDate: new Date().toISOString(),
                    taskId: result.taskId,
                  },
                  domainId,
                  anaplanTargetCubeId,
                );
                // Trigger Python RAG processing
                try {
                  const processResponse = await fetch(
                    `http://localhost:8000/api/v2/enterprise/process/${versionResult.documentId}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        file_path: file.filePath,
                        company_id: config.companyId,
                      }),
                    },
                  );
                  if (processResponse.ok) {
                    console.log(
                      `[SYNC] 🔄 Triggered RAG processing for ${file.fileName}`,
                    );
                  }
                } catch (processError) {
                  console.warn(
                    `[SYNC] ⚠️ RAG processing trigger failed for ${file.fileName}:`,
                    processError,
                  );
                }

                filesCreated++;
                totalArchived += versionResult.archivedCount;
                console.log(
                  `[SYNC] ✅ Created version ${versionResult.version} for ${file.fileName}`,
                );
              } catch (docError: any) {
                console.error(
                  `Failed to create document for ${file.fileName}:`,
                  docError.message,
                );
              }
            }
          }

          // Update connector status (reuse anaplanConnectorRecord from above)
          if (anaplanConnectorRecord) {
            await storage.updateDomainApiConnector(anaplanConnectorRecord.id, {
              status: result.success ? "active" : "error",
              lastSyncAt: new Date(),
              lastSyncResult: `Exported: ${result.files.length}, Created: ${filesCreated}, Archived: ${totalArchived}`,
              documentCount:
                (anaplanConnectorRecord.documentCount || 0) + filesCreated,
            });
          }

          console.log(
            `[SYNC] Anaplan sync complete: ${filesCreated} versions created, ${totalArchived} old versions archived`,
          );

          res.json({
            success: result.success,
            filesProcessed: filesCreated,
            filesFailed: result.files.filter((f) => !f.success).length,
            taskId: result.taskId,
            error: result.error,
          });
        } else {
          return res
            .status(400)
            .json({
              error: `Sync not supported for connector type: ${connectorType}`,
            });
        }
      } catch (error: any) {
        console.error("Error syncing connector:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Get domain admins (for multi-admin support)
  app.get("/api/domain-admin/admins", requireDomainAdmin, async (req, res) => {
    try {
      const isSuperAdmin = (req as any).isSuperAdmin;

      let domainId: string;
      if (isSuperAdmin) {
        domainId = req.query.domainId as string;
        if (!domainId) {
          return res
            .status(400)
            .json({
              error: "domainId query parameter required for super admin",
            });
        }
      } else {
        domainId = (req as any).domain.id;
      }

      const admins = await storage.getDomainAdmins(domainId);
      res.json(admins);
    } catch (error: any) {
      console.error("Error fetching domain admins:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // =============================================
  // KIOSK CHAT ROUTES (Bosch Billing Kiosk)
  // =============================================

  // Helper function to parse FAQ document text into structured entries
  // Supports formats: CSV with multi-line answers (quoted), pipe-separated, tab-separated, Q&A patterns
  function parseFaqDocument(
    text: string,
    documentId: string,
    domainId: string,
  ): Array<{
    documentId: string;
    domainId: string;
    billingCategory: string;
    question: string;
    answer: string;
  }> {
    const entries: Array<{
      documentId: string;
      domainId: string;
      billingCategory: string;
      question: string;
      answer: string;
    }> = [];

    // Normalize line endings
    const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Try parsing as proper CSV with quoted fields (handles multi-line answers)
    const csvEntries = parseCSVFormat(normalizedText, documentId, domainId);
    if (csvEntries.length > 0) {
      return csvEntries;
    }

    // Try pipe-separated format (common in Excel exports)
    const pipeEntries = parsePipeSeparatedFormat(
      normalizedText,
      documentId,
      domainId,
    );
    if (pipeEntries.length > 0) {
      return pipeEntries;
    }

    // Try Q&A pattern matching for Word/text documents
    const qaEntries = parseQAFormat(normalizedText, documentId, domainId);
    if (qaEntries.length > 0) {
      return qaEntries;
    }

    return entries;
  }

  // Parse CSV format with proper quote handling for multi-line answers
  function parseCSVFormat(
    text: string,
    documentId: string,
    domainId: string,
  ): Array<{
    documentId: string;
    domainId: string;
    billingCategory: string;
    question: string;
    answer: string;
  }> {
    const entries: Array<{
      documentId: string;
      domainId: string;
      billingCategory: string;
      question: string;
      answer: string;
    }> = [];

    // Simple CSV parser that handles quoted multi-line fields
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else if (char === '"') {
          inQuotes = false;
          i++;
          continue;
        } else {
          currentField += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        } else if (char === "," || char === "\t") {
          currentRow.push(currentField.trim());
          currentField = "";
          i++;
          continue;
        } else if (char === "\n") {
          currentRow.push(currentField.trim());
          if (currentRow.some((f) => f.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = "";
          i++;
          continue;
        } else {
          currentField += char;
          i++;
          continue;
        }
      }
    }

    // Don't forget the last field/row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
    }

    // Check if we have at least 3 columns (category, question, answer)
    if (rows.length < 2) return entries;

    // Skip header if present
    let startIdx = 0;
    const firstRow = rows[0].map((f) => f.toLowerCase());
    if (
      firstRow.some(
        (f) =>
          f.includes("category") ||
          f.includes("billing") ||
          f.includes("question") ||
          f.includes("answer") ||
          f.includes("faq"),
      )
    ) {
      startIdx = 1;
    }

    for (let r = startIdx; r < rows.length; r++) {
      const row = rows[r];
      if (row.length >= 3) {
        const [category, question, ...answerParts] = row;
        const answer = answerParts.join(" ").trim();

        if (
          category &&
          question &&
          answer &&
          category.length < 200 &&
          question.length > 3
        ) {
          entries.push({
            documentId,
            domainId,
            billingCategory: category.trim(),
            question: question.trim(),
            answer: answer,
          });
        }
      }
    }

    return entries;
  }

  // Parse pipe-separated format
  function parsePipeSeparatedFormat(
    text: string,
    documentId: string,
    domainId: string,
  ): Array<{
    documentId: string;
    domainId: string;
    billingCategory: string;
    question: string;
    answer: string;
  }> {
    const entries: Array<{
      documentId: string;
      domainId: string;
      billingCategory: string;
      question: string;
      answer: string;
    }> = [];

    const lines = text.split("\n").filter((l) => l.includes("|"));

    // Skip header
    let startIdx = 0;
    if (lines.length > 0) {
      const firstLine = lines[0].toLowerCase();
      if (
        firstLine.includes("category") ||
        firstLine.includes("question") ||
        firstLine.includes("answer")
      ) {
        startIdx = 1;
      }
    }

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split("|").map((p) => p.trim());
      if (parts.length >= 3) {
        const [category, question, ...answerParts] = parts;
        const answer = answerParts.join(" ").trim();

        if (category && question && answer && category.length < 200) {
          entries.push({
            documentId,
            domainId,
            billingCategory: category.trim(),
            question: question.trim(),
            answer: answer,
          });
        }
      }
    }

    return entries;
  }

  // Parse Q&A format from Word/text documents (handles multi-line answers)
  function parseQAFormat(
    text: string,
    documentId: string,
    domainId: string,
  ): Array<{
    documentId: string;
    domainId: string;
    billingCategory: string;
    question: string;
    answer: string;
  }> {
    const entries: Array<{
      documentId: string;
      domainId: string;
      billingCategory: string;
      question: string;
      answer: string;
    }> = [];

    const lines = text.split("\n").map((l) => l.trim());
    let currentCategory = "General";
    let currentQuestion = "";
    let currentAnswer = "";
    let inAnswer = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines but preserve answer continuity
      if (!line) {
        if (inAnswer && currentAnswer) {
          currentAnswer += "\n";
        }
        continue;
      }

      // Detect category headers (lines ending with : or all caps short lines)
      const isCategoryHeader =
        (line.endsWith(":") && line.length < 80 && !line.includes("?")) ||
        (line === line.toUpperCase() &&
          line.length < 60 &&
          !line.includes("?") &&
          /^[A-Z\s]+$/.test(line));

      if (isCategoryHeader) {
        // Save previous Q&A if exists
        if (currentQuestion && currentAnswer) {
          entries.push({
            documentId,
            domainId,
            billingCategory: currentCategory,
            question: currentQuestion,
            answer: currentAnswer.trim().replace(/\n+/g, " "),
          });
        }
        currentCategory = line.replace(/:$/, "").trim();
        currentQuestion = "";
        currentAnswer = "";
        inAnswer = false;
        continue;
      }

      // Detect question lines
      const isQuestion =
        line.endsWith("?") ||
        /^Q[\.:]\s*/i.test(line) ||
        /^\d+[\.:]\s*.+\?/.test(line) ||
        /^\*\*.+\?\*\*$/.test(line); // Markdown bold questions

      if (isQuestion) {
        // Save previous Q&A
        if (currentQuestion && currentAnswer) {
          entries.push({
            documentId,
            domainId,
            billingCategory: currentCategory,
            question: currentQuestion,
            answer: currentAnswer.trim().replace(/\n+/g, " "),
          });
        }

        // Clean question prefix
        currentQuestion = line
          .replace(/^Q[\.:]\s*/i, "")
          .replace(/^\d+[\.:]\s*/, "")
          .replace(/^\*\*/, "")
          .replace(/\*\*$/, "")
          .trim();
        currentAnswer = "";
        inAnswer = true;
        continue;
      }

      // If we're in answer mode, accumulate answer text
      if (inAnswer) {
        // Clean answer prefix if present
        const cleanLine = line.replace(/^A[\.:]\s*/i, "").trim();
        if (cleanLine) {
          currentAnswer += (currentAnswer ? " " : "") + cleanLine;
        }
      }
    }

    // Don't forget the last Q&A pair
    if (currentQuestion && currentAnswer) {
      entries.push({
        documentId,
        domainId,
        billingCategory: currentCategory,
        question: currentQuestion,
        answer: currentAnswer.trim().replace(/\n+/g, " "),
      });
    }

    return entries;
  }

  // Helper function to validate Bosch domain access
  async function validateBoschDomainAccess(
    user: any,
    requestedDomainId: string,
  ): Promise<{ valid: boolean; domain?: any; error?: string }> {
    const userEmail = user.username?.toLowerCase() || "";
    const isBoschEmail = userEmail.includes("@bosch.com");

    if (!isBoschEmail) {
      return { valid: false, error: "Kiosk is only available for Bosch users" };
    }

    // Validate domain exists
    const domain = await storage.getDomain(requestedDomainId);
    if (!domain) {
      return { valid: false, error: "Domain not found" };
    }

    // Verify domain is a Bosch domain
    const domainName = domain.name?.toLowerCase() || "";
    const isBoschDomain = domainName.includes("bosch");
    if (!isBoschDomain) {
      return { valid: false, error: "Access denied - not a Bosch domain" };
    }

    // Check user belongs to this domain (via domain_users or matching email domain)
    const userDomain = userEmail.split("@")[1] || "";
    const matchesDomain =
      domainName === userDomain || domainName.includes(userDomain);

    const domainUser = await storage.getDomainUserByEmail(userEmail);
    const belongsToDomain =
      domainUser?.domainId === requestedDomainId || matchesDomain;

    if (!belongsToDomain) {
      return { valid: false, error: "Access denied - user not in this domain" };
    }

    return { valid: true, domain };
  }

  // Create a new kiosk chat
  app.post("/api/kiosk/chats", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { domainId } = req.body;

      if (!domainId) {
        return res.status(400).json({ error: "domainId is required" });
      }

      // Validate Bosch domain access
      const access = await validateBoschDomainAccess(user, domainId);
      if (!access.valid) {
        return res.status(403).json({ error: access.error });
      }

      const chat = await storage.createKioskChat({
        userId: user.id,
        domainId,
        title: "Billing Query",
      });

      res.status(201).json(chat);
    } catch (error: any) {
      console.error("Error creating kiosk chat:", error);
      res.status(500).json({ error: "Failed to create chat" });
    }
  });

  // Get kiosk chat messages
  app.get("/api/kiosk/messages", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const chatId = req.query.chatId as string;

      if (!chatId) {
        return res
          .status(400)
          .json({ error: "chatId query parameter is required" });
      }

      // Verify user owns this chat (ownership check is critical for security)
      const chat = await storage.getKioskChat(chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Strict ownership verification - only owner can see messages
      if (chat.userId !== user.id) {
        console.warn(
          `[SECURITY] User ${user.id} attempted to access chat ${chatId} owned by ${chat.userId}`,
        );
        return res.status(404).json({ error: "Chat not found" });
      }

      // Also verify user has Bosch domain access
      const userEmail = user.username?.toLowerCase() || "";
      const isBoschEmail = userEmail.includes("@bosch.com");
      if (!isBoschEmail) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await storage.getKioskMessages(chatId);
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching kiosk messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send a message in kiosk chat (with streaming response)
  app.post("/api/kiosk/chat", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { chatId, message, domainId } = req.body;

      if (!chatId || !message) {
        return res
          .status(400)
          .json({ error: "chatId and message are required" });
      }

      // Verify user owns this chat
      const chat = await storage.getKioskChat(chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Strict ownership verification
      if (chat.userId !== user.id) {
        console.warn(
          `[SECURITY] User ${user.id} attempted to send to chat ${chatId} owned by ${chat.userId}`,
        );
        return res.status(404).json({ error: "Chat not found" });
      }

      // Validate Bosch domain access
      const access = await validateBoschDomainAccess(user, domainId);
      if (!access.valid) {
        return res.status(403).json({ error: access.error });
      }

      // Verify chat belongs to the requested domain
      if (chat.domainId !== domainId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Save user message
      await storage.createKioskMessage({
        chatId,
        role: "user",
        content: message,
      });

      // Set up streaming response
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Get parsed FAQ entries for this domain
      const faqEntries = await storage.getKioskFaqEntries(domainId);

      // Build structured FAQ context from parsed entries
      let faqContext = "";
      if (faqEntries.length > 0) {
        // Group entries by billing category
        const categorizedFaqs: Record<
          string,
          Array<{ question: string; answer: string }>
        > = {};
        for (const entry of faqEntries) {
          if (!categorizedFaqs[entry.billingCategory]) {
            categorizedFaqs[entry.billingCategory] = [];
          }
          categorizedFaqs[entry.billingCategory].push({
            question: entry.question,
            answer: entry.answer,
          });
        }

        // Format as structured FAQ
        const faqLines: string[] = [];
        for (const [category, faqs] of Object.entries(categorizedFaqs)) {
          faqLines.push(`\n## ${category}\n`);
          for (const faq of faqs) {
            faqLines.push(`Q: ${faq.question}`);
            faqLines.push(`A: ${faq.answer}\n`);
          }
        }
        faqContext = faqLines.join("\n");
      }

      // Generate response using OpenAI
      const systemPrompt = `You are a helpful Billing Kiosk assistant for NON-MCR (Non-Material Cost Recovery) billing queries at Bosch.
Your role is to answer questions about billing processes, contracts, pricing, travel expenses, and purchase actuals based on the provided FAQ knowledge base.

INSTRUCTIONS:
1. Answer questions based ONLY on the FAQ knowledge base provided below.
2. If the user's question matches a FAQ, provide the exact answer from the FAQ.
3. If multiple FAQs are relevant, combine the information coherently.
4. If the question is not covered by the FAQs, politely say you don't have that information and suggest contacting the billing team.
5. Be concise, professional, and helpful.
6. When referencing the source, mention the relevant billing category.

${faqContext ? `FAQ KNOWLEDGE BASE:\n${faqContext}` : "No FAQ documentation is currently available. Please provide general guidance and suggest contacting the billing team for specific queries."}`;

      // Using custom proxy /generate endpoint
      const response = await fetch(`${(process.env.OLLAMA_BASE_URL || "https://ollama.ledgerlm.ai").replace(/\/v1\/?$/, "").replace(/\/api\/?$/, "")}/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.OLLAMA_API_KEY || "ledgerlm-secret-key"
        },
        body: JSON.stringify({
          model: process.env.OLLAMA_CHAT_MODEL || "llama3.1:8b",
          prompt: `system: ${systemPrompt}\nuser: ${message}\nassistant:`,
          stream: true,
          options: {
            num_predict: 1000,
            temperature: 0.7,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            const content = json.response || "";
            if (content) {
              fullResponse += content;
              res.write(content);
              if ((res as any).flush) (res as any).flush();
            }
          } catch (e) {
            if (line.includes('}{')) {
              const parts = line.split('}{');
              for (let i = 0; i < parts.length; i++) {
                let p = parts[i];
                if (i > 0) p = '{' + p;
                if (i < parts.length - 1) p = p + '}';
                try {
                  const j = JSON.parse(p);
                  const c = j.response || "";
                  if (c) {
                    fullResponse += c;
                    res.write(c);
                    if ((res as any).flush) (res as any).flush();
                  }
                } catch (innerE) {}
              }
            } else {
              console.error('Error parsing Ollama stream chunk:', e, 'Line:', line);
            }
          }
        }
      }

      // Save assistant message
      await storage.createKioskMessage({
        chatId,
        role: "assistant",
        content: fullResponse,
      });

      // Update chat title based on first message
      if (chat.title === "Billing Query") {
        const shortTitle =
          message.substring(0, 50) + (message.length > 50 ? "..." : "");
        await storage.updateKioskChatTitle(chatId, shortTitle);
      }

      res.end();
    } catch (error: any) {
      console.error("Error in kiosk chat:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.end();
      }
    }
  });

  // Get kiosk FAQ documents (admin only)
  app.get("/api/kiosk/faq-documents", requireDomainAdmin, async (req, res) => {
    try {
      const isSuperAdmin = (req as any).isSuperAdmin;
      let domainId: string;

      if (isSuperAdmin) {
        domainId = req.query.domainId as string;
        if (!domainId) {
          return res
            .status(400)
            .json({
              error: "domainId query parameter required for super admin",
            });
        }
      } else {
        domainId = (req as any).domain.id;
      }

      const faqDocs = await storage.getKioskFaqDocuments(domainId);
      res.json(faqDocs);
    } catch (error: any) {
      console.error("Error fetching kiosk FAQ documents:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Upload kiosk FAQ document (admin only)
  app.post(
    "/api/kiosk/faq-documents",
    requireDomainAdmin,
    upload.single("file"),
    async (req, res) => {
      try {
        const user = (req as any).user;
        const isSuperAdmin = (req as any).isSuperAdmin;
        let domainId: string;

        if (isSuperAdmin) {
          domainId = req.body.domainId;
          if (!domainId) {
            return res
              .status(400)
              .json({ error: "domainId is required for super admin" });
          }
        } else {
          domainId = (req as any).domain.id;
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const { name, billingType } = req.body;

        // If billingType is provided, delete existing document of same type first (replace functionality)
        if (billingType) {
          const existingDocs = await storage.getKioskFaqDocuments(domainId);
          const existingDoc = existingDocs.find(
            (d) => d.billingType === billingType,
          );
          if (existingDoc) {
            // Delete FAQ entries first (CASCADE will handle this, but be explicit)
            await storage.deleteKioskFaqEntriesByDocument(existingDoc.id);
            // Delete file from disk
            if (existingDoc.filePath && existsSync(existingDoc.filePath)) {
              unlinkSync(existingDoc.filePath);
            }
            await storage.deleteKioskFaqDocument(existingDoc.id);
            console.log(
              `[AUDIT] Replaced existing FAQ document for billing type: ${billingType}`,
            );
          }
        }

        const faqDoc = await storage.createKioskFaqDocument({
          domainId,
          name: name || req.file.originalname,
          filePath: req.file.path,
          fileSize: String(req.file.size),
          fileType: req.file.mimetype,
          billingType: billingType || null,
          uploadedBy: user.id,
        });

        console.log(
          `[AUDIT] Kiosk FAQ document uploaded: ${faqDoc.name} by ${user.username}`,
        );

        // Parse FAQ document asynchronously
        (async () => {
          try {
            await storage.updateKioskFaqDocumentStatus(faqDoc.id, "processing");

            // Extract text from document using Python backend
            let documentText = "";
            try {
              const response = await fetch(
                "http://localhost:8000/documents/extract-text",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ file_path: faqDoc.filePath }),
                },
              );
              if (response.ok) {
                const data = (await response.json()) as { text: string };
                documentText = data.text || "";
              } else {
                // Fallback: try reading as text file
                documentText = await fs.readFile(faqDoc.filePath, "utf-8");
              }
            } catch (e) {
              console.warn(
                `Failed to extract text from FAQ document: ${faqDoc.name}`,
                e,
              );
              documentText = await fs
                .readFile(faqDoc.filePath, "utf-8")
                .catch(() => "");
            }

            if (!documentText) {
              await storage.updateKioskFaqDocumentStatus(faqDoc.id, "failed");
              return;
            }

            // Parse FAQ entries (format: billing category, question, answer - separated by lines or delimiters)
            const parsedEntries = parseFaqDocument(
              documentText,
              faqDoc.id,
              domainId,
            );

            if (parsedEntries.length > 0) {
              await storage.createKioskFaqEntriesBulk(parsedEntries);
              console.log(
                `[AUDIT] Parsed ${parsedEntries.length} FAQ entries from: ${faqDoc.name}`,
              );
            }

            await storage.updateKioskFaqDocumentStatus(faqDoc.id, "ready");
          } catch (parseError) {
            console.error("Error parsing FAQ document:", parseError);
            await storage.updateKioskFaqDocumentStatus(faqDoc.id, "failed");
          }
        })();

        res.status(201).json(faqDoc);
      } catch (error: any) {
        console.error("Error uploading kiosk FAQ document:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Delete kiosk FAQ document (admin only)
  app.delete(
    "/api/kiosk/faq-documents/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const user = (req as any).user;
        const docId = req.params.id;

        const doc = await storage.getKioskFaqDocument(docId);
        if (!doc) {
          return res.status(404).json({ error: "FAQ document not found" });
        }

        // Verify domain access
        const isSuperAdmin = (req as any).isSuperAdmin;
        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (doc.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        // Delete FAQ entries first
        await storage.deleteKioskFaqEntriesByDocument(docId);

        // Delete file from disk
        if (doc.filePath && existsSync(doc.filePath)) {
          unlinkSync(doc.filePath);
        }

        await storage.deleteKioskFaqDocument(docId);

        console.log(
          `[AUDIT] Kiosk FAQ document deleted: ${doc.name} by ${user.username}`,
        );
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting kiosk FAQ document:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // ==========================================
  // CUBE MANAGEMENT ROUTES (Domain Admin)
  // ==========================================

  // Get all cubes for a domain
  app.get("/api/domain-admin/cubes", requireDomainAdmin, async (req, res) => {
    try {
      const isSuperAdmin = (req as any).isSuperAdmin;
      let domainId: string;

      if (isSuperAdmin) {
        domainId = req.query.domainId as string;
        if (!domainId) {
          return res
            .status(400)
            .json({
              error: "domainId query parameter is required for super admin",
            });
        }
      } else {
        domainId = (req as any).domain.id;
      }

      const cubesList = await storage.getCubes(domainId);

      // Get document counts and redact sensitive fields for each cube
      const cubesWithCounts = await Promise.all(
        cubesList.map(async (cube) => {
          const safeCube: any = {
            ...cube,
            documentCount: await storage.getCubeDocumentCount(cube.id),
          };

          // Redact sensitive fields in ingestionConfig
          if (cube.ingestionConfig) {
            try {
              const config =
                typeof cube.ingestionConfig === "string"
                  ? JSON.parse(cube.ingestionConfig)
                  : cube.ingestionConfig;
              if (config.anaplan) {
                config.anaplan = redactSensitiveFields(config.anaplan, [
                  "password",
                ]);
              }
              if (config.azureBlob) {
                config.azureBlob = redactSensitiveFields(config.azureBlob, [
                  "accountKey",
                ]);
              }
              safeCube.ingestionConfig = JSON.stringify(config);
            } catch {
              // Keep original if parsing fails
            }
          }
          return safeCube;
        }),
      );

      res.json(cubesWithCounts);
    } catch (error: any) {
      console.error("Error fetching cubes:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get a specific cube
  app.get(
    "/api/domain-admin/cubes/:cubeId",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const { cubeId } = req.params;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify domain access
        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        const documentCount = await storage.getCubeDocumentCount(cube.id);

        // Redact sensitive fields before returning
        let safeCube = { ...cube, documentCount };
        if (cube.ingestionConfig) {
          try {
            const config =
              typeof cube.ingestionConfig === "string"
                ? JSON.parse(cube.ingestionConfig)
                : cube.ingestionConfig;
            if (config.anaplan) {
              config.anaplan = redactSensitiveFields(config.anaplan, [
                "password",
              ]);
            }
            if (config.azureBlob) {
              config.azureBlob = redactSensitiveFields(config.azureBlob, [
                "accountKey",
              ]);
            }
            safeCube.ingestionConfig = JSON.stringify(config);
          } catch {
            // Keep original if parsing fails
          }
        }
        res.json(safeCube);
      } catch (error: any) {
        console.error("Error fetching cube:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Create a new cube
  app.post("/api/domain-admin/cubes", requireDomainAdmin, async (req, res) => {
    try {
      const cubeParsed = createCubeSchema.safeParse(req.body);
      if (!cubeParsed.success) {
        return res.status(400).json({ error: "Invalid request", details: cubeParsed.error.flatten().fieldErrors });
      }

      const isSuperAdmin = (req as any).isSuperAdmin;
      const user = (req as any).user;

      let domainId: string;
      if (isSuperAdmin) {
        domainId = req.body.domainId;
        if (!domainId) {
          return res
            .status(400)
            .json({ error: "domainId is required for super admin" });
        }
      } else {
        domainId = (req as any).domain.id;
      }

      const { name, description } = cubeParsed.data;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Cube name is required" });
      }

      // Check if cube with this name already exists in the domain
      const existingCube = await storage.getCubeByName(domainId, name.trim());
      if (existingCube) {
        return res
          .status(409)
          .json({
            error: "A cube with this name already exists in this domain",
          });
      }

      const { sourceType, connectorId, ingestionConfig } = req.body;

      // Snapshot the raw Azure Blob credentials BEFORE any encryption so the
      // auto-connector creation below always gets the plaintext key.
      const rawAzureBlob = ingestionConfig?.azureBlob
        ? { ...ingestionConfig.azureBlob }
        : null;

      // Encrypt sensitive fields in ingestionConfig before storing
      // Use a deep-clone so the original `ingestionConfig` object is not mutated.
      let processedConfig = ingestionConfig ? JSON.parse(JSON.stringify(ingestionConfig)) : ingestionConfig;
      if (processedConfig) {
        // Encrypt Anaplan credentials
        if (processedConfig.anaplan) {
          processedConfig.anaplan = encryptSensitiveFields(
            processedConfig.anaplan,
            ["password"],
          );
        }
        // Encrypt Azure Blob credentials (all auth modes)
        if (processedConfig.azureBlob) {
          processedConfig.azureBlob = encryptSensitiveFields(
            processedConfig.azureBlob,
            ["accountKey", "sasToken", "clientSecret"],
          );
        }
      }

      const cube = await storage.createCube({
        domainId,
        name: name.trim(),
        description: description?.trim() || null,
        sourceType: sourceType || "manual",
        schemaType: (cubeParsed.data.schemaType as 'kpi' | 'investment_capex_pmo') || 'kpi',
        connectorId: connectorId || null,
        ingestionConfig: processedConfig
          ? JSON.stringify(processedConfig)
          : null,
        createdBy: user.id,
      });

      // Auto-create Azure Blob connector and link it to this cube
      // Uses rawAzureBlob (plaintext) — never the encrypted processedConfig.
      if (sourceType === 'azure_blob' && rawAzureBlob) {
        try {
          const ab = rawAzureBlob;
          const connectorConfig: Record<string, any> = {
            account_name: ab.accountName,
            container_name: ab.containerName,
            endpoint_suffix: ab.endpointSuffix || 'core.windows.net',
          };
          // Include whichever auth mode was provided (Azure AD > SAS > Shared Key)
          if (ab.tenantId && ab.clientId && ab.clientSecret) {
            connectorConfig.tenant_id = ab.tenantId;
            connectorConfig.client_id = ab.clientId;
            connectorConfig.client_secret = ab.clientSecret;
          } else if (ab.sasToken) {
            connectorConfig.sas_token = ab.sasToken;
          } else {
            connectorConfig.account_key = ab.accountKey;
          }
          const encryptedConfig = connectorRegistry.encryptConfig('azure_blob', connectorConfig);
          // Carry schedule settings from the cube's ingestion config
          const sched = ingestionConfig?.schedule;
          let schedHourAuto = 6, schedMinuteAuto = 0, schedTimezoneAuto = 'Asia/Kolkata', schedEnabledAuto = 0;
          if (sched?.enabled && sched.time) {
            const [sh, sm] = sched.time.split(':').map(Number);
            schedHourAuto = sh;
            schedMinuteAuto = sm;
            schedTimezoneAuto = sched.timezone || 'Asia/Kolkata';
            schedEnabledAuto = 1;
          }
          const autoConnector = await storage.createDomainApiConnector({
            domainId,
            connectorType: 'azure_blob',
            name: `${name.trim()} — Azure Blob`,
            enabled: 1,
            config: encryptedConfig,
            tags: [],
            status: 'pending',
            updatedBy: user.id,
            scheduleEnabled: schedEnabledAuto,
            scheduleHour: schedHourAuto,
            scheduleMinute: schedMinuteAuto,
            scheduleTimezone: schedTimezoneAuto,
            ...(ab.blobPrefix ? { blobPrefix: ab.blobPrefix.trim() } : {}),
          });
          // Link cube → connector (targetCubeId) and connector → cube (connectorId)
          await storage.updateDomainApiConnector(autoConnector.id, { targetCubeId: cube.id });
          await storage.updateCube(cube.id, { connectorId: autoConnector.id });
          connectorRegistry.clearCache(domainId);
          console.log(`[AUDIT] Auto-created Azure Blob connector (${autoConnector.id}) for cube ${cube.id} [schedule: ${schedEnabledAuto ? `${schedHourAuto}:${String(schedMinuteAuto).padStart(2,'0')} ${schedTimezoneAuto}` : 'disabled'}]`);
        } catch (connErr: any) {
          console.error('[CUBE-CREATE] Failed to auto-create Azure Blob connector:', connErr.message);
        }
      }

      if (processedConfig?.schedule?.enabled && processedConfig.schedule.time) {
        const [schedHour, schedMinute] = processedConfig.schedule.time.split(':').map(Number);
        const schedTimezone = processedConfig.schedule.timezone || 'Asia/Kolkata';
        await storage.upsertDomainSchedulerConfig(domainId, {
          enabled: 1,
          hour: schedHour,
          minute: schedMinute,
          timezone: schedTimezone,
          updatedBy: user.id,
        });
        await multiTenantScheduler.restartDomainScheduler(domainId);
        console.log(`[AUDIT] Scheduler started for domain ${domainId}: ${schedHour}:${String(schedMinute).padStart(2, '0')} ${schedTimezone}`);
      }

      console.log(
        `[AUDIT] Cube created: ${cube.name} (${cube.id}) by ${user.username}`,
      );
      res.status(201).json(cube);
    } catch (error: any) {
      console.error("Error creating cube:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update a cube
  app.put(
    "/api/domain-admin/cubes/:cubeId",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { cubeId } = req.params;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify domain access
        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        const { name, description, sourceType, connectorId, ingestionConfig } =
          req.body;

        const updates: any = {};
        if (name !== undefined) {
          if (typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({ error: "Cube name cannot be empty" });
          }
          // Check for duplicate name if name is changing
          if (name.trim() !== cube.name) {
            const existingCube = await storage.getCubeByName(
              cube.domainId,
              name.trim(),
            );
            if (existingCube && existingCube.id !== cubeId) {
              return res
                .status(409)
                .json({
                  error: "A cube with this name already exists in this domain",
                });
            }
          }
          updates.name = name.trim();
        }
        if (description !== undefined) {
          updates.description = description?.trim() || null;
        }
        if (sourceType !== undefined) {
          updates.sourceType = sourceType;
        }
        if (connectorId !== undefined) {
          updates.connectorId = connectorId;
        }
        if (ingestionConfig !== undefined) {
          // Deep-clone before encrypting so the original request object is not mutated
          let processedConfig = ingestionConfig ? JSON.parse(JSON.stringify(ingestionConfig)) : ingestionConfig;
          if (processedConfig) {
            if (processedConfig.anaplan) {
              processedConfig.anaplan = encryptSensitiveFields(
                processedConfig.anaplan,
                ["password"],
              );
            }
            if (processedConfig.azureBlob) {
              processedConfig.azureBlob = encryptSensitiveFields(
                processedConfig.azureBlob,
                ["accountKey", "sasToken", "clientSecret"],
              );
            }
          }
          updates.ingestionConfig = processedConfig
            ? JSON.stringify(processedConfig)
            : null;
        }

        const updatedCube = await storage.updateCube(cubeId, updates);

        if (ingestionConfig !== undefined) {
          const config = typeof ingestionConfig === 'string' ? JSON.parse(ingestionConfig) : ingestionConfig;
          const domainId = cube.domainId;
          if (config?.schedule?.enabled && config.schedule.time) {
            const [schedHour, schedMinute] = config.schedule.time.split(':').map(Number);
            const schedTimezone = config.schedule.timezone || 'Asia/Kolkata';
            await storage.upsertDomainSchedulerConfig(domainId, {
              enabled: 1,
              hour: schedHour,
              minute: schedMinute,
              timezone: schedTimezone,
              updatedBy: user.id,
            });
            await multiTenantScheduler.restartDomainScheduler(domainId);
            console.log(`[AUDIT] Scheduler updated for domain ${domainId}: ${schedHour}:${String(schedMinute).padStart(2, '0')} ${schedTimezone}`);
          } else if (config?.schedule && !config.schedule.enabled) {
            const domainId = cube.domainId;
            await storage.upsertDomainSchedulerConfig(domainId, {
              enabled: 0,
              updatedBy: user.id,
            });
            await multiTenantScheduler.stopDomainScheduler(domainId);
            console.log(`[AUDIT] Scheduler disabled for domain ${domainId}`);
          }
        }

        console.log(
          `[AUDIT] Cube updated: ${updatedCube?.name} (${cubeId}) by ${user.username}`,
        );
        res.json(updatedCube);
      } catch (error: any) {
        console.error("Error updating cube:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Delete a cube (supports ?force=true to delete with all documents)
  app.delete(
    "/api/domain-admin/cubes/:cubeId",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { cubeId } = req.params;
        const force = req.query.force === 'true';

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify domain access
        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        // Check if cube has documents (unless force delete)
        const documentCount = await storage.getCubeDocumentCount(cubeId);
        if (documentCount > 0 && !force) {
          return res.status(400).json({
            error:
              "Cannot delete cube with documents. Use force=true to delete everything.",
            documentCount,
          });
        }

        // deleteCube now handles deleting all related data including documents + connectors
        await storage.deleteCube(cubeId);
        console.log(
          `[AUDIT] Cube deleted (force=${force}): ${cube.name} (${cubeId}) by ${user.username}, documents: ${documentCount}`,
        );

        // Refresh in-memory scheduler so deleted connector schedules stop firing
        try {
          await multiTenantScheduler.restartDomainScheduler(cube.domainId);
        } catch (schedulerErr) {
          console.warn(`[Scheduler] Restart after cube delete failed (non-fatal):`, schedulerErr);
        }

        res.json({ success: true, deletedDocuments: documentCount });
      } catch (error: any) {
        console.error("Error deleting cube:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // ==========================================
  // CUBE USER ACCESS ROUTES (Domain Admin)
  // ==========================================

  // Get all users with access to a cube
  app.get(
    "/api/domain-admin/cubes/:cubeId/access",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const { cubeId } = req.params;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify domain access
        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        const accessList = await storage.getCubeUserAccess(cubeId);
        res.json(accessList);
      } catch (error: any) {
        console.error("Error fetching cube access:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Grant a user access to a cube
  app.post(
    "/api/domain-admin/cubes/:cubeId/access",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { cubeId } = req.params;
        const { userEmail } = req.body;

        if (!userEmail || typeof userEmail !== "string") {
          return res.status(400).json({ error: "userEmail is required" });
        }

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify domain access
        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        // Check if access already exists
        const existingAccess = await storage.getCubeAccessForUser(
          cubeId,
          userEmail,
        );
        if (existingAccess) {
          // Re-enable if disabled
          if (existingAccess.enabled === 0) {
            const updated = await storage.updateCubeAccess(
              existingAccess.id,
              1,
            );
            console.log(
              `[AUDIT] Cube access re-enabled: ${cube.name} for ${userEmail} by ${user.username}`,
            );
            return res.json(updated);
          }
          return res
            .status(409)
            .json({ error: "User already has access to this cube" });
        }

        const access = await storage.grantCubeAccess({
          cubeId,
          userEmail,
          enabled: 1,
          grantedBy: user.id,
        });

        console.log(
          `[AUDIT] Cube access granted: ${cube.name} for ${userEmail} by ${user.username}`,
        );
        res.status(201).json(access);
      } catch (error: any) {
        console.error("Error granting cube access:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Update cube access (enable/disable)
  app.patch(
    "/api/domain-admin/cubes/:cubeId/access/:accessId",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { cubeId, accessId } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== "boolean" && typeof enabled !== "number") {
          return res.status(400).json({ error: "enabled must be a boolean" });
        }

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify domain access
        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        const updatedAccess = await storage.updateCubeAccess(
          accessId,
          enabled ? 1 : 0,
        );
        console.log(
          `[AUDIT] Cube access ${enabled ? "enabled" : "disabled"}: ${cube.name} by ${user.username}`,
        );
        res.json(updatedAccess);
      } catch (error: any) {
        console.error("Error updating cube access:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Bulk update cube access (replace all access with selected users)
  app.put(
    "/api/domain-admin/cubes/:cubeId/access/bulk",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { cubeId } = req.params;
        const { userEmails } = req.body;

        if (!Array.isArray(userEmails)) {
          return res.status(400).json({ error: "userEmails must be an array" });
        }

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify domain access
        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        // Get current access list
        const currentAccess = await storage.getCubeUserAccess(cubeId);
        const currentEmails = new Set(
          currentAccess.map((a: any) => a.userEmail.toLowerCase()),
        );
        const newEmails = new Set(
          userEmails.map((e: string) => e.toLowerCase()),
        );

        // Revoke access for users no longer in the list
        for (const access of currentAccess) {
          if (!newEmails.has(access.userEmail.toLowerCase())) {
            await storage.revokeCubeAccess(cubeId, access.userEmail);
          }
        }

        // Grant access for new users
        for (const email of userEmails) {
          if (!currentEmails.has(email.toLowerCase())) {
            await storage.grantCubeAccess({
              cubeId,
              userEmail: email.toLowerCase(),
              grantedBy: user.id,
            });
          } else {
            // Enable if currently disabled
            const existing = currentAccess.find(
              (a: any) => a.userEmail.toLowerCase() === email.toLowerCase(),
            );
            if (existing && existing.enabled === 0) {
              await storage.updateCubeAccess(existing.id, 1);
            }
          }
        }

        console.log(
          `[AUDIT] Cube access bulk updated: ${cube.name} to ${userEmails.length} users by ${user.username}`,
        );
        res.json({ success: true, count: userEmails.length });
      } catch (error: any) {
        console.error("Error bulk updating cube access:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Revoke user access to a cube
  app.delete(
    "/api/domain-admin/cubes/:cubeId/access/:userEmail",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { cubeId, userEmail } = req.params;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify domain access
        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        await storage.revokeCubeAccess(cubeId, decodeURIComponent(userEmail));
        console.log(
          `[AUDIT] Cube access revoked: ${cube.name} for ${userEmail} by ${user.username}`,
        );
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error revoking cube access:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // ==========================================
  // CUBE METADATA ROUTES (For structured data indexing)
  // ==========================================

  // Get metadata for a cube
  app.get(
    "/api/domain-admin/cubes/:cubeId/metadata",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const { cubeId } = req.params;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        const metadata = await storage.getCubeMetadata(cubeId);
        res.json(
          metadata || {
            cubeId,
            entities: [],
            metrics: [],
            periods: [],
            customFields: {},
          },
        );
      } catch (error: any) {
        console.error("Error fetching cube metadata:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Update or create metadata for a cube
  app.put(
    "/api/domain-admin/cubes/:cubeId/metadata",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { cubeId } = req.params;
        const { entities, metrics, periods, customFields } = req.body;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        // Validate input types
        if (entities && !Array.isArray(entities)) {
          return res.status(400).json({ error: "entities must be an array" });
        }
        if (metrics && !Array.isArray(metrics)) {
          return res.status(400).json({ error: "metrics must be an array" });
        }
        if (periods && !Array.isArray(periods)) {
          return res.status(400).json({ error: "periods must be an array" });
        }

        const metadata = await storage.upsertCubeMetadata({
          cubeId,
          entities: entities || [],
          metrics: metrics || [],
          periods: periods || [],
          customFields: customFields || {},
          updatedBy: user.id,
        });

        console.log(
          `[AUDIT] Cube metadata updated: ${cube.name} by ${user.username} - entities: ${entities?.length || 0}, metrics: ${metrics?.length || 0}, periods: ${periods?.length || 0}`,
        );
        res.json(metadata);
      } catch (error: any) {
        console.error("Error updating cube metadata:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Delete metadata for a cube
  app.delete(
    "/api/domain-admin/cubes/:cubeId/metadata",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const isSuperAdmin = (req as any).isSuperAdmin;
        const user = (req as any).user;
        const { cubeId } = req.params;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        if (!isSuperAdmin) {
          const domainId = (req as any).domain.id;
          if (cube.domainId !== domainId) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        await storage.deleteCubeMetadata(cubeId);
        console.log(
          `[AUDIT] Cube metadata deleted: ${cube.name} by ${user.username}`,
        );
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting cube metadata:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // ==========================================
  // USER-FACING CUBE ACCESS ROUTES
  // ==========================================

  // Get cubes accessible to current user
  app.get("/api/cubes/accessible", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;

      // Get user's domain
      const membership = await storage.getCompanyMembership(
        user.id,
        user.companyId,
      );
      if (!membership) {
        return res.json([]);
      }

      // Find the domain for this company
      const allDomains = await storage.getAllDomains();
      const userDomain = allDomains.find((d) => d.companyId === user.companyId);
      if (!userDomain) {
        return res.json([]);
      }

      // Get accessible cube IDs
      const accessibleCubeIds = await storage.getAccessibleCubeIds(
        user.username,
        userDomain.id,
      );

      // Get full cube details
      const cubesList = await storage.getCubes(userDomain.id);
      const accessibleCubes = cubesList.filter((c) =>
        accessibleCubeIds.includes(c.id),
      );

      res.json(accessibleCubes);
    } catch (error: any) {
      console.error("Error fetching accessible cubes:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // CUBE BUSINESS LOGIC CONFIGURATION ROUTES
  // Manage business terms, calculations, filters, and query patterns
  // ==========================================

  // Get all business logic for a cube (terms, calculations, filters, patterns, values)
  app.get(
    "/api/domain-admin/cubes/:cubeId/business-logic",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const isSuperAdmin = (req as any).isSuperAdmin;

        // Verify cube exists and belongs to domain
        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        if (!isSuperAdmin) {
          const domain = (req as any).domain;
          if (cube.domainId !== domain.id) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        // Fetch all business logic tables for this cube
        const [terms, calculations, filters, patterns, columnValues, relationships] =
          await Promise.all([
            db
              .select()
              .from(cubeBusinessTerms)
              .where(eq(cubeBusinessTerms.cubeId, cubeId)),
            db
              .select()
              .from(cubeCalculationRules)
              .where(eq(cubeCalculationRules.cubeId, cubeId)),
            db
              .select()
              .from(cubeFilterRules)
              .where(eq(cubeFilterRules.cubeId, cubeId)),
            db
              .select()
              .from(cubeQueryPatterns)
              .where(eq(cubeQueryPatterns.cubeId, cubeId)),
            db
              .select()
              .from(cubeColumnValues)
              .where(eq(cubeColumnValues.cubeId, cubeId)),
            db
              .select()
              .from(cubeColumnRelationships)
              .where(eq(cubeColumnRelationships.cubeId, cubeId)),
          ]);

        res.json({
          terms,
          calculations,
          filters,
          patterns,
          columnValues,
          relationships,
        });
      } catch (error: any) {
        console.error("Error fetching cube business logic:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // === BUSINESS TERMS CRUD ===

  app.post(
    "/api/domain-admin/cubes/:cubeId/business-terms",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const {
          termName,
          termAliases,
          definition,
          sqlFilter,
          requiredColumns,
          category,
          priority,
        } = req.body;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        const [result] = await db
          .insert(cubeBusinessTerms)
          .values({
            cubeId,
            termName,
            termAliases: termAliases || [],
            definition,
            sqlFilter,
            requiredColumns: requiredColumns || [],
            category: category || "general",
            priority: priority || 0,
          })
          .returning();

        console.log(
          `[AUDIT] Business term created: ${termName} for cube ${cube.name}`,
        );
        res.json(result);
      } catch (error: any) {
        console.error("Error creating business term:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.put(
    "/api/domain-admin/business-terms/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        const [result] = await db
          .update(cubeBusinessTerms)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(cubeBusinessTerms.id, id))
          .returning();

        if (!result) {
          return res.status(404).json({ error: "Business term not found" });
        }

        res.json(result);
      } catch (error: any) {
        console.error("Error updating business term:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.delete(
    "/api/domain-admin/business-terms/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        await db.delete(cubeBusinessTerms).where(eq(cubeBusinessTerms.id, id));
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting business term:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // === CALCULATION RULES CRUD ===

  app.post(
    "/api/domain-admin/cubes/:cubeId/calculation-rules",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const {
          calculationName,
          calculationAliases,
          description,
          formula,
          sqlTemplate,
          formulaType,
          resultType,
          requiredColumns,
          defaultFilters,
          roundingPrecision,
        } = req.body;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        const [result] = await db
          .insert(cubeCalculationRules)
          .values({
            cubeId,
            calculationName,
            calculationAliases: calculationAliases || [],
            description,
            formula,
            sqlTemplate: sqlTemplate || null,
            formulaType: sqlTemplate ? "sql_template" : (formulaType || "ratio"),
            resultType: resultType || "percentage",
            requiredColumns: requiredColumns || [],
            defaultFilters,
            roundingPrecision: roundingPrecision || 2,
          })
          .returning();

        console.log(
          `[AUDIT] Calculation rule created: ${calculationName} for cube ${cube.name}`,
        );
        res.json(result);
      } catch (error: any) {
        console.error("Error creating calculation rule:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.put(
    "/api/domain-admin/calculation-rules/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        const [result] = await db
          .update(cubeCalculationRules)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(cubeCalculationRules.id, id))
          .returning();

        if (!result) {
          return res.status(404).json({ error: "Calculation rule not found" });
        }

        res.json(result);
      } catch (error: any) {
        console.error("Error updating calculation rule:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.delete(
    "/api/domain-admin/calculation-rules/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        await db
          .delete(cubeCalculationRules)
          .where(eq(cubeCalculationRules.id, id));
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting calculation rule:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // === FILTER RULES CRUD ===

  app.post(
    "/api/domain-admin/cubes/:cubeId/filter-rules",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const {
          filterName,
          filterAliases,
          description,
          sqlPredicate,
          targetColumn,
          isDefault,
        } = req.body;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        const [result] = await db
          .insert(cubeFilterRules)
          .values({
            cubeId,
            filterName,
            filterAliases: filterAliases || [],
            description,
            sqlPredicate,
            targetColumn,
            isDefault: isDefault ? 1 : 0,
          })
          .returning();

        console.log(
          `[AUDIT] Filter rule created: ${filterName} for cube ${cube.name}`,
        );
        res.json(result);
      } catch (error: any) {
        console.error("Error creating filter rule:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.put(
    "/api/domain-admin/filter-rules/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        if ("isDefault" in updates) {
          updates.isDefault = updates.isDefault ? 1 : 0;
        }

        const [result] = await db
          .update(cubeFilterRules)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(cubeFilterRules.id, id))
          .returning();

        if (!result) {
          return res.status(404).json({ error: "Filter rule not found" });
        }

        res.json(result);
      } catch (error: any) {
        console.error("Error updating filter rule:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.delete(
    "/api/domain-admin/filter-rules/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        await db.delete(cubeFilterRules).where(eq(cubeFilterRules.id, id));
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting filter rule:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // === QUERY PATTERNS CRUD ===

  app.post(
    "/api/domain-admin/cubes/:cubeId/query-patterns",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const {
          patternName,
          patternDescription,
          triggerPhrases,
          sqlTemplate,
          templateVariables,
          exampleQuestion,
          exampleSql,
          category,
        } = req.body;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        const [result] = await db
          .insert(cubeQueryPatterns)
          .values({
            cubeId,
            patternName,
            patternDescription,
            triggerPhrases: triggerPhrases || [],
            sqlTemplate,
            templateVariables,
            exampleQuestion,
            exampleSql,
            category: category || "general",
          })
          .returning();

        console.log(
          `[AUDIT] Query pattern created: ${patternName} for cube ${cube.name}`,
        );
        res.json(result);
      } catch (error: any) {
        console.error("Error creating query pattern:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.put(
    "/api/domain-admin/query-patterns/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        const [result] = await db
          .update(cubeQueryPatterns)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(cubeQueryPatterns.id, id))
          .returning();

        if (!result) {
          return res.status(404).json({ error: "Query pattern not found" });
        }

        res.json(result);
      } catch (error: any) {
        console.error("Error updating query pattern:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.delete(
    "/api/domain-admin/query-patterns/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        await db.delete(cubeQueryPatterns).where(eq(cubeQueryPatterns.id, id));
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting query pattern:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // === COLUMN VALUES CRUD ===

  app.post(
    "/api/domain-admin/cubes/:cubeId/column-values",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const {
          columnName,
          valueName,
          valueDescription,
          valueAliases,
          usageContext,
          relatedValues,
        } = req.body;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        const [result] = await db
          .insert(cubeColumnValues)
          .values({
            cubeId,
            columnName,
            valueName,
            valueDescription,
            valueAliases: valueAliases || [],
            usageContext,
            relatedValues: relatedValues || [],
          })
          .returning();

        console.log(
          `[AUDIT] Column value created: ${columnName}=${valueName} for cube ${cube.name}`,
        );
        res.json(result);
      } catch (error: any) {
        console.error("Error creating column value:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.put(
    "/api/domain-admin/column-values/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        const [result] = await db
          .update(cubeColumnValues)
          .set(updates)
          .where(eq(cubeColumnValues.id, id))
          .returning();

        if (!result) {
          return res.status(404).json({ error: "Column value not found" });
        }

        res.json(result);
      } catch (error: any) {
        console.error("Error updating column value:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.delete(
    "/api/domain-admin/column-values/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        await db.delete(cubeColumnValues).where(eq(cubeColumnValues.id, id));
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting column value:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Bulk import business logic from terminology/logic documents
  app.post(
    "/api/domain-admin/cubes/:cubeId/import-business-logic",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const { terms, calculations, filters, patterns, columnValues } =
          req.body;

        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        const results = {
          termsCreated: 0,
          calculationsCreated: 0,
          filtersCreated: 0,
          patternsCreated: 0,
          columnValuesCreated: 0,
        };

        // Import terms
        if (terms && Array.isArray(terms)) {
          for (const term of terms) {
            try {
              await db.insert(cubeBusinessTerms).values({ ...term, cubeId });
              results.termsCreated++;
            } catch (e) {
              /* skip duplicates */
            }
          }
        }

        // Import calculations
        if (calculations && Array.isArray(calculations)) {
          for (const calc of calculations) {
            try {
              await db.insert(cubeCalculationRules).values({ ...calc, cubeId });
              results.calculationsCreated++;
            } catch (e) {
              /* skip duplicates */
            }
          }
        }

        // Import filters
        if (filters && Array.isArray(filters)) {
          for (const filter of filters) {
            try {
              await db.insert(cubeFilterRules).values({ ...filter, cubeId });
              results.filtersCreated++;
            } catch (e) {
              /* skip duplicates */
            }
          }
        }

        // Import patterns
        if (patterns && Array.isArray(patterns)) {
          for (const pattern of patterns) {
            try {
              await db.insert(cubeQueryPatterns).values({ ...pattern, cubeId });
              results.patternsCreated++;
            } catch (e) {
              /* skip duplicates */
            }
          }
        }

        // Import column values
        if (columnValues && Array.isArray(columnValues)) {
          for (const cv of columnValues) {
            try {
              await db.insert(cubeColumnValues).values({ ...cv, cubeId });
              results.columnValuesCreated++;
            } catch (e) {
              /* skip duplicates */
            }
          }
        }

        console.log(
          `[AUDIT] Bulk imported business logic for cube ${cube.name}:`,
          results,
        );
        res.json({ success: true, ...results });
      } catch (error: any) {
        console.error("Error importing business logic:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Seed Bosch-specific business logic for a cube
  app.post(
    "/api/domain-admin/cubes/:cubeId/seed-bosch-logic",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const domain = (req as any).domain;
        const isSuperAdmin = (req as any).isSuperAdmin;

        // Verify cube exists
        const cube = await storage.getCube(cubeId);
        if (!cube) {
          return res.status(404).json({ error: "Cube not found" });
        }

        // Verify cube belongs to admin's domain (security check) - super admin can access all
        if (!isSuperAdmin && cube.domainId !== domain?.id) {
          return res
            .status(403)
            .json({
              error: "Access denied: cube does not belong to your domain",
            });
        }

        // Import Bosch business logic from seed file
        const {
          BOSCH_BUSINESS_TERMS,
          BOSCH_CALCULATION_RULES,
          BOSCH_FILTER_RULES,
          BOSCH_QUERY_PATTERNS,
          BOSCH_COLUMN_VALUES,
        } = await import("./seed/bosch-business-logic");

        const results = {
          termsCreated: 0,
          calculationsCreated: 0,
          filtersCreated: 0,
          patternsCreated: 0,
          columnValuesCreated: 0,
        };

        // Import terms
        for (const term of BOSCH_BUSINESS_TERMS) {
          try {
            await db.insert(cubeBusinessTerms).values({
              cubeId,
              termName: term.termName,
              termAliases: term.termAliases,
              definition: term.definition,
              sqlFilter: term.sqlFilter,
              requiredColumns: term.requiredColumns,
              category: term.category,
              priority: term.priority,
              isSeeded: 1,
            });
            results.termsCreated++;
          } catch (e) {
            /* skip duplicates */
          }
        }

        // Import calculations
        for (const calc of BOSCH_CALCULATION_RULES) {
          try {
            await db.insert(cubeCalculationRules).values({
              cubeId,
              calculationName: calc.calculationName,
              calculationAliases: calc.calculationAliases,
              description: calc.description,
              formula: calc.formula,
              formulaType: calc.formulaType,
              resultType: calc.resultType,
              requiredColumns: calc.requiredColumns,
              defaultFilters: calc.defaultFilters,
              roundingPrecision: calc.roundingPrecision,
              isSeeded: 1,
            });
            results.calculationsCreated++;
          } catch (e) {
            /* skip duplicates */
          }
        }

        // Import filters
        for (const filter of BOSCH_FILTER_RULES) {
          try {
            await db.insert(cubeFilterRules).values({
              cubeId,
              filterName: filter.filterName,
              filterAliases: filter.filterAliases,
              description: filter.description,
              sqlPredicate: filter.sqlPredicate,
              targetColumn: filter.targetColumn,
              isDefault: filter.isDefault ? 1 : 0,
              isSeeded: 1,
            });
            results.filtersCreated++;
          } catch (e) {
            /* skip duplicates */
          }
        }

        // Import patterns
        for (const pattern of BOSCH_QUERY_PATTERNS) {
          try {
            await db.insert(cubeQueryPatterns).values({
              cubeId,
              patternName: pattern.patternName,
              patternDescription: pattern.patternDescription,
              triggerPhrases: pattern.triggerPhrases,
              sqlTemplate: pattern.sqlTemplate,
              templateVariables: pattern.templateVariables,
              exampleQuestion: pattern.exampleQuestion,
              exampleSql: pattern.exampleSql,
              category: pattern.category,
              isSeeded: 1,
            });
            results.patternsCreated++;
          } catch (e) {
            /* skip duplicates */
          }
        }

        // Import column values
        for (const cv of BOSCH_COLUMN_VALUES) {
          try {
            await db.insert(cubeColumnValues).values({
              cubeId,
              columnName: cv.columnName,
              valueName: cv.valueName,
              valueDescription: cv.valueDescription,
              valueAliases: cv.valueAliases,
              usageContext: cv.usageContext,
              relatedValues: cv.relatedValues,
            });
            results.columnValuesCreated++;
          } catch (e) {
            /* skip duplicates */
          }
        }

        console.log(
          `[AUDIT] Seeded Bosch business logic for cube ${cube.name}:`,
          results,
        );
        res.json({
          success: true,
          message: `Seeded Bosch business logic for cube "${cube.name}"`,
          ...results,
        });
      } catch (error: any) {
        console.error("Error seeding Bosch business logic:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // Seed Investment/CAPEX/PMO business logic for a cube
  app.post(
    "/api/domain-admin/cubes/:cubeId/seed-investment-logic",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const domain = (req as any).domain;
        const isSuperAdmin = (req as any).isSuperAdmin;

        const cube = await storage.getCube(cubeId);
        if (!cube) return res.status(404).json({ error: "Cube not found" });
        if (!isSuperAdmin && cube.domainId !== domain?.id) {
          return res.status(403).json({ error: "Access denied: cube does not belong to your domain" });
        }

        const {
          INVESTMENT_BUSINESS_TERMS,
          INVESTMENT_CALCULATION_RULES,
          INVESTMENT_FILTER_RULES,
          INVESTMENT_QUERY_PATTERNS,
          INVESTMENT_COLUMN_VALUES,
        } = await import("./seed/investment-business-logic");

        const results = { termsCreated: 0, calculationsCreated: 0, filtersCreated: 0, patternsCreated: 0, columnValuesCreated: 0 };

        for (const term of INVESTMENT_BUSINESS_TERMS) {
          try {
            await db.insert(cubeBusinessTerms).values({ cubeId, termName: term.termName, termAliases: term.termAliases, definition: term.definition, sqlFilter: term.sqlFilter, requiredColumns: term.requiredColumns, category: term.category, priority: term.priority, isSeeded: 1 });
            results.termsCreated++;
          } catch (e) { /* skip duplicates */ }
        }
        for (const calc of INVESTMENT_CALCULATION_RULES) {
          try {
            await db.insert(cubeCalculationRules).values({ cubeId, calculationName: calc.calculationName, calculationAliases: calc.calculationAliases, description: calc.description, formula: calc.formula, formulaType: calc.formulaType, resultType: calc.resultType, requiredColumns: calc.requiredColumns, defaultFilters: calc.defaultFilters, roundingPrecision: calc.roundingPrecision, isSeeded: 1 });
            results.calculationsCreated++;
          } catch (e) { /* skip duplicates */ }
        }
        for (const filter of INVESTMENT_FILTER_RULES) {
          try {
            await db.insert(cubeFilterRules).values({ cubeId, filterName: filter.filterName, filterAliases: filter.filterAliases, description: filter.description, sqlPredicate: filter.sqlPredicate, targetColumn: filter.targetColumn, isDefault: filter.isDefault ? 1 : 0, isSeeded: 1 });
            results.filtersCreated++;
          } catch (e) { /* skip duplicates */ }
        }
        for (const pattern of INVESTMENT_QUERY_PATTERNS) {
          try {
            await db.insert(cubeQueryPatterns).values({ cubeId, patternName: pattern.patternName, patternDescription: pattern.patternDescription, triggerPhrases: pattern.triggerPhrases, sqlTemplate: pattern.sqlTemplate, templateVariables: pattern.templateVariables, exampleQuestion: pattern.exampleQuestion, exampleSql: pattern.exampleSql, category: pattern.category, isSeeded: 1 });
            results.patternsCreated++;
          } catch (e) { /* skip duplicates */ }
        }
        for (const cv of INVESTMENT_COLUMN_VALUES) {
          try {
            await db.insert(cubeColumnValues).values({ cubeId, columnName: cv.columnName, valueName: cv.valueName, valueDescription: cv.valueDescription, valueAliases: cv.valueAliases, usageContext: cv.usageContext, relatedValues: cv.relatedValues });
            results.columnValuesCreated++;
          } catch (e) { /* skip duplicates */ }
        }

        console.log(`[AUDIT] Seeded Investment/CAPEX/PMO business logic for cube ${cube.name}:`, results);
        res.json({ success: true, message: `Seeded Investment/CAPEX/PMO logic for cube "${cube.name}"`, ...results });
      } catch (error: any) {
        console.error("Error seeding Investment business logic:", error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // ==========================================
  // COLUMN RELATIONSHIPS CRUD
  // Maps how columns relate to each other to form metrics (e.g. numerator/denominator)
  // ==========================================

  app.get(
    "/api/domain-admin/cubes/:cubeId/column-relationships",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const isSuperAdmin = (req as any).isSuperAdmin;
        const cube = await storage.getCube(cubeId);
        if (!cube) return res.status(404).json({ error: "Cube not found" });
        if (!isSuperAdmin) {
          const domain = (req as any).domain;
          if (cube.domainId !== domain.id) return res.status(403).json({ error: "Access denied" });
        }
        const rows = await db
          .select()
          .from(cubeColumnRelationships)
          .where(eq(cubeColumnRelationships.cubeId, cubeId));
        res.json(rows);
      } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.post(
    "/api/domain-admin/cubes/:cubeId/column-relationships",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const { fromColumn, toColumn, relationshipType, role, metricName, description } = req.body;
        if (!fromColumn || !toColumn || !relationshipType || !description) {
          return res.status(400).json({ error: "fromColumn, toColumn, relationshipType, and description are required" });
        }
        const cube = await storage.getCube(cubeId);
        if (!cube) return res.status(404).json({ error: "Cube not found" });
        const [result] = await db
          .insert(cubeColumnRelationships)
          .values({ cubeId, fromColumn, toColumn, relationshipType, role, metricName, description })
          .returning();
        console.log(`[AUDIT] Column relationship created: ${fromColumn} → ${toColumn} for cube ${cube.name}`);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.put(
    "/api/domain-admin/column-relationships/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        const [result] = await db
          .update(cubeColumnRelationships)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(cubeColumnRelationships.id, id))
          .returning();
        if (!result) return res.status(404).json({ error: "Relationship not found" });
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  app.delete(
    "/api/domain-admin/column-relationships/:id",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        await db.delete(cubeColumnRelationships).where(eq(cubeColumnRelationships.id, id));
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // ==========================================
  // CUBE SQL QUERY CONSOLE ROUTES
  // ==========================================

  // GET /api/domain-admin/cubes/:cubeId/fact-columns
  // Returns all cube_fact_data column names grouped by type (dimensions / metrics)
  app.get(
    "/api/domain-admin/cubes/:cubeId/fact-columns",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const domain = (req as any).domain;
        const isSuperAdmin = (req as any).isSuperAdmin;

        const cube = await storage.getCube(cubeId);
        if (!cube) return res.status(404).json({ error: "Cube not found" });
        if (!isSuperAdmin && cube.domainId !== domain?.id)
          return res.status(403).json({ error: "Access denied" });

        const dimensions = [
          "cube_id", "year", "month", "cost_category", "sub_cost_category",
          "cost_category_class", "cost_type", "region_entity", "onsite_offshore",
          "sector", "project_gb", "planning_gb", "new_service_area",
          "proj_sub_service_area", "res_sub_service_area", "service_area",
          "section", "proj_top_bu", "proj_bu", "proj_top_section", "proj_section",
          "proj_dept", "proj_group", "res_bu", "res_section", "res_dept",
          "resource_type", "salary_level", "employee_number", "employee_name",
          "rate_classification", "skillset_classification", "project_id",
          "cost_center", "gl_account", "split_itrams_sds", "order_reason",
          "fund", "vkm_code", "profit_center", "prft_flag", "rdate",
          "include_exclude", "version", "released_status", "project_nonproject",
          "effort_type", "attrition", "attrition_type", "report",
          "bill_to_party_legal_entity_full_name",
        ];

        const metrics = [
          "amount_usd", "amount_inr", "billed_capacity", "allocated_capacity",
          "vkm_capacity", "ms_capacity", "not_allocated_capacity",
          "non_linear_capacity", "sl2_allocated_capacity",
          "sl2_not_allocated_capacity", "not_billed_not_allocated",
          "not_billed_allocated", "investment_capacity", "total_hours",
          "billable_hours", "headcount", "capacity", "srn_payable_pmo",
          "payable_allocated_cap", "payable_ms_cap", "payable_vkm_cap",
          "payable_not_allocated_cap", "payable_non_linear_cap",
          "payable_investment_cap", "payable_not_billed_allocated",
          "payable_not_billed_not_allocated", "payable_unbilled_cap_with_po",
        ];

        res.json({ dimensions, metrics, cubeId, cubeName: cube.name });
      } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // POST /api/domain-admin/cubes/:cubeId/sql-query
  // Executes a user-provided SELECT query with full security guardrails
  app.post(
    "/api/domain-admin/cubes/:cubeId/sql-query",
    requireDomainAdmin,
    async (req, res) => {
      try {
        const { cubeId } = req.params;
        const domain = (req as any).domain;
        const isSuperAdmin = (req as any).isSuperAdmin;
        const { query: rawQuery } = req.body;

        if (!rawQuery || typeof rawQuery !== "string") {
          return res.status(400).json({ error: "Query is required" });
        }

        // Verify cube ownership
        const cube = await storage.getCube(cubeId);
        if (!cube) return res.status(404).json({ error: "Cube not found" });
        if (!isSuperAdmin && cube.domainId !== domain?.id)
          return res.status(403).json({ error: "Access denied" });

        // Security: SELECT only
        const trimmed = rawQuery.trim();
        const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
        if (firstWord !== "SELECT") {
          return res.status(400).json({
            error: "Only SELECT queries are allowed. Data modification is not permitted.",
          });
        }

        // Security: Block dangerous keywords
        const dangerous =
          /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE|GRANT|REVOKE|COPY|pg_read_file|pg_ls_dir|pg_sleep)\b/i;
        if (dangerous.test(trimmed)) {
          return res.status(400).json({ error: "Query contains disallowed keywords." });
        }

        // Security: Must include cube_id filter to prevent cross-tenant access
        if (!/cube_id/i.test(trimmed)) {
          return res.status(400).json({
            error: `Security requirement: query must include cube_id filter. Add: WHERE cube_id = '${cubeId}'`,
          });
        }

        // Enforce maximum 500 rows — prevent runaway full-table scans
        let finalQuery = trimmed.replace(/;+$/, "");
        const limitMatch = finalQuery.match(/\bLIMIT\s+(\d+)/i);
        let wasTruncated = false;
        if (limitMatch) {
          const existing = parseInt(limitMatch[1]);
          if (existing > 500) {
            finalQuery = finalQuery.replace(/\bLIMIT\s+\d+/i, "LIMIT 500");
            wasTruncated = true;
          }
        } else {
          finalQuery += " LIMIT 500";
        }

        // Execute with 15-second application-level timeout
        const queryPromise = db.execute(sqlTag.raw(finalQuery));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Query exceeded 15-second timeout. Add more specific WHERE filters to narrow results.")),
            15000,
          ),
        );

        const result: any = await Promise.race([queryPromise, timeoutPromise]);

        const rows: any[] = result.rows || [];
        const columns: string[] =
          rows.length > 0
            ? Object.keys(rows[0])
            : (result.fields?.map((f: any) => f.name) ?? []);

        console.log(
          `[AUDIT] SQL Query Console: cube=${cubeId} user=${(req as any).user?.email} rows=${rows.length}`,
        );

        res.json({ columns, rows, rowCount: rows.length, truncated: wasTruncated || rows.length === 500 });
      } catch (error: any) {
        // Sanitize error message — never leak credentials or internal paths
        const msg = (error.message || "Query failed")
          .replace(/password=[^\s]*/gi, "[redacted]")
          .replace(/DATABASE_URL=[^\s]*/gi, "[redacted]");
        res.status(400).json({ error: msg });
      }
    },
  );

  // ==========================================
  // SEMANTIC SQL PROXY ROUTES
  // Proxy semantic-sql requests to Python backend
  // ==========================================

  app.all("/api/v2/semantic-sql/*", requireAuth, async (req, res) => {
    try {
      const PYTHON_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
      const targetPath = req.originalUrl;
      const targetUrl = `${PYTHON_URL}${targetPath}`;

      // Use AbortController for timeout (5 minutes for long operations)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: {
          "Content-Type": req.headers["content-type"] || "application/json",
        },
        signal: controller.signal,
      };

      if (req.method !== "GET" && req.method !== "HEAD") {
        if (req.headers["content-type"]?.includes("multipart/form-data")) {
          // For file uploads, forward the raw body
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => chunks.push(chunk));
          await new Promise<void>((resolve) => req.on("end", resolve));
          const body = Buffer.concat(chunks);
          fetchOptions.body = body;
          fetchOptions.headers = {
            "Content-Type": req.headers["content-type"] as string,
            "Content-Length": body.length.toString(),
          };
        } else {
          fetchOptions.body = JSON.stringify(req.body);
        }
      }

      const response = await fetch(targetUrl, fetchOptions);
      clearTimeout(timeoutId);
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Semantic SQL proxy error:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // SCHEMA CONFIG PROXY ROUTES
  // Proxy schema-config requests to Python backend
  // ==========================================

  app.all("/api/v2/schema-config/*", requireDomainAdmin, async (req, res) => {
    try {
      const PYTHON_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
      const targetPath = req.originalUrl;
      const targetUrl = `${PYTHON_URL}${targetPath}`;

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: {
          "Content-Type": req.headers["content-type"] || "application/json",
        },
      };

      if (req.method !== "GET" && req.method !== "HEAD") {
        if (req.headers["content-type"]?.includes("multipart/form-data")) {
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => chunks.push(chunk));
          await new Promise<void>((resolve) => req.on("end", resolve));
          const body = Buffer.concat(chunks);
          fetchOptions.body = body;
          fetchOptions.headers = {
            "Content-Type": req.headers["content-type"] as string,
            "Content-Length": body.length.toString(),
          };
        } else {
          fetchOptions.body = JSON.stringify(req.body);
        }
      }

      const response = await fetch(targetUrl, fetchOptions);
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Schema config proxy error:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Domain Admin SSO Audit ────────────────────────────────────────────────
  // These routes are scoped to the logged-in admin's domain via requireDomainAdmin.
  // Super admins may pass ?domainId= to inspect any tenant (mirrors the users pattern).
  const SSO_AUDIT_ACTIONS = ['SSO_LOGIN','SSO_LOGIN_FAILED','SSO_USER_PROVISIONED','SSO_USER_DEACTIVATED','SSO_ROLE_SYNCED','SSO_ROLE_UPDATED'];
  const ssoActionsLiteral = SSO_AUDIT_ACTIONS.map(a => `'${a}'`).join(',');

  app.get("/api/domain-admin/sso-audit-logs", requireDomainAdmin, async (req, res) => {
    try {
      const isSuperAdmin = (req as any).isSuperAdmin;
      const domain = (req as any).domain;
      const { action, email, from, to, domainId, page = "1", limit = "50" } = req.query as Record<string, string>;
      const pageNum  = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const offsetNum = (pageNum - 1) * limitNum;

      // Resolve domain name: super admin may pass domainId, regular admin is locked to their domain
      let domainName: string | null = null;
      if (isSuperAdmin && domainId) {
        const d = await storage.getDomain(domainId);
        domainName = d?.name ?? null;
      } else if (domain?.name) {
        domainName = domain.name;
      }
      if (!domainName) return res.status(400).json({ error: "No domain resolved" });

      const parts: ReturnType<typeof sql>[] = [
        sql`action = ANY(ARRAY[${sql.raw(ssoActionsLiteral)}])`,
        sql`(resource = ${domainName} OR details->>'domain' = ${domainName})`,
      ];
      if (action && SSO_AUDIT_ACTIONS.includes(action)) parts.push(sql`action = ${action}`);
      if (email)  parts.push(sql`details->>'email' ILIKE ${'%' + email + '%'}`);
      if (from)   parts.push(sql`created_at >= ${new Date(from)}`);
      if (to)     parts.push(sql`created_at <= ${new Date(to + 'T23:59:59')}`);
      const where = sql.join(parts, sql` AND `);

      const [dataRows, countRow] = await Promise.all([
        db.execute(sql`SELECT id, user_id, action, resource, resource_id, ip_address, status, details, created_at FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`),
        db.execute(sql`SELECT COUNT(*) AS total FROM audit_logs WHERE ${where}`),
      ]);

      res.json({ logs: dataRows.rows, total: Number((countRow.rows[0] as any).total), page: pageNum, limit: limitNum });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/domain-admin/sso-audit-logs/stats", requireDomainAdmin, async (req, res) => {
    try {
      const isSuperAdmin = (req as any).isSuperAdmin;
      const domain = (req as any).domain;
      const { domainId } = req.query as Record<string, string>;

      let domainName: string | null = null;
      if (isSuperAdmin && domainId) {
        const d = await storage.getDomain(domainId);
        domainName = d?.name ?? null;
      } else if (domain?.name) {
        domainName = domain.name;
      }
      if (!domainName) return res.status(400).json({ error: "No domain resolved" });

      const ssoArr = sql.raw(ssoActionsLiteral);
      const [breakdown, totalRow] = await Promise.all([
        db.execute(sql`
          SELECT action, status, COUNT(*) AS cnt FROM audit_logs
          WHERE action = ANY(ARRAY[${ssoArr}])
            AND (resource = ${domainName} OR details->>'domain' = ${domainName})
            AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY action, status`),
        db.execute(sql`SELECT COUNT(*) AS total FROM audit_logs WHERE action = ANY(ARRAY[${ssoArr}]) AND (resource = ${domainName} OR details->>'domain' = ${domainName})`),
      ]);

      const rows = breakdown.rows as { action: string; status: string; cnt: string }[];
      const count = (a: string, s?: string) => rows.filter(r => r.action === a && (!s || r.status === s)).reduce((sum, r) => sum + Number(r.cnt), 0);

      res.json({
        totalEvents: Number((totalRow.rows[0] as any).total),
        loginsLast30d: count('SSO_LOGIN', 'success'),
        provisionedLast30d: count('SSO_USER_PROVISIONED', 'success'),
        deactivatedLast30d: count('SSO_USER_DEACTIVATED', 'success'),
        roleChangesLast30d: count('SSO_ROLE_SYNCED') + count('SSO_ROLE_UPDATED'),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/domain-admin/sso-audit-logs/export", requireDomainAdmin, async (req, res) => {
    try {
      const isSuperAdmin = (req as any).isSuperAdmin;
      const domain = (req as any).domain;
      const { action, email, from, to, domainId } = req.query as Record<string, string>;

      let domainName: string | null = null;
      if (isSuperAdmin && domainId) {
        const d = await storage.getDomain(domainId);
        domainName = d?.name ?? null;
      } else if (domain?.name) {
        domainName = domain.name;
      }
      if (!domainName) return res.status(400).json({ error: "No domain resolved" });

      const ssoArr = sql.raw(ssoActionsLiteral);
      const parts: ReturnType<typeof sql>[] = [
        sql`action = ANY(ARRAY[${ssoArr}])`,
        sql`(resource = ${domainName} OR details->>'domain' = ${domainName})`,
      ];
      if (action && SSO_AUDIT_ACTIONS.includes(action)) parts.push(sql`action = ${action}`);
      if (email)  parts.push(sql`details->>'email' ILIKE ${'%' + email + '%'}`);
      if (from)   parts.push(sql`created_at >= ${new Date(from)}`);
      if (to)     parts.push(sql`created_at <= ${new Date(to + 'T23:59:59')}`);
      const where = sql.join(parts, sql` AND `);

      const rows = await db.execute(sql`SELECT id, user_id, action, resource, ip_address, status, details, created_at FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT 10000`);

      const header = "timestamp,email,domain,event,role_change,triggered_by,status,ip_address\n";
      const csv = header + (rows.rows as any[]).map((r) => {
        const d = r.details || {};
        const roleChange = d.oldRole && d.newRole ? `${d.oldRole} -> ${d.newRole}` : (d.role || '');
        return [r.created_at, d.email || r.user_id || '', d.domain || r.resource || '', r.action, roleChange, d.triggeredBy || '', r.status, r.ip_address || '']
          .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
      }).join('\n');

      const date = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${domainName}-sso-audit-${date}.csv"`);
      res.send(csv);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Health endpoint (Azure App Service probe) ─────────────────────────────
  app.get("/api/health", async (_req, res) => {
    const checks: Record<string, string> = {};
    let healthy = true;

    // DB check
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = "ok";
    } catch (e: any) {
      checks.database = `error: ${e.message?.slice(0, 80)}`;
      healthy = false;
    }

    // Python backend check
    try {
      const resp = await fetch("http://localhost:8000/health", { signal: AbortSignal.timeout(3000) });
      checks.python = resp.ok ? "ok" : `http_${resp.status}`;
      if (!resp.ok) healthy = false;
    } catch {
      checks.python = "unreachable";
      healthy = false;
    }

    const uptimeSeconds = Math.floor(process.uptime());
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "healthy" : "degraded",
      uptime_seconds: uptimeSeconds,
      service: "LedgerLM API",
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Audit Log API ─────────────────────────────────────────────────────────
  app.get("/api/super-admin/audit-logs", requireSuperAdmin, async (req, res) => {
    try {
      const { action, userId, status, from, to, page = "1", limit = "50" } = req.query as Record<string, string>;
      const pageNum  = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const offsetNum = (pageNum - 1) * limitNum;

      // Build parameterised WHERE clause using drizzle sql template tag
      const parts: ReturnType<typeof sql>[] = [sql`1=1`];
      if (action) parts.push(sql`action = ${action}`);
      if (userId) parts.push(sql`(user_id = ${userId} OR details::text ILIKE ${'%' + userId + '%'})`);
      if (status) parts.push(sql`status = ${status}`);
      if (from)   parts.push(sql`created_at >= ${new Date(from)}`);
      if (to)     parts.push(sql`created_at <= ${new Date(to)}`);
      const where = sql.join(parts, sql` AND `);

      const [dataRows, countRow] = await Promise.all([
        db.execute(sql`SELECT id, user_id, action, resource, resource_id, ip_address, status, details, created_at FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`),
        db.execute(sql`SELECT COUNT(*) AS total FROM audit_logs WHERE ${where}`),
      ]);

      res.json({
        logs: dataRows.rows,
        total: Number((countRow.rows[0] as any).total),
        page: pageNum,
        limit: limitNum,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/super-admin/audit-logs/stats", requireSuperAdmin, async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT action, status, COUNT(*) AS cnt
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY action, status
        ORDER BY cnt DESC
      `);
      const total = await db.execute(sql`SELECT COUNT(*) AS total FROM audit_logs`);
      res.json({ breakdown: rows.rows, total: Number((total.rows[0] as any).total) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/super-admin/audit-logs/export", requireSuperAdmin, async (req, res) => {
    try {
      const { action, from, to } = req.query as Record<string, string>;
      const exportParts: ReturnType<typeof sql>[] = [sql`1=1`];
      if (action) exportParts.push(sql`action = ${action}`);
      if (from)   exportParts.push(sql`created_at >= ${new Date(from)}`);
      if (to)     exportParts.push(sql`created_at <= ${new Date(to)}`);
      const exportWhere = sql.join(exportParts, sql` AND `);

      const rows = await db.execute(sql`SELECT id, user_id, action, resource, resource_id, ip_address, status, details, created_at FROM audit_logs WHERE ${exportWhere} ORDER BY created_at DESC LIMIT 10000`);

      const header = "id,user_id,action,resource,resource_id,ip_address,status,details,created_at\n";
      const csv = header + (rows.rows as any[]).map((r) =>
        [r.id, r.user_id, r.action, r.resource, r.resource_id, r.ip_address, r.status,
          JSON.stringify(r.details || {}), r.created_at].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      ).join("\n");

      const date = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="ledgerlm-audit-log-${date}.csv"`);
      res.send(csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── SSO User Lifecycle Audit API ─────────────────────────────────────────
  const SSO_ACTIONS = ['SSO_LOGIN', 'SSO_LOGIN_FAILED', 'SSO_USER_PROVISIONED', 'SSO_USER_DEACTIVATED', 'SSO_ROLE_SYNCED', 'SSO_ROLE_UPDATED'];

  app.get("/api/super-admin/sso-audit-logs", requireSuperAdmin, async (req, res) => {
    try {
      const { action, email, domain, from, to, page = "1", limit = "50" } = req.query as Record<string, string>;
      const pageNum  = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const offsetNum = (pageNum - 1) * limitNum;

      const parts: ReturnType<typeof sql>[] = [
        sql`action = ANY(ARRAY[${sql.raw(SSO_ACTIONS.map(a => `'${a}'`).join(','))}])`,
      ];
      if (action && SSO_ACTIONS.includes(action)) parts.push(sql`action = ${action}`);
      if (email)  parts.push(sql`details->>'email' ILIKE ${'%' + email + '%'}`);
      if (domain) parts.push(sql`(resource ILIKE ${'%' + domain + '%'} OR details->>'domain' ILIKE ${'%' + domain + '%'})`);
      if (from)   parts.push(sql`created_at >= ${new Date(from)}`);
      if (to)     parts.push(sql`created_at <= ${new Date(to + 'T23:59:59')}`);
      const where = sql.join(parts, sql` AND `);

      const [dataRows, countRow] = await Promise.all([
        db.execute(sql`SELECT id, user_id, action, resource, resource_id, ip_address, status, details, created_at FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`),
        db.execute(sql`SELECT COUNT(*) AS total FROM audit_logs WHERE ${where}`),
      ]);

      res.json({
        logs: dataRows.rows,
        total: Number((countRow.rows[0] as any).total),
        page: pageNum,
        limit: limitNum,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/super-admin/sso-audit-logs/stats", requireSuperAdmin, async (_req, res) => {
    try {
      const ssoActionsArray = sql.raw(SSO_ACTIONS.map(a => `'${a}'`).join(','));
      const [breakdown, totalRow] = await Promise.all([
        db.execute(sql`
          SELECT action, status, COUNT(*) AS cnt
          FROM audit_logs
          WHERE action = ANY(ARRAY[${ssoActionsArray}])
            AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY action, status
        `),
        db.execute(sql`SELECT COUNT(*) AS total FROM audit_logs WHERE action = ANY(ARRAY[${ssoActionsArray}])`),
      ]);

      const rows = breakdown.rows as { action: string; status: string; cnt: string }[];
      const count = (action: string, status?: string) =>
        rows.filter(r => r.action === action && (!status || r.status === status))
          .reduce((s, r) => s + Number(r.cnt), 0);

      res.json({
        totalEvents: Number((totalRow.rows[0] as any).total),
        loginsLast30d: count('SSO_LOGIN', 'success'),
        provisionedLast30d: count('SSO_USER_PROVISIONED', 'success'),
        deactivatedLast30d: count('SSO_USER_DEACTIVATED', 'success'),
        roleChangesLast30d: count('SSO_ROLE_SYNCED') + count('SSO_ROLE_UPDATED'),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/super-admin/sso-audit-logs/export", requireSuperAdmin, async (req, res) => {
    try {
      const { action, email, domain, from, to } = req.query as Record<string, string>;
      const ssoActionsArray = sql.raw(SSO_ACTIONS.map(a => `'${a}'`).join(','));
      const parts: ReturnType<typeof sql>[] = [
        sql`action = ANY(ARRAY[${ssoActionsArray}])`,
      ];
      if (action && SSO_ACTIONS.includes(action)) parts.push(sql`action = ${action}`);
      if (email)  parts.push(sql`details->>'email' ILIKE ${'%' + email + '%'}`);
      if (domain) parts.push(sql`(resource ILIKE ${'%' + domain + '%'} OR details->>'domain' ILIKE ${'%' + domain + '%'})`);
      if (from)   parts.push(sql`created_at >= ${new Date(from)}`);
      if (to)     parts.push(sql`created_at <= ${new Date(to + 'T23:59:59')}`);
      const where = sql.join(parts, sql` AND `);

      const rows = await db.execute(sql`
        SELECT id, user_id, action, resource, ip_address, status, details, created_at
        FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT 10000
      `);

      const header = "timestamp,email,domain,event,role_change,triggered_by,status,ip_address,raw_details\n";
      const csv = header + (rows.rows as any[]).map((r) => {
        const d = r.details || {};
        const roleChange = d.oldRole && d.newRole ? `${d.oldRole} -> ${d.newRole}` : (d.role || '');
        return [
          r.created_at, d.email || r.user_id || '', d.domain || r.resource || '',
          r.action, roleChange, d.triggeredBy || '', r.status, r.ip_address || '',
          JSON.stringify(d),
        ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
      }).join('\n');

      const date = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ledgerlm-sso-audit-${date}.csv"`);
      res.send(csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Backup API ────────────────────────────────────────────────────────────
  app.get("/api/super-admin/backups", requireSuperAdmin, async (_req, res) => {
    try {
      const backups = await listBackups(30);
      res.json(backups);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/super-admin/backups/trigger", requireSuperAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const triggeredBy = user?.username || "super-admin";
      // Fire async — respond immediately so UI doesn't hang
      res.json({ message: "Backup started", triggeredBy });
      runBackup(triggeredBy).catch((e) => logger.error({ e }, "Manual backup error"));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── System Status ─────────────────────────────────────────────────────────
  app.get("/api/super-admin/system-status", requireSuperAdmin, async (_req, res) => {
    try {
      const [dbRow, auditCount, backupRow] = await Promise.all([
        db.execute(sql`SELECT pg_database_size(current_database()) AS db_size, COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public'`),
        db.execute(sql`SELECT COUNT(*) AS total FROM audit_logs`),
        db.execute(sql`SELECT status, created_at, size_bytes, filename FROM backup_logs ORDER BY created_at DESC LIMIT 1`).catch(() => ({ rows: [] })),
      ]);

      const dbInfo = dbRow.rows[0] as any;
      const lastBackup = (backupRow.rows[0] as any) ?? null;

      let pythonStatus = "unknown";
      try {
        const r = await fetch("http://localhost:8000/health", { signal: AbortSignal.timeout(3000) });
        pythonStatus = r.ok ? "healthy" : "degraded";
      } catch { pythonStatus = "unreachable"; }

      res.json({
        database: {
          sizeBytes: Number(dbInfo?.db_size ?? 0),
          tableCount: Number(dbInfo?.table_count ?? 0),
          status: "connected",
          provider: process.env.AZURE_POSTGRESQL_URL ? "Azure PostgreSQL" : "Neon PostgreSQL",
        },
        auditLog: { totalEvents: Number((auditCount.rows[0] as any)?.total ?? 0) },
        lastBackup: lastBackup ? {
          status: lastBackup.status,
          filename: lastBackup.filename,
          sizeBytes: Number(lastBackup.size_bytes),
          createdAt: lastBackup.created_at,
        } : null,
        python: { status: pythonStatus },
        uptime: Math.floor(process.uptime()),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Retention Policies API ────────────────────────────────────────────────
  app.get("/api/super-admin/retention-policies", requireSuperAdmin, async (_req, res) => {
    try {
      res.json(await listRetentionPolicies());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/super-admin/retention-policies/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { retainDays, enabled } = req.body;
      const updated = await updateRetentionPolicy(req.params.id, { retainDays, enabled });
      if (!updated) return res.status(404).json({ error: "Policy not found" });
      writeAuditLog({
        userId: (req as any).user?.id,
        action: "ADMIN_DOMAIN_UPDATE",
        resource: "retention_policy",
        resourceId: req.params.id,
        ipAddress: extractIp(req),
        details: { retainDays, enabled },
      }).catch(() => {});
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/super-admin/retention-policies/run", requireSuperAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      res.json({ message: "Retention engine started" });
      runRetentionEngine(user?.username || "manual").catch((e) => logger.error({ e }, "Manual retention error"));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Scheduler Settings ────────────────────────────────────────────────────
  app.get("/api/super-admin/scheduler-settings", requireSuperAdmin, async (_req, res) => {
    try {
      const { getSchedulerSettings } = await import("./services/schedulerService");
      const settings = await getSchedulerSettings();
      // Never expose the full connection string to the client — just mask it
      res.json({
        backupUtcHour: settings.backupUtcHour,
        blobConnectionStringSet: !!settings.blobConnectionString,
        blobConnectionStringMasked: settings.blobConnectionString
          ? settings.blobConnectionString.replace(/AccountKey=[^;]+/, "AccountKey=***")
          : null,
        blobContainer: settings.blobContainer,
        updatedAt: settings.updatedAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/super-admin/scheduler-settings", requireSuperAdmin, async (req, res) => {
    try {
      const { updateSchedulerSettings } = await import("./services/schedulerService");
      const { backupUtcHour, blobConnectionString, blobContainer } = req.body;
      const updated = await updateSchedulerSettings({
        ...(backupUtcHour !== undefined && { backupUtcHour: Number(backupUtcHour) }),
        ...(blobConnectionString !== undefined && { blobConnectionString }),
        ...(blobContainer !== undefined && { blobContainer }),
      });
      res.json({
        backupUtcHour: updated.backupUtcHour,
        blobConnectionStringSet: !!updated.blobConnectionString,
        blobConnectionStringMasked: updated.blobConnectionString
          ? updated.blobConnectionString.replace(/AccountKey=[^;]+/, "AccountKey=***")
          : null,
        blobContainer: updated.blobContainer,
        updatedAt: updated.updatedAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/super-admin/scheduler-settings/test-blob", requireSuperAdmin, async (req, res) => {
    try {
      const { testBlobConnection, getSchedulerSettings } = await import("./services/schedulerService");
      let { connectionString, container } = req.body;
      // If no new connection string provided, test the saved one
      if (!connectionString) {
        const saved = await getSchedulerSettings();
        connectionString = saved.blobConnectionString;
        container = container || saved.blobContainer;
      }
      if (!connectionString) {
        return res.json({ ok: false, error: "No connection string configured" });
      }
      const result = await testBlobConnection(connectionString, container || "ledgerlm-backups");
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Scheduler Logs ────────────────────────────────────────────────────────
  app.get("/api/super-admin/scheduler-logs", requireSuperAdmin, async (req, res) => {
    try {
      const { listSchedulerLogs } = await import("./services/schedulerService");
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const logs = await listSchedulerLogs(limit);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PPT file download route — requireAuth ensures only logged-in users can
  // retrieve exported decks. path.basename already blocks path traversal and
  // the .pptx check limits type, but without auth any unauthenticated party
  // who guesses a filename could retrieve another tenant's financial deck.
  // (SAST Finding 5)
  app.get("/api/download/ppt/:filename", requireAuth, (req, res) => {
    const filename = path.basename(req.params.filename);
    if (!filename.endsWith('.pptx')) {
      return res.status(400).json({ error: 'Invalid file type' });
    }
    const filePath = path.join(process.cwd(), "uploads", "ppt-exports", filename);
    res.download(filePath, filename, (err) => {
      if (err) res.status(404).json({ error: 'File not found' });
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}

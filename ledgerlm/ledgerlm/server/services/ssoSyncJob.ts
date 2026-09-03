/**
 * SSO Group Membership Sync Job
 *
 * Runs every 15 minutes. For every domain with SSO group mappings configured:
 *   1. Loads all active domain users
 *   2. Calls Microsoft Graph API (one call per user, all group IDs at once)
 *   3. If a user is no longer in any configured group → deactivates the account + invalidates their session
 *   4. If a user's role changed (promotion or demotion) → updates the role immediately
 *
 * New users added to AD groups are NOT pre-provisioned — they are created on first login.
 */

import cron from 'node-cron';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { domains, domainUsers, users } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { resolveGroupRole, hasSsoGroupMappings } from './ssoService';
import { writeAuditLog } from './auditLogger';

let isRunning = false;

/**
 * Invalidates all active sessions for a given users.id value.
 * Sessions are stored in the "session" table by connect-pg-simple.
 * The sess JSONB column contains { userId: "..." }.
 */
async function invalidateUserSessions(userId: string): Promise<void> {
  try {
    await db.execute(
      sql`DELETE FROM "session" WHERE (sess::jsonb)->>'userId' = ${userId}`
    );
    console.log(`[SSO Sync] Invalidated sessions for userId=${userId}`);
  } catch (err: any) {
    console.error(`[SSO Sync] Failed to invalidate sessions for userId=${userId}:`, err.message);
  }
}

/**
 * Looks up the main users.id for a domain user email (username = email for SSO users).
 */
async function getUserIdByEmail(email: string): Promise<string | null> {
  try {
    const result = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, email))
      .limit(1);
    return result[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Core sync logic — runs for all SSO domains with group mappings.
 */
async function runSsoSync(): Promise<void> {
  if (isRunning) {
    console.log('[SSO Sync] Skipping — previous run still in progress');
    return;
  }

  isRunning = true;
  const startedAt = Date.now();
  console.log('[SSO Sync] Starting group membership sync...');

  try {
    // Load all SSO domains that have group mappings configured
    const allDomains = await db
      .select()
      .from(domains)
      .where(eq(domains.authMethod, 'microsoft_sso'));

    const ssoDomains = allDomains.filter((d) => hasSsoGroupMappings(d as any));

    if (ssoDomains.length === 0) {
      console.log('[SSO Sync] No SSO domains with group mappings — nothing to sync');
      return;
    }

    console.log(`[SSO Sync] Checking ${ssoDomains.length} SSO domain(s)...`);

    let totalChecked = 0;
    let totalDeactivated = 0;
    let totalRoleUpdated = 0;

    for (const domain of ssoDomains) {
      try {
        // Load all active users for this domain
        const activeUsers = await db
          .select()
          .from(domainUsers)
          .where(
            and(
              eq(domainUsers.domainId, domain.id),
              eq(domainUsers.status, 'active'),
            ),
          );

        if (activeUsers.length === 0) continue;

        console.log(`[SSO Sync] Domain ${domain.name}: checking ${activeUsers.length} active user(s)...`);

        for (const du of activeUsers) {
          totalChecked++;
          try {
            const resolvedRole = await resolveGroupRole(domain as any, du.email);

            if (resolvedRole === null) {
              // User is no longer in any configured group — deactivate
              await db
                .update(domainUsers)
                .set({ status: 'inactive' })
                .where(eq(domainUsers.id, du.id));

              // Invalidate their active session
              const userId = await getUserIdByEmail(du.email);
              if (userId) {
                await invalidateUserSessions(userId);
              }

              // Audit: user deactivated by sync job
              writeAuditLog({
                action: 'SSO_USER_DEACTIVATED',
                resource: domain.name,
                status: 'success',
                details: { email: du.email, domain: domain.name, role: du.role, triggeredBy: 'background_sync' },
              });

              totalDeactivated++;
              console.log(`[SSO Sync] Deactivated ${du.email} (domain: ${domain.name}) — no longer in any group`);
            } else if (resolvedRole !== du.role) {
              // Role changed — sync it
              await db
                .update(domainUsers)
                .set({ role: resolvedRole })
                .where(eq(domainUsers.id, du.id));

              // Audit: role updated by sync job
              writeAuditLog({
                action: 'SSO_ROLE_UPDATED',
                resource: domain.name,
                status: 'success',
                details: { email: du.email, domain: domain.name, oldRole: du.role, newRole: resolvedRole, triggeredBy: 'background_sync' },
              });

              totalRoleUpdated++;
              console.log(`[SSO Sync] Updated role for ${du.email} (domain: ${domain.name}): ${du.role} → ${resolvedRole}`);
            }
          } catch (userErr: any) {
            console.error(`[SSO Sync] Error checking ${du.email} in domain ${domain.name}:`, userErr.message);
          }
        }
      } catch (domainErr: any) {
        console.error(`[SSO Sync] Error processing domain ${domain.name}:`, domainErr.message);
      }
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `[SSO Sync] Completed in ${elapsed}s — checked: ${totalChecked}, deactivated: ${totalDeactivated}, role-updated: ${totalRoleUpdated}`,
    );
  } catch (err: any) {
    console.error('[SSO Sync] Unexpected error during sync:', err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the background SSO sync cron job (every 15 minutes).
 * Safe to call multiple times — only one job is ever registered.
 */
let cronJob: ReturnType<typeof cron.schedule> | null = null;

export function startSsoSyncJob(): void {
  if (cronJob) {
    console.log('[SSO Sync] Job already running');
    return;
  }

  // Run immediately on startup (after a short delay to let DB settle)
  setTimeout(() => {
    runSsoSync().catch((e) => console.error('[SSO Sync] Startup run failed:', e.message));
  }, 30_000); // 30 second delay on startup

  // Then every 15 minutes
  cronJob = cron.schedule('*/15 * * * *', () => {
    runSsoSync().catch((e) => console.error('[SSO Sync] Scheduled run failed:', e.message));
  });

  console.log('✅ SSO group membership sync job started (every 15 minutes)');
}

export function stopSsoSyncJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[SSO Sync] Job stopped');
  }
}

// Export for testing / manual trigger
export { runSsoSync };

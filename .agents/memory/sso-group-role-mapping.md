---
name: SSO Group-to-Role Mapping
description: Design decisions and implementation details for Azure AD SSO group-to-role mapping (Bosch). N groups → any role per domain.
---

## What was built
Flexible N-group → role mapping for Azure AD SSO, replacing the single ssoGroupId + ssoDefaultRole approach.

## Data model
- New JSONB column `sso_group_mappings` on domains table: `[{ groupId: string, role: string }, ...]`
- New `status` column on domain_users: `'active' | 'inactive'` (default 'active')
- Old `ssoGroupId` + `ssoDefaultRole` kept for backward compat — used as fallback when ssoGroupMappings is null/empty

## Key files
- `server/services/ssoService.ts` — `resolveGroupRole()`, `hasSsoGroupMappings()`, `getSsoGroupMappings()`
- `server/services/ssoSyncJob.ts` — background sync job (every 15 min), deactivates users no longer in any group
- `server/migrations/add-sso-group-mappings.ts` — DB migration for new columns
- `client/src/pages/SuperAdmin.tsx` — dynamic add/remove group mapping table UI

## Login logic (routes.ts SSO callback)
1. `hasSsoGroupMappings(domain)` → if true, call `resolveGroupRole(domain, email)` (single Graph API call for ALL group IDs)
2. No role → deny with `not_in_group`
3. Role found → auto-provision new users OR sync role on returning users (AD is source of truth)
4. `domainUser.status === 'inactive'` → deny with `account_inactive`

## Background sync (every 15 min)
- Checks all active SSO domain users via Graph API
- If no group match → sets status='inactive', invalidates session via `DELETE FROM "session" WHERE (sess::jsonb)->>'userId' = $userId`
- If role changed → updates immediately

## Role priority
Admin beats standard if a user is in multiple groups. ROLE_PRIORITY map in ssoService.ts — add new roles there if LedgerLM adds them.

## Bosch group IDs (do NOT store here — use env secrets or DB)
- Confirmed: admin group, standard user group, same tenant ID across all envs

**Why JSONB over separate table:** Typically 2–5 groups per domain, no cross-domain querying, simpler migration (one nullable column).

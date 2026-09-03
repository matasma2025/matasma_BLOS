import {
  ConfidentialClientApplication,
  Configuration,
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
} from '@azure/msal-node';
import { decryptValue } from '../utils/encryption';
import type { Domain } from '@shared/schema';

const SCOPES = ['openid', 'profile', 'email'];
const GRAPH_SCOPES = ['https://graph.microsoft.com/.default'];

// Shape of each entry in ssoGroupMappings JSONB column
export interface SsoGroupMapping {
  groupId: string;
  role: string; // 'admin' | 'standard' | any future role
}

// Role priority for conflict resolution — higher number wins
const ROLE_PRIORITY: Record<string, number> = {
  admin: 10,
  standard: 1,
};

function getMsalClient(domain: Domain): ConfidentialClientApplication {
  const secret = domain.ssoClientSecret ? decryptValue(domain.ssoClientSecret) : '';
  const config: Configuration = {
    auth: {
      clientId: domain.ssoClientId || '',
      authority: `https://login.microsoftonline.com/${domain.ssoTenantId}`,
      clientSecret: secret,
    },
  };
  return new ConfidentialClientApplication(config);
}

export function buildRedirectUri(req: { protocol: string; headers: Record<string, any>; get: (h: string) => string | undefined }): string {
  // If APP_URL is explicitly set (production/Azure), always use it — most reliable
  if (process.env.APP_URL) {
    return `${process.env.APP_URL.replace(/\/$/, '')}/api/auth/sso/microsoft/callback`;
  }
  const proto = ((req.headers['x-forwarded-proto'] as string) || req.protocol).split(',')[0].trim();
  const host = ((req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:5000').split(',')[0].trim();
  return `${proto}://${host}/api/auth/sso/microsoft/callback`;
}

export async function generateAuthUrl(domain: Domain, state: string, redirectUri: string): Promise<string> {
  const msalClient = getMsalClient(domain);
  const request: AuthorizationUrlRequest = {
    scopes: SCOPES,
    redirectUri,
    state,
    prompt: 'select_account',
  };
  return await msalClient.getAuthCodeUrl(request);
}

export async function exchangeCodeForUser(
  domain: Domain,
  code: string,
  redirectUri: string,
): Promise<{ email: string; displayName: string }> {
  const msalClient = getMsalClient(domain);
  const request: AuthorizationCodeRequest = {
    scopes: SCOPES,
    redirectUri,
    code,
  };
  const response = await msalClient.acquireTokenByCode(request);
  const claims = response.idTokenClaims as Record<string, any>;
  const email = (claims?.preferred_username || claims?.email || claims?.upn || '').toLowerCase();
  const displayName = claims?.name || email.split('@')[0];
  if (!email) throw new Error('No email returned from Microsoft token');
  return { email, displayName };
}

export function validateEmailDomain(email: string, domainName: string): boolean {
  const e = email.toLowerCase();
  const d = domainName.toLowerCase();
  // Accept exact match (@bosch.com) or subdomain match (@in.bosch.com for domain bosch.com)
  return e.endsWith(`@${d}`) || e.endsWith(`.${d}`);
}

/**
 * Returns the parsed ssoGroupMappings array from a domain, handling both
 * the new JSONB array format and the legacy single-group fields.
 */
export function getSsoGroupMappings(domain: Domain): SsoGroupMapping[] {
  // New format: explicit JSONB array
  if (domain.ssoGroupMappings && Array.isArray(domain.ssoGroupMappings)) {
    return (domain.ssoGroupMappings as SsoGroupMapping[]).filter(
      (m) => m && typeof m.groupId === 'string' && m.groupId.trim() && typeof m.role === 'string',
    );
  }
  // Legacy format: single ssoGroupId + ssoDefaultRole
  if (domain.ssoGroupId) {
    return [{ groupId: domain.ssoGroupId, role: domain.ssoDefaultRole || 'standard' }];
  }
  return [];
}

/**
 * Returns true if this domain has any SSO group mappings configured.
 * False means invite-only access (no group restriction).
 */
export function hasSsoGroupMappings(domain: Domain): boolean {
  return getSsoGroupMappings(domain).length > 0;
}

/**
 * Calls Microsoft Graph API checkMemberObjects for a user against a list of group IDs.
 * Returns the subset of group IDs the user is actually a member of.
 */
async function checkMemberObjects(domain: Domain, email: string, groupIds: string[]): Promise<string[]> {
  if (groupIds.length === 0) return [];

  try {
    const msalClient = getMsalClient(domain);
    const tokenResponse = await msalClient.acquireTokenByClientCredential({
      scopes: GRAPH_SCOPES,
    });

    if (!tokenResponse?.accessToken) {
      console.error('[SSO Group Check] Failed to acquire Graph API token');
      return [];
    }

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/checkMemberObjects`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: groupIds }),
      },
    );

    if (!graphResponse.ok) {
      const errText = await graphResponse.text();
      console.error(`[SSO Group Check] Graph API error ${graphResponse.status}: ${errText}`);
      return [];
    }

    const data = await graphResponse.json() as { value: string[] };
    return Array.isArray(data.value) ? data.value : [];
  } catch (error: any) {
    console.error('[SSO Group Check] Error calling checkMemberObjects:', error.message);
    return [];
  }
}

/**
 * Resolves the role a user should have based on Azure AD group membership.
 *
 * Uses a single Graph API call for ALL configured group IDs, then finds the
 * highest-priority role among matched groups (admin beats standard).
 *
 * Returns:
 *   - A role string ('admin' | 'standard' | ...) if the user is in at least one group
 *   - null if the user is NOT in any configured group (= deny access)
 *
 * Only call this when hasSsoGroupMappings(domain) is true.
 */
export async function resolveGroupRole(domain: Domain, email: string): Promise<string | null> {
  const mappings = getSsoGroupMappings(domain);
  if (mappings.length === 0) return null;

  const allGroupIds = mappings.map((m) => m.groupId);
  const matchedIds = await checkMemberObjects(domain, email, allGroupIds);

  if (matchedIds.length === 0) {
    console.log(`[SSO Group Check] ${email}: not a member of any configured group`);
    return null;
  }

  // Find the highest-priority role among matched groups
  const matchedMappings = mappings.filter((m) => matchedIds.includes(m.groupId));
  matchedMappings.sort((a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0));

  const resolvedRole = matchedMappings[0].role;
  console.log(`[SSO Group Check] ${email}: resolved role=${resolvedRole} (matched groups: ${matchedMappings.map(m => m.groupId).join(', ')})`);
  return resolvedRole;
}

/**
 * @deprecated Use resolveGroupRole() and hasSsoGroupMappings() instead.
 * Kept for backward compatibility with any direct callers.
 */
export async function checkGroupMembership(domain: Domain, email: string): Promise<boolean> {
  if (!hasSsoGroupMappings(domain)) return true;
  const role = await resolveGroupRole(domain, email);
  return role !== null;
}

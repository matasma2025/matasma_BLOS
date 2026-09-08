---
name: Privileged step-up assurance
description: Security policy for separating ordinary login from authorization of sensitive administrator mutations.
---

Ordinary login assurance must not automatically authorize sensitive administrator mutations. Require a fresh, short-lived, session-bound challenge and current active administrator membership.

**Why:** A copied complete session otherwise inherits the administrator's mutation authority. Membership changes must also persistently revoke older sessions so an in-flight session save cannot restore access.

**How to apply:** Keep read-only and standard-user flows usable, but protect role, tenant, SSO, secret-bearing, and destructive admin changes. Resolve authorization from current server-side membership, never client identity or stale role claims.
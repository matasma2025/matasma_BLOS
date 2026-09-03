---
name: Bosch production schema safety
description: Safe database-change policy for the existing Bosch Azure PostgreSQL deployment.
---

Use guarded, idempotent, additive schema reconciliation for Bosch production database changes. Do not use unrestricted Drizzle reconciliation or mutate schema destructively during application startup.

**Why:** The Bosch Azure PostgreSQL database contains existing production data and schema history that may differ from the complete Drizzle schema. Unrestricted reconciliation can propose unrelated destructive changes, while guarded reconciliation can preserve legacy objects and reject incompatible changes before applying anything.

**How to apply:** Run the controlled schema check first, then the additive push. Create missing tables, compatible columns, constraints, and indexes under a migration lock; preserve undeclared objects. Use a reviewed migration for renames, drops, type changes, or populated-table changes that cannot be proven safe.
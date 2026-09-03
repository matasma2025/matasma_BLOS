---
name: Bosch production schema safety
description: Safe database-change policy for the existing Bosch Azure PostgreSQL deployment.
---

Use narrow, idempotent, additive startup migrations for Bosch production database changes. Do not use full schema reconciliation as the default deployment path.

**Why:** The Bosch Azure PostgreSQL database contains existing production data and schema history that may differ from the complete Drizzle schema. A full schema push could propose unrelated destructive changes, while a targeted migration can create only the required table, column, constraint, or index.

**How to apply:** Prefer `CREATE TABLE IF NOT EXISTS`, conditional `ALTER TABLE ... ADD`, and `CREATE INDEX IF NOT EXISTS`. Never include table/column drops or data replacement unless the user explicitly reviews and approves them after a backup.
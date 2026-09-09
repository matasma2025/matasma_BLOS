---
name: Neon migration statements
description: Constraint for startup migrations executed through the Neon/Drizzle prepared-statement driver.
---

Execute each DDL or DML command in its own database call; do not place multiple
semicolon-separated commands in one prepared `db.execute`.

**Why:** The Neon HTTP prepared-statement driver rejects multi-command SQL with
`cannot insert multiple commands into a prepared statement`, preventing startup.

**How to apply:** For additive startup migrations, issue sequential calls for
each table, index, alteration, or cleanup statement, then restart once and
confirm the service reaches its listening state.
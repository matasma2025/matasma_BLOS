# LedgerLM — Data Governance Guide
### Audit Log · Backup & Recovery · Data Retention

**Prepared for:** Bosch Global Software Technologies (BGSW) UAT  
**Audience:** IT Administrators, Security Officers, Compliance Teams  
**Last updated:** July 2026

---

## Overview

LedgerLM provides three complementary data governance features, all managed from the **Super Admin** panel. Together they answer three questions that every enterprise deployment must address:

| Question | Feature |
|---|---|
| *Who did what, and when?* | **Audit Log** |
| *Can we recover if something goes wrong?* | **Backup & Recovery** |
| *How long do we keep data before deleting it?* | **Data Retention** |

These three features are **independent but connected** — for example, every deletion triggered by a retention policy is recorded in the Audit Log, and every backup attempt is logged in both the Backup File History and the Scheduler Run Log.

---

## 1. Audit Log

### What it is
A tamper-evident, chronological record of every significant event that happens inside LedgerLM. Every row is written automatically by the system — administrators cannot edit or delete individual entries.

### What gets logged
| Event Type | Example |
|---|---|
| **Login** | `customer.admin@bosch.com` signed in at 09:14:22 on 22 Jul 2026 |
| **OTP used** | One-time password verified for `analyst1@bosch.com` |
| **SSO authentication** | Microsoft Entra ID sign-in for `john.doe@bosch.com` |
| **File upload** | `BGSW_Q2_2026_Actuals.xlsx` uploaded to cube *Testing KPI* by `admin@bosch.com` |
| **File deletion** | `old_budget_FY24.csv` deleted by `admin@bosch.com` |
| **Backup triggered** | Full database backup started by `customer@ledgerlm.ai` (manual) |
| **Backup completed** | Backup `ledgerlm-backup-2026-07-22T02-00-01.sql` (184 MB) uploaded to Azure Blob |
| **Retention purge** | 1,240 rows deleted from `messages` table (older than 90 days) by scheduler |
| **Settings changed** | Scheduler run time changed from 02:00 UTC to 03:00 UTC |

### Example — what an audit log entry looks like

```
Timestamp:    22 Jul 2026, 09:14:22
Action:       LOGIN
Status:       success
User:         john.doe@bosch.com
IP Address:   10.20.30.45
Details:      Authenticated via Microsoft Entra SSO
              Domain: bosch.com
              Session ID: sess_a3f9b2c1
```

```
Timestamp:    22 Jul 2026, 02:01:34
Action:       RETENTION_PURGE
Status:       success
User:         scheduler (automated)
Details:      Table: messages
              Retain period: 90 days
              Rows deleted: 3,847
              Cutoff date: 23 Apr 2026
```

### Why Bosch needs this
- **GDPR / data access compliance** — demonstrates who accessed which data and when
- **Security incident response** — if an account is compromised, you can trace every action it took
- **Internal audit trails** — evidence for SOC 2, ISO 27001, or Bosch internal security reviews
- **Change accountability** — proves that data changes were authorised

### How to use it
1. Go to **Super Admin → Audit Log**
2. Filter by date range, event type, or user
3. Click **Export CSV** to download for offline analysis or compliance reporting

### Retention of audit logs themselves
By default, audit log entries are retained for **730 days (2 years)**. This is configurable in the Retention tab. Bosch's compliance team should confirm the required retention period under applicable regulations before changing this value.

---

## 2. Backup & Recovery

### What it is
An automated and on-demand database backup system. It creates a complete SQL dump (`pg_dump`) of the entire LedgerLM PostgreSQL database and optionally uploads it to **Azure Blob Storage** for durable off-site storage.

### What gets backed up
Everything in the database — all tables, all data:

| What | Includes |
|---|---|
| **User accounts & sessions** | All registered users, domain configurations |
| **Financial data** | All uploaded cube data (actuals, budgets, forecasts) |
| **Chat history** | All analysis conversations and AI responses |
| **Document library** | Metadata for all uploaded enterprise documents |
| **Configuration** | Domain settings, retention policies, scheduler settings |
| **Audit logs** | The audit log table itself is backed up |

> **Note:** The backup is a full SQL dump — it can be used to completely restore the LedgerLM database to any backed-up state.

### Two ways a backup runs

#### A. Automated — Nightly Scheduler
Runs automatically every day at the configured UTC time (default: **02:00 UTC**).  
No human action required. Each run is recorded in the Scheduler Run Log.

#### B. Manual — Take Backup Now
Any Super Admin can trigger an immediate backup at any time from **Super Admin → Backup & Recovery → Take Backup Now**.  
Useful before a major data import, a software update, or any high-risk operation.

### Example — backup lifecycle

```
Step 1:  Scheduler fires at 02:00 UTC
Step 2:  pg_dump runs — reads entire PostgreSQL database
Step 3:  SQL dump file created: ledgerlm-backup-2026-07-22T02-00-01.sql (184 MB)
Step 4:  File uploaded to Azure Blob Storage
         Container: ledgerlm-backups
         URL: https://boschstorage.blob.core.windows.net/ledgerlm-backups/ledgerlm-backup-2026-07-22T02-00-01.sql
Step 5:  Backup File History updated:
         ✅ Success | 184.3 MB | Azure Blob | 22 Jul 2026 02:01:34
Step 6:  Audit log entry written: BACKUP_TRIGGERED — success
```

### What the Scheduler Run Log shows

| Column | Meaning |
|---|---|
| **Started** | When the job began |
| **Job** | `Backup` (blue) or `Retention` (orange) |
| **Triggered By** | `scheduler` for automatic runs; email address for manual |
| **Status** | 🔵 Running · ✅ Success · ❌ Failed |
| **Duration** | How long the job took (e.g. `4.2s`) |
| **Details** | File size, whether it uploaded to Azure; or the error message if failed |

### Azure Blob Storage configuration
Configure the connection string once under **Backup & Recovery → Azure Blob Storage**:

```
Connection string format:
DefaultEndpointsProtocol=https;AccountName=boschledgerlm;AccountKey=<key>;EndpointSuffix=core.windows.net

Container: ledgerlm-backups  (created automatically if it does not exist)
```

Use the **Test Connection** button to verify write access before saving.

### Azure-side lifecycle policy (recommended for Bosch)
Set a lifecycle management rule in Azure Portal on the `ledgerlm-backups` container to automatically delete blobs older than your required retention period (e.g. 90 days). This prevents unbounded storage growth.

```
Azure Portal → Storage Account → Data management → Lifecycle management
Rule: Delete blobs older than 90 days in container ledgerlm-backups
```

### Recovery procedure
If a database restore is needed, retrieve the `.sql` file from Azure Blob and run:

```bash
psql "$DATABASE_URL" < ledgerlm-backup-2026-07-22T02-00-01.sql
```

This restores the entire database to its state at the time of that backup.

---

## 3. Data Retention

### What it is
An automated cleanup engine that permanently deletes records older than a configured number of days from specific database tables. It runs nightly alongside the backup job and enforces data minimisation — a key GDPR and data privacy principle.

### Which tables are covered

| Data Type | DB Table | Default Retain Period | What it holds |
|---|---|---|---|
| **Audit Logs** | `audit_logs` | 730 days | Security and activity events |
| **Backup Records Log** | `backup_logs` | 365 days | Backup history entries |
| **Chat Messages** | `messages` | 90 days | AI chat conversations |
| **OTP Codes** | `otp_codes` | 7 days | One-time login passwords |
| **Document Chunks** | `enterprise_document_chunks` | Configurable | Parsed document text |
| **Document Embeddings** | `enterprise_document_embeddings` | Configurable | AI vector embeddings |

> ⚠️ **Retention is permanent.** Deleted records cannot be recovered unless a backup exists from before the deletion. Always ensure backups are working before enabling retention policies.

### Example — what retention actually does

**Scenario:** Chat Messages policy is enabled with a 90-day retain period.

```
Today's date:         22 Jul 2026
Cutoff date:          23 Apr 2026  (90 days ago)

Retention engine runs at 02:00 UTC:
  DELETE FROM messages WHERE created_at < '2026-04-23'

Result:
  3,847 rows deleted
  Audit log entry written:
    Action:  RETENTION_PURGE
    Table:   messages
    Rows:    3,847
    Cutoff:  23 Apr 2026

Next night: only messages older than 90 days from that night are deleted.
```

**Scenario:** OTP Codes policy is enabled with a 7-day retain period.

```
Purpose: OTP codes are single-use login tokens. Keeping them longer than 7 days
         serves no purpose and represents unnecessary personal data retention.

Every night: DELETE FROM otp_codes WHERE created_at < NOW() - 7 days
Result: expired tokens purged, reducing stored personal data.
```

### How to configure

1. Go to **Super Admin → Retention**
2. Each row has:
   - **Retain Period** — click the days value to edit it inline
   - **Enabled toggle** — flip to Active to enable automatic nightly purging
   - **Last Run / Last Deleted** — shows when it last ran and how many rows were removed
3. Click **Run Now** to trigger an immediate run of all active policies (without waiting for the nightly schedule)

### Recommended settings for Bosch GDPR compliance

| Data Type | Recommended Period | Rationale |
|---|---|---|
| Audit Logs | **730 days** (2 years) | Standard compliance retention; confirm with Bosch legal |
| Backup Records Log | **365 days** (1 year) | Operational reference |
| Chat Messages | **90 days** | Minimise personal data in conversation history |
| OTP Codes | **7 days** | Expired tokens have no value; minimise personal data |
| Document Chunks/Embeddings | **Match document lifecycle** | Delete when the source document is removed |

> These are starting recommendations. Bosch's Data Protection Officer (DPO) should confirm the appropriate retention periods under applicable German and EU regulations.

---

## How the Three Features Work Together

```
Every night at 02:00 UTC
         │
         ├──► BACKUP runs first
         │      pg_dump → SQL file → Azure Blob Storage
         │      ↓
         │      Writes to: backup_logs table
         │      Writes to: audit_logs table (BACKUP_TRIGGERED)
         │      Writes to: scheduler_logs (duration, size, status)
         │
         └──► RETENTION ENGINE runs
                For each enabled policy:
                  DELETE rows older than N days
                ↓
                Writes to: retention_policies (last_run, last_deleted)
                Writes to: audit_logs (RETENTION_PURGE, rows deleted per table)
                Writes to: scheduler_logs (total rows deleted, policies run)

AUDIT LOG captures everything above automatically.
You can review all of it under Super Admin → Audit Log.
```

### Key point for Bosch
The **order matters**: backup runs first, then retention. This means the nightly backup always captures a snapshot of data *before* that night's retention purge deletes anything. You always have a recovery point that includes the data that was just cleaned up.

---

## Summary for Bosch IT / Security Team

| Feature | Where to find it | Who manages it | Runs automatically? |
|---|---|---|---|
| Audit Log | Super Admin → Audit Log | Read-only for admins; written by system | Yes — every event |
| Backup | Super Admin → Backup & Recovery | Configure Azure Blob once; then automatic | Yes — nightly at configured UTC time |
| Retention | Super Admin → Retention | Enable policies and set periods | Yes — nightly after backup |

### Pre-deployment checklist for Bosch Azure environment

- [ ] Azure Storage Account created with container `ledgerlm-backups`
- [ ] Azure Blob connection string entered in Super Admin → Backup & Recovery
- [ ] Test Connection verified ✅
- [ ] Nightly backup time set (default 02:00 UTC = 07:30 IST)
- [ ] Retention periods reviewed and approved by Bosch DPO
- [ ] OTP Codes retention enabled (7 days) — no need to keep expired tokens
- [ ] Chat Messages retention period confirmed with users (default 90 days)
- [ ] Audit Log retention period confirmed with compliance team (default 730 days)
- [ ] First manual backup taken and verified in Backup File History
- [ ] Azure Blob lifecycle rule set to auto-delete blobs older than agreed period

---

*This document is part of the LedgerLM deployment and operations guide for BGSW. For technical questions contact the LedgerLM implementation team.*

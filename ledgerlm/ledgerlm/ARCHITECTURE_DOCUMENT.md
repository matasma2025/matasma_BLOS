# LedgerLM — System Architecture Document

**Document Version:** 1.0  
**Date:** June 2026  
**Classification:** Internal / Bosch CS Review  
**Prepared for:** Bosch Cyber Security Team (MS/ECL51)  
**Application:** LedgerLM — AI-Powered Financial Intelligence Platform  

---

## 1. Application Overview

LedgerLM is a multi-tenant, AI-powered enterprise financial intelligence platform designed for ledger management, KPI analysis, and natural language querying of financial data. It is deployed as a containerised application on Azure App Service for Containers.

**Tenants:**
- `in.bosch.com` — Bosch BGSW/BDO-IT
- `nemko.com` — Nemko
- `ledgerlm.ai` — Platform Super Admin

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USERS (Browser)                                     │
│              Bosch Employees @ in.bosch.com                                 │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ HTTPS (TLS 1.2+)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              AZURE APP SERVICE FOR CONTAINERS (Linux)                       │
│                        P2v3 — 4 vCores, 16 GB RAM                          │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    DOCKER CONTAINER (Port 80)                       │   │
│   │                                                                     │   │
│   │   ┌──────────────────────┐    ┌───────────────────────────────┐    │   │
│   │   │   NGINX (Reverse     │    │    SUPERVISOR (Process Mgr)   │    │   │
│   │   │   Proxy / Port 80)   │    │    Manages Node.js + Python   │    │   │
│   │   └──────────┬───────────┘    └───────────────────────────────┘    │   │
│   │              │                                                      │   │
│   │    ┌─────────┴──────────────────────────────┐                      │   │
│   │    │                                        │                      │   │
│   │    ▼                                        ▼                      │   │
│   │  ┌─────────────────────────┐   ┌────────────────────────────────┐  │   │
│   │  │  NODE.JS / EXPRESS      │   │  PYTHON / FASTAPI              │  │   │
│   │  │  (Port 5000)            │   │  (Port 8000)                   │  │   │
│   │  │                         │   │                                │  │   │
│   │  │  • React Frontend (SPA) │   │  • Document Processing (RAG)  │  │   │
│   │  │  • REST API             │   │  • Semantic SQL Engine         │  │   │
│   │  │  • Authentication       │   │  • Vector Embeddings           │  │   │
│   │  │  • Session Management   │   │  • KPI Calculation Builders   │  │   │
│   │  │  • Multi-tenant Logic   │   │  • NL → SQL Translation       │  │   │
│   │  │  • Drizzle ORM          │   │  • psycopg2 DB driver         │  │   │
│   │  └────────────┬────────────┘   └──────────────┬─────────────────┘  │   │
│   │               │                               │                    │   │
│   └───────────────┼───────────────────────────────┼────────────────────┘   │
└───────────────────┼───────────────────────────────┼────────────────────────┘
                    │                               │
        ┌───────────┼───────────────────────────────┼──────────────┐
        │           │       AZURE SERVICES           │              │
        │           ▼                               ▼              │
        │  ┌──────────────────┐        ┌───────────────────────┐   │
        │  │ AZURE POSTGRESQL │        │ AZURE OPENAI SERVICE  │   │
        │  │ FLEXIBLE SERVER  │        │                       │   │
        │  │                  │        │ Model: GPT-5.2        │   │
        │  │ • pgvector ext.  │        │ Endpoint:             │   │
        │  │ • SSL enforced   │        │ ledgerlm-openai       │   │
        │  │ • All app data   │        │ .openai.azure.com     │   │
        │  │ • Vector data    │        │                       │   │
        │  │ • Session store  │        │ Used for:             │   │
        │  └──────────────────┘        │ • Chat responses      │   │
        │                              │ • Query interpretation│   │
        │  ┌──────────────────┐        │ • Document analysis   │   │
        │  │ AZURE KEY VAULT  │        └───────────────────────┘   │
        │  │                  │                                     │
        │  │ All secrets:     │        ┌───────────────────────┐   │
        │  │ • DB credentials │        │ AZURE BLOB STORAGE    │   │
        │  │ • API keys       │        │                       │   │
        │  │ • Session secret │        │ • Excel data files    │   │
        │  │ • SMTP creds     │        │ • Ingested documents  │   │
        │  │ Injected as env  │        │ • Auto-sync pipeline  │   │
        │  │ vars by App Svc  │        └───────────────────────┘   │
        │  └──────────────────┘                                     │
        │                                                           │
        │  ┌──────────────────┐        ┌───────────────────────┐   │
        │  │ AZURE AD /       │        │ ANAPLAN               │   │
        │  │ ENTRA ID         │        │ (External SaaS)       │   │
        │  │                  │        │                       │   │
        │  │ • SSO / OIDC     │        │ • Financial planning  │   │
        │  │ • Group-based    │        │ • Data export API     │   │
        │  │   role mapping   │        │ • Scheduled sync      │   │
        │  └──────────────────┘        └───────────────────────┘   │
        └───────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │  AZURE CONTAINER     │
                    │  REGISTRY (ACR)      │
                    │                      │
                    │  Docker image store  │
                    │  App Service pulls   │
                    │  image from here     │
                    └──────────────────────┘

                    ┌──────────────────────┐
                    │  SMTP EMAIL SERVICE  │
                    │  (GoDaddy / Port 465)│
                    │                      │
                    │  OTP delivery        │
                    │  User invitations    │
                    └──────────────────────┘
```

---

## 3. Component Description

### 3.1 Frontend — React + Vite (SPA)
- Single-page application built with React 18 + Vite
- Served by the Express server (SSR mode in development, static in production)
- Communicates with backend via REST API over HTTPS
- No sensitive data stored in browser (session-based auth, no localStorage tokens)

### 3.2 Backend — Node.js / Express (Port 5000)
- TypeScript, Node.js 20, Express framework
- Handles all REST API routes, authentication, session management
- Implements multi-tenant isolation (all queries scoped to `domain_id`)
- Communicates with Python backend via HTTP (localhost only, internal to container)
- Drizzle ORM for type-safe database access

### 3.3 AI Processing — Python / FastAPI (Port 8000)
- Python 3.11, FastAPI, Uvicorn
- Handles document ingestion, RAG (Retrieval-Augmented Generation), and Semantic SQL
- Generates vector embeddings using Azure OpenAI text-embedding-3-large (3072 dimensions)
- 33 hardcoded SQL builders for deterministic KPI metric calculation (no LLM for known metrics)
- Natural language → SQL translation for unknown queries via Azure OpenAI

### 3.4 Database — Azure PostgreSQL Flexible Server
- PostgreSQL 15 with `pgvector` extension (mandatory for vector/AI search)
- Stores: application data, user sessions, document chunks, vector embeddings, financial cube data
- SSL enforced for all connections
- Automated backups enabled (Azure built-in)
- Tables: 25+ tables across multi-tenant schema

### 3.5 Azure OpenAI Service
- Model: GPT-5.2 (deployment: `gpt-5.2`)
- Endpoint: `https://ledgerlm-openai.openai.azure.com`
- Used for: chat response generation, natural language query interpretation, document analysis
- API key stored in Azure Key Vault

### 3.6 Azure Blob Storage
- Stores raw Excel/CSV data files uploaded by enterprise connectors
- Automated ingestion pipeline: Blob → parse → `cube_fact_data` table
- Tracks processed files in `azure_blob_file_registry` table to prevent re-ingestion

### 3.7 Azure Key Vault
- Stores all application secrets (DB credentials, API keys, session secret, SMTP password)
- Injected into App Service as environment variables via Key Vault References
- No secrets stored in Docker image or source code

### 3.8 Azure Container Registry (ACR)
- Stores the LedgerLM Docker image
- App Service pulls image from ACR on each deployment
- Image scanning should be enabled for vulnerability detection

### 3.9 Azure AD / Entra ID
- OIDC-based SSO for enterprise users
- Group-based role mapping (configured per tenant in Admin UI)
- Tenant ID configured per domain

### 3.10 Anaplan Integration
- External SaaS platform for financial planning data
- Scheduled data export via Anaplan REST API
- Credentials stored encrypted in database / Key Vault

---

## 4. Data Flow — User Query (AI Financial Question)

```
User types question in chat
        │
        ▼
[1] Express API — authenticates session, identifies tenant (in.bosch.com)
        │
        ▼
[2] Python FastAPI — parses natural language intent
    ├── Detects metric keyword (e.g. "revenue") → FAST PATH (no LLM)
    └── Unknown query → Azure OpenAI for intent parsing
        │
        ▼
[3] Semantic SQL Engine — builds parameterized SQL
    └── Executes against cube_fact_data (scoped to cube_id + domain)
        │
        ▼
[4] Azure OpenAI GPT-5.2 — formats data rows into natural language answer
        │
        ▼
[5] Streamed response back to browser over HTTPS/SSE
```

---

## 5. Data Flow — Document Ingestion

```
Azure Blob Storage (Excel file uploaded)
        │
        ▼
[1] Scheduler detects new blob via registry table
        │
        ▼
[2] Python backend: parse Excel → extract rows (78 columns)
        │
        ▼
[3] Generate vector embeddings via Azure OpenAI text-embedding-3-large
        │
        ▼
[4] Store chunks + embeddings in PostgreSQL (pgvector)
        │
        ▼
[5] Store structured rows in cube_fact_data table
        │
        ▼
Available for AI queries
```

---

## 6. Authentication Flow

```
User enters email address
        │
        ▼
System checks email domain → maps to tenant (in.bosch.com → Bosch)
        │
        ├── If SSO configured → Redirect to Azure AD / Entra ID (OIDC)
        │
        └── If OTP configured → Send 6-digit OTP via SMTP email
                    │
                    ▼
            User enters OTP
                    │
                    ▼
            OTP verified (bcrypt hash comparison)
                    │
                    ▼
            Server-side session created (PostgreSQL session store)
            Cookie: httpOnly, sameSite=Strict, Secure (HTTPS only)
            Session TTL: 8 hours
```

---

## 7. Network Architecture (Azure)

```
Internet
    │
    │ HTTPS (TLS 1.2+)
    ▼
Azure App Service (Public endpoint OR custom domain)
    │
    │ Internal (localhost / container network only)
    ├──► Node.js :5000
    └──► Python  :8000
                │
                │ Private Endpoint / VNet (Bosch IT to configure)
                ├──► Azure PostgreSQL Flexible Server
                ├──► Azure Key Vault
                └──► Azure Blob Storage

Azure OpenAI ◄──── HTTPS from container (Azure backbone)
Anaplan      ◄──── HTTPS from container (Internet)
SMTP         ◄──── SMTPS :465 from container
```

---

## 8. Multi-Tenancy Architecture

```
Single deployment — logical tenant isolation

┌─────────────────────────────────────────┐
│  LedgerLM Application                   │
│                                         │
│  ┌─────────────┐  ┌─────────────┐       │
│  │  Bosch      │  │  Nemko      │       │
│  │  in.bosch   │  │  nemko.com  │       │
│  │  .com       │  │             │       │
│  │             │  │             │       │
│  │  domain_id  │  │  domain_id  │       │
│  │  = UUID-A   │  │  = UUID-B   │       │
│  └─────────────┘  └─────────────┘       │
│                                         │
│  All DB queries scoped by domain_id     │
│  No cross-tenant data access possible   │
└─────────────────────────────────────────┘
```

---

## 9. Deployment Pipeline

```
Developer (Replit)
    │
    │ git push
    ▼
GitHub Repository (matasma2025/ledgerlm-private)
    │
    │ docker build
    ▼
Azure Container Registry (ACR)
    │
    │ App Service pulls image
    ▼
Azure App Service for Containers
    │
    │ On startup: runs DB migrations automatically
    ▼
Live Application
```

---

## 10. Technology Stack Summary

| Layer | Technology | Version |
|---|---|---|
| Frontend | React + Vite | React 18, Vite 5 |
| Backend API | Node.js + Express | Node 20, Express 4 |
| AI/ML Backend | Python + FastAPI | Python 3.11, FastAPI 0.110 |
| ORM | Drizzle ORM | Latest |
| Database | PostgreSQL + pgvector | PostgreSQL 15 |
| AI Model | Azure OpenAI GPT-5.2 | gpt-5.2 deployment |
| Embeddings | text-embedding-3-large | 3072 dimensions |
| Container | Docker (Nginx + Supervisor) | Nginx 1.24 |
| Hosting | Azure App Service for Containers | P2v3 |
| Secrets | Azure Key Vault | — |
| Image Registry | Azure Container Registry | — |
| Data Source | Azure Blob Storage | — |
| SSO | Azure AD / Entra ID | OIDC |
| Auth | Email OTP (bcrypt) | bcryptjs |
| Session | PostgreSQL-backed sessions | connect-pg-simple |

---

*Document prepared by LedgerLM Development Team*  
*For Bosch Cyber Security review — CS Activities / TARA Assessment*

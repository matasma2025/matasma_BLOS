# LedgerLM

AI-powered financial analysis platform: upload financial documents, ask questions via chat, and get RAG-enhanced insights across PDFs, Excel, DOCX, and more.

## Run & Operate

- **Workflow**: `LedgerLM` — runs `cd ledgerlm/ledgerlm && npm run dev` (starts both services)
- Node.js/Express + Vite dev server on port 5000 (serves React frontend + API)
- Python FastAPI backend on port 8000 (internal, auto-started by Node server; not externally exposed)
- `cd ledgerlm/ledgerlm && npm run db:push` — push DB schema changes (dev only)

## Required Secrets (all configured)

- `DATABASE_URL` — Postgres connection string (Neon)
- `OPENAI_API_KEY` — OpenAI API key for chat + embeddings
- `GOOGLE_API_KEY` / `GOOGLE_CSE_ID` — Google Search for RAG web context
- `SESSION_SECRET` — Express session secret
- SMTP secrets (`SMTP_HOST`, `SMTP_USER`, etc.) — email OTP auth
- Anaplan secrets — data sync automation
- `APP_URL` — base URL for the app

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

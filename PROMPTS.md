# ClearPulse — Build Prompts

> Paste these prompts sequentially into Cursor Agent to reproduce the entire project from scratch.
> Wait for each phase to complete before sending the next prompt.

---

## Pre-requisites

- Node.js 22+
- PostgreSQL 14+ running locally (or Docker Desktop for Supabase local)
- Supabase CLI (`brew install supabase/tap/supabase`)

---

## Prompt 1 — Phase 1: Foundation

```
You are a senior full-stack engineer and AI product architect building a production-ready, enterprise-grade web application. Non-negotiable principles:

Code: TypeScript strict mode everywhere. No stubs, no TODOs, no placeholder logic. Every function must work.
Security: RBAC enforced at middleware, API handler, and component level. Server always re-validates role — never trust the client.
AI: Every Claude API call must include explicit JSON-only output instructions. Always parse safely with try/catch. Never let raw AI output touch the UI without validation.
Data: All unstructured data from 9 sources must be normalized into RawSignal schema before KPI analysis. Never do health scoring on raw un-normalized text.
UI: Leadership-grade dashboards. Think Amplitude meets Linear meets Notion. Refined, data-dense, not cluttered.
Discipline: After every phase, output a file manifest and summary. Wait for confirmation before the next phase.


PROJECT OVERVIEW
Product Name: ClearPulse
Tagline: "Every signal. Every account. One source of truth."
What it does: ClearPulse ingests unstructured data from 9 disparate sources — Slack, Fathom, AM meetings, Vitally, Salesforce, Personas, SharePoint, Jira, and Google Drive — normalizes it using AI, extracts KPIs per client account, scores each KPI's health with LLM-generated evidence-backed explanations, and surfaces everything in a leadership dashboard. CSMs/Admins can manually edit KPIs. Leadership gets a real-time portfolio view and can download a PDF report matching the Vitally CSM Account Overview template.
Primary Users:

👑 Leadership/Executives — portfolio health, per-account KPI dashboards, PDF report download
🧑‍💼 CSMs/AMs — per-account KPI management, manual edits, meeting sync
🛠️ Admins — full CRUD, user management, integration config, RBAC, sync console


TECH STACK
Frontend

Next.js 14 (App Router, TypeScript)
Tailwind CSS + shadcn/ui
Zustand (global) + TanStack Query v5 (server state)
TanStack Table v8 (sortable, filterable, paginated)
Recharts + @nivo/bar (KPI trend charts, health rings)
Framer Motion (page transitions, staggered reveals)
React Hook Form + Zod
@react-pdf/renderer (client-side PDF generation)
Lucide React

Backend

Next.js App Router API routes
Prisma ORM → PostgreSQL (Supabase)
NextAuth.js v5 (Prisma adapter, JWT sessions)
BullMQ + Upstash Redis (async ingestion jobs, sync queues)
Upstash Redis (rate limiting, caching)
Supabase Storage (report PDFs, document snapshots)

AI Layer

Primary: Anthropic Claude API — claude-sonnet-4-20250514

Unstructured → normalized signal extraction
KPI identification + value extraction
KPI health scoring with evidence-backed narrative
Report narrative generation


Embeddings: OpenAI text-embedding-3-small → pgvector (semantic dedup of signals)

Integrations (9 Data Sources)

Slack — Slack Web API (conversations.history, search.messages)
Fathom — REST API + webhook (meeting recordings, transcripts, summaries)
AM Meetings — Google Calendar API + Google Meet transcript export
Vitally — REST API (accounts, notes, traits, timeline events)
Salesforce — REST API (opportunities, account fields, activity history)
Personas — REST API or CSV import (customer persona + segment data)
SharePoint — Microsoft Graph API (document libraries, files, pages)
Jira — REST API v3 (issues, epics, comments, status history per account label)
Google Drive — Google Drive API v3 (files in per-customer folders, Docs export)

Infrastructure

Vercel (deployment)
Supabase (PostgreSQL + pgvector + Storage)
Upstash (Redis + BullMQ)
t3-env (type-safe environment variables)


THE CORE CONCEPT: SIGNAL INTELLIGENCE PIPELINE
┌─────────────────────────────────────────────────────┐
│                  9 DATA SOURCES                      │
│  Slack · Fathom · AM Meetings · Vitally · Salesforce │
│  Personas · SharePoint · Jira · Google Drive         │
└──────────────────────┬──────────────────────────────┘
                       │ raw unstructured data
                       ▼
┌─────────────────────────────────────────────────────┐
│              INGESTION LAYER (BullMQ jobs)           │
│  Per-source adapters normalize to RawSignal schema   │
│  De-duplicate via pgvector embeddings                │
└──────────────────────┬──────────────────────────────┘
                       │ normalized RawSignal[]
                       ▼
┌─────────────────────────────────────────────────────┐
│            AI EXTRACTION (Claude API)                │
│  Extract KPIs from signals per account               │
│  Assign category, value, target, unit                │
│  Link each KPI to evidencing signals                 │
└──────────────────────┬──────────────────────────────┘
                       │ structured ClientKPI[]
                       ▼
┌─────────────────────────────────────────────────────┐
│            HEALTH SCORING ENGINE (Claude API)        │
│  Score 0-100 per KPI                                 │
│  Status: HEALTHY / AT_RISK / CRITICAL                │
│  Trend: IMPROVING / STABLE / DECLINING               │
│  Narrative: why health is good/bad (2-4 sentences)   │
│  Cite specific signals as evidence                   │
└──────────────────────┬──────────────────────────────┘
                       │ KPI + health + evidence
                       ▼
┌─────────────────────────────────────────────────────┐
│     DASHBOARD + ACCOUNT OVERVIEW + PDF REPORT        │
└─────────────────────────────────────────────────────┘

DATABASE SCHEMA (Prisma)
File: prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

model User {
  id         String     @id @default(cuid())
  email      String     @unique
  name       String?
  avatarUrl  String?
  role       Role       @default(CSM)
  isActive   Boolean    @default(true)
  lastLogin  DateTime?
  createdAt  DateTime   @default(now())
  sessions   Session[]
  accounts   ClientAccount[]
  auditLogs  AuditLog[]
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum Role {
  ADMIN
  LEADERSHIP
  CSM
  VIEWER
}

model ClientAccount {
  id                 String         @id @default(cuid())
  name               String
  domain             String?
  vitallyAccountId   String?        @unique
  salesforceId       String?        @unique
  csm                User?          @relation(fields: [csmId], references: [id])
  csmId              String?
  tier               String?
  industry           String?
  healthScore        Float?
  healthStatus       HealthStatus   @default(UNKNOWN)
  currentSolution    String?        @db.Text
  currentState       String?        @db.Text
  businessGoals      String?        @db.Text
  objectives         String?        @db.Text
  roadblocks         String?        @db.Text
  implementationPlan String?        @db.Text
  lastSyncedAt       DateTime?
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
  kpis               ClientKPI[]
  signals            RawSignal[]
  meetings           Meeting[]
  contacts           Contact[]
  reportSnapshots    ReportSnapshot[]
}

enum HealthStatus {
  HEALTHY
  AT_RISK
  CRITICAL
  UNKNOWN
}

model RawSignal {
  id          String        @id @default(cuid())
  account     ClientAccount @relation(fields: [accountId], references: [id])
  accountId   String
  source      SignalSource
  externalId  String?
  title       String?
  content     String        @db.Text
  author      String?
  url         String?
  signalDate  DateTime
  embedding   Unsupported("vector(1536)")?
  processed   Boolean       @default(false)
  createdAt   DateTime      @default(now())
  kpiEvidence KPIEvidence[]

  @@index([accountId, source])
}

enum SignalSource {
  SLACK
  FATHOM
  AM_MEETING
  VITALLY
  SALESFORCE
  PERSONAS
  SHAREPOINT
  JIRA
  GOOGLE_DRIVE
}

model ClientKPI {
  id              String        @id @default(cuid())
  account         ClientAccount @relation(fields: [accountId], references: [id])
  accountId       String
  metricName      String
  targetValue     String?
  currentValue    String?
  unit            String?
  category        KPICategory
  source          KPISource     @default(MANUAL)
  status          KPIStatus     @default(ON_TRACK)
  healthScore     Float?
  healthStatus    HealthStatus  @default(UNKNOWN)
  healthNarrative String?       @db.Text
  healthTrend     HealthTrend   @default(STABLE)
  lastScoredAt    DateTime?
  videoTimestamp  Int?
  videoClipUrl    String?
  notes           String?       @db.Text
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  history         KPIHistory[]
  evidence        KPIEvidence[]
}

model KPIEvidence {
  id         String    @id @default(cuid())
  kpi        ClientKPI @relation(fields: [kpiId], references: [id])
  kpiId      String
  signal     RawSignal @relation(fields: [signalId], references: [id])
  signalId   String
  excerpt    String    @db.Text
  relevance  Float
  createdAt  DateTime  @default(now())

  @@unique([kpiId, signalId])
}

model KPIHistory {
  id           String       @id @default(cuid())
  kpi          ClientKPI    @relation(fields: [kpiId], references: [id])
  kpiId        String
  value        String
  healthScore  Float?
  healthStatus HealthStatus?
  changedBy    String
  changedAt    DateTime     @default(now())
  note         String?
}

enum KPICategory {
  DEFLECTION
  EFFICIENCY
  ADOPTION
  REVENUE
  SATISFACTION
  RETENTION
  CUSTOM
}

enum KPISource {
  MANUAL
  AI_EXTRACTED
  VITALLY_SYNC
  FATHOM_SYNC
  SLACK_SIGNAL
  SALESFORCE_SYNC
  JIRA_SYNC
  GDRIVE_SIGNAL
  SHAREPOINT_SIGNAL
}

enum KPIStatus {
  ON_TRACK
  AT_RISK
  ACHIEVED
  MISSED
}

enum HealthTrend {
  IMPROVING
  STABLE
  DECLINING
}

model Meeting {
  id              String        @id @default(cuid())
  fathomId        String?       @unique
  account         ClientAccount @relation(fields: [accountId], references: [id])
  accountId       String
  title           String
  recordingUrl    String?
  transcriptRaw   String?       @db.Text
  summaryAI       String?       @db.Text
  duration        Int?
  meetingDate     DateTime
  syncedToVitally Boolean       @default(false)
  extractedKPIs   Boolean       @default(false)
  participants    String[]
  createdAt       DateTime      @default(now())
}

model Contact {
  id        String        @id @default(cuid())
  account   ClientAccount @relation(fields: [accountId], references: [id])
  accountId String
  name      String
  role      String?
  email     String?
  isPrimary Boolean       @default(false)
}

model ReportSnapshot {
  id          String        @id @default(cuid())
  account     ClientAccount @relation(fields: [accountId], references: [id])
  accountId   String
  pdfUrl      String
  generatedBy String
  generatedAt DateTime      @default(now())
  version     Int
}

model AuditLog {
  id         String   @id @default(cuid())
  user       User     @relation(fields: [userId], references: [id])
  userId     String
  action     String
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())
}

model SyncJob {
  id           String      @id @default(cuid())
  source       SignalSource
  accountId    String?
  status       JobStatus   @default(PENDING)
  triggeredBy  String
  startedAt    DateTime?
  completedAt  DateTime?
  error        String?
  signalsFound Int?
  kpisUpdated  Int?
  createdAt    DateTime    @default(now())
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}


RBAC PERMISSION MATRIX
File: lib/rbac.ts
Implement hasPermission(role, permission) and usePermissions() hook.

Permission           | ADMIN | LEADERSHIP | CSM      | VIEWER
View all accounts    | YES   | YES        | Own only | YES
View KPI health      | YES   | YES        | Own only | YES
View signal evidence | YES   | YES        | Own only | NO
Edit account fields  | YES   | NO         | Own only | NO
Manually edit KPIs   | YES   | NO         | Own only | NO
Override AI health   | YES   | NO         | NO       | NO
Trigger source sync  | YES   | NO         | Own only | NO
Run health re-score  | YES   | NO         | Own only | NO
Push to Vitally      | YES   | NO         | Own only | NO
Download PDF report  | YES   | YES        | Own only | YES
Manage users/roles   | YES   | NO         | NO       | NO
Configure integrations| YES  | NO         | NO       | NO
View audit logs      | YES   | NO         | NO       | NO
View sync jobs       | YES   | NO         | NO       | NO


DESIGN SYSTEM

Colors: Background #F7F8FA · Sidebar #0D1117 · Accent #2563EB
Health: Healthy #10B981 · At Risk #F59E0B · Critical #EF4444
Source Badge Colors: Slack #4A154B · Fathom #FF6B35 · Jira #0052CC · Google Drive #4285F4 · Salesforce #00A1E0 · Vitally #7C3AED · SharePoint #0078D4 · Personas #059669 · AM Meeting #8B5CF6
Typography: Display — Sora (Google Fonts) · Body — DM Sans · Mono — JetBrains Mono
HealthRing: Custom SVG ring component <HealthRing score={73} size={48} /> — color-coded arc
Cards: rounded-2xl · shadow-sm · border border-gray-100
Tables: TanStack Table v8, sticky headers, zebra rows


Build Phase 1 — Foundation:

1. Next.js 14 + TypeScript + Tailwind + shadcn/ui (use Radix primitives, NOT base-nova/v4 style — must be Tailwind v3 compatible)
2. Prisma schema (full schema above) + generate client
3. NextAuth.js v5 with Google + Credentials providers. IMPORTANT: Do NOT use PrismaAdapter — it conflicts with Credentials provider under JWT strategy. Handle user lookup manually in authorize() and signIn() callbacks.
4. RBAC middleware (edge) + lib/rbac.ts with hasPermission() + usePermissions() client hook
5. Base layout: collapsible sidebar (role-aware nav), sticky header with breadcrumbs + user dropdown, Framer Motion page transitions, Sonner toast
6. t3-env for type-safe env vars + .env.local.example with all 30+ vars
7. Seed script (prisma/seed.ts): 4 users (Admin, Leadership, CSM, Viewer) + 3 demo accounts
8. Pages: /login, /dashboard (stats cards + chart placeholders), /accounts (empty state), /admin/users, /admin/integrations (9 source cards), /admin/sync, /admin/audit
9. Custom components: <HealthRing>, <HealthStatusBadge>, <HealthTrendIndicator>, <SourceBadge> (all 9 sources), <CardSkeleton>, <TableSkeleton>, <PageSkeleton>

After building, output a complete file manifest and summary. Wait for confirmation before Phase 2.
```

---

## Prompt 2 — Setup Database & Run

```
Set up the database and run the app:
1. Start local Supabase: supabase init && supabase start
2. Enable pgvector extension on the Supabase database
3. Update .env with the local Supabase DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY from supabase start output
4. Run prisma db push to sync the schema
5. Run the seed script to create demo users and accounts
6. Start the dev server
7. Verify login works end-to-end with admin@clearpulse.dev / admin123
```

---

## Prompt 3 — Phase 2: Account Management Core

```
Build Phase 2 — Account Management Core. The database is seeded with 4 users and 3 accounts.

1. Account List Page (/accounts):
   - TanStack Table v8 with columns: Name, Tier, Industry, Health Score (HealthRing), Health Status (badge), CSM, Last Synced, Actions
   - Search by name/domain, filter by tier/CSM/health status, sort all columns
   - Role-gated: CSMs see only their accounts, Leadership/Admin/Viewer see all
   - Click row → navigate to /accounts/[id]
   - "Add Account" button (Admin/CSM only) → modal with form

2. Account Overview Page (/accounts/[id]) — all 10 sections matching Vitally template:
   - Section 1: Header with health ring, status badge, tier pill, CSM avatar, action bar (Edit, Re-score, Sync, Push to Vitally, Download Report — all role-gated)
   - Section 2: Current Agreement / Solution Summary — inline editable rich text
   - Section 3: Current State — template fields (hours/week, estimated cost, elaboration)
   - Section 4: Business Goals — editable list with goal text, owner, date
   - Section 5: Objectives — structured list with name, owner, due date, status
   - Section 6: KPIs table (MOST IMPORTANT) — TanStack Table with: Metric Name, Target, Current Value, Health Score (mini ring), Health Status (badge), Trend (arrow), Source (badge), Last Updated, Evidence count chip, Video icon. Expand row for full AI narrative. Inline edit. "+ Add KPI" button.
   - Section 7: Go-Forward Program / Implementation Priorities — ordered drag-to-reorder list
   - Section 8: Current Roadblocks — list with severity (Low/Medium/High/Blocking)
   - Section 9: Key Contacts — card grid with name, role, email, isPrimary badge
   - Section 10: Meeting History — timeline view, newest first
   - All sections collapsible with smooth animation
   - All editable fields save via API routes with optimistic updates

3. API Routes:
   - GET/PUT /api/accounts/[id] — fetch and update account
   - GET/POST /api/accounts/[id]/kpis — list and create KPIs
   - PUT/DELETE /api/accounts/[id]/kpis/[kpiId] — update and delete KPI
   - GET/POST /api/accounts/[id]/contacts — list and create contacts
   - All routes use withAuth/withPermission helpers, validate with Zod

4. Contacts CRUD: Add/edit/delete contacts from the account overview page

Output file manifest and summary. Wait for confirmation before Phase 3.
```

---

## Prompt 4 — Phase 3: Signal Ingestion Infrastructure

```
Build Phase 3 — Signal Ingestion Infrastructure.

1. RawSignal ingestion service (lib/ingestion/ingest.ts):
   - Accept RawSignalInput[], store to DB
   - Generate embeddings via OpenAI text-embedding-3-small
   - Deduplicate via pgvector cosine similarity > 0.95
   - Mark signals as processed

2. All 9 source adapters in lib/sources/{name}.ts implementing SourceAdapter interface:
   - Each implements: fetchSignals(accountId, since?) → RawSignalInput[]
   - Use real API shapes but with mock data fallback for dev (env flag USE_MOCK_DATA=true)
   - Slack: conversations.history + search.messages, match by channel/domain
   - Fathom: GET /meetings, match by attendee email domain
   - AM Meetings: Google Calendar API, export Meet transcripts
   - Vitally: notes, traits, timeline events, NPS
   - Salesforce: OAuth2, opportunities, activities, cases
   - Personas: REST API or CSV, persona profiles
   - SharePoint: Microsoft Graph, document export
   - Jira: REST v3, JQL search, issues + comments
   - Google Drive: files in per-customer folders, export Docs as text

3. Fathom webhook receiver: POST /api/webhooks/fathom

4. Signal Browser Page (/accounts/[id]/signals):
   - Filter by source (9 checkboxes), date range, author, keyword
   - Sort by date, relevance, source
   - Signal cards: source badge, date, author, title, content excerpt (expandable), linked KPIs
   - "Mark as Irrelevant" action

5. API Routes:
   - GET /api/accounts/[id]/signals — paginated, filtered
   - POST /api/sync/trigger — trigger sync for source/account
   - GET /api/sync/jobs — list sync jobs

Output file manifest and summary. Wait for confirmation before Phase 4.
```

---

## Prompt 5 — Phase 4: AI Extraction Pipeline

```
Build Phase 4 — AI Extraction Pipeline.

1. KPI Extraction (lib/ai/extractKPIs.ts):
   - Batch signals into ~8000 token chunks
   - Call Claude API with EXTRACTION_SYSTEM prompt (JSON-only output, try/catch parse)
   - Extract: metricName, targetValue, currentValue, unit, category, evidenceSignalIds, excerpts
   - Merge + deduplicate KPIs across batches by normalized metricName
   - Store ClientKPI records + KPIEvidence links

2. Evidence Panel (slide-over drawer component):
   - Opens from KPI table "N signals" chip
   - Groups evidence by source with source icon + color badge
   - Per signal: source, date, author, excerpt, link to original
   - "Most influential" signals at top (by relevance score)
   - Filter by source and date range
   - Account team notes marked [HIGH PRIORITY]

3. API Routes:
   - POST /api/accounts/[id]/extract — trigger KPI extraction for account
   - GET /api/accounts/[id]/kpis/[kpiId]/evidence — get evidence for KPI

Output file manifest and summary. Wait for confirmation before Phase 5.
```

---

## Prompt 6 — Phase 5: Health Scoring Engine

```
Build Phase 5 — Health Scoring Engine.

1. Per-KPI Health Scoring (lib/ai/scoreKPIHealth.ts):
   - Call Claude with HEALTH_SYSTEM prompt for each KPI
   - Input: KPI data + all evidence signals + recent signals (last 30 days, 5 per source) + persona context
   - Account team notes flagged as [HIGH PRIORITY] in prompt, weighted 1.5x
   - Output: healthScore (0-100), healthStatus, healthTrend, healthNarrative, keyEvidenceIds
   - JSON-only output, try/catch parse, validate with Zod

2. Account-Level Health Score:
   - Weighted average: REVENUE 2x, RETENTION 2x, ADOPTION 1.5x, others 1x
   - Store to ClientAccount.healthScore + healthStatus

3. Re-score Triggers:
   - Automatic after ingestion batch completes
   - Manual "Re-score Health" button on account page (CSM/Admin)
   - Health history sparklines on KPI rows (using KPIHistory data)
   - Trend indicators (Improving/Stable/Declining arrows)

4. API Routes:
   - POST /api/accounts/[id]/score — trigger health re-score
   - GET /api/accounts/[id]/kpis/[kpiId]/history — KPI history for sparklines

Output file manifest and summary. Wait for confirmation before Phase 6.
```

---

## Prompt 7 — Phase 6: Dashboard

```
Build Phase 6 — Executive Dashboard (/dashboard).

1. Row 1 — Portfolio Stats (4 metric cards): Total Active Accounts, Accounts Critical, Accounts At Risk, KPIs Declining. Live data from API.

2. Row 2 — Portfolio Health Map: Horizontal bar chart (Recharts), every account sorted by health score. Color bands: 0-39 red, 40-69 amber, 70-100 green. Click bar → navigate to account.

3. Row 3 — Split view:
   - Left: KPI Health Breakdown donut (@nivo/bar) — Healthy / At Risk / Critical across all KPIs
   - Right: Source Signal Activity stacked bar (Recharts) — signals per source per day, last 14 days

4. Row 4 — Accounts Needing Attention: Table of accounts with ≥1 CRITICAL or DECLINING KPI. Columns: Account, Health Score, Critical KPIs, Last Signal, Last Meeting, CSM. Quick action buttons.

5. Row 5 — Recent AI Extractions Feed: Last 15 KPIs extracted by AI across all accounts. Each: account name, metric, health status, source, timestamp.

6. Framer Motion: staggered card reveals on page load.

7. API Route: GET /api/dashboard/stats — aggregated portfolio data.

Output file manifest and summary. Wait for confirmation before Phase 7.
```

---

## Prompt 8 — Phase 7: PDF Report

```
Build Phase 7 — PDF Report (Vitally Template Format) using @react-pdf/renderer.

5-page report matching Vitally CSM Account Overview:
- Cover: account name, subtitle, date, CSM name, logo
- Page 1: Account Summary — health ring, solution summary, current state
- Page 2: Goals & Objectives
- Page 3: KPIs table with health rings, narratives, source badges (MOST IMPORTANT PAGE)
- Page 4: Go-Forward Program + Roadblocks
- Page 5: Key Contacts (2-column grid)

API: POST /api/accounts/[id]/report/generate — fetch data, render PDF, upload to Supabase Storage, save ReportSnapshot, return signed URL.
Frontend: Download button with polling status indicator.

Output file manifest and summary. Wait for confirmation before Phase 8.
```

---

## Prompt 9 — Phase 8: Vitally + Fathom Push

```
Build Phase 8 — Vitally + Fathom Push Integration.

1. Vitally Push (lib/integrations/vitally.ts):
   - Push KPI health as custom Trait: PATCH /v1/accounts/{id}/traits
   - Push health narrative as Note: POST /v1/notes
   - Push timeline event on health change: POST /v1/timeline-events
   - "Push to Vitally" button on account page (role-gated)

2. Fathom Webhook: POST /api/webhooks/fathom — trigger ingestion on meeting.completed

3. Sync status badges per source on account header (icon + timestamp)

4. Video timestamp viewer modal — for KPIs with videoTimestamp, open modal with embedded video player seeked to timestamp

Output file manifest and summary. Wait for confirmation before Phase 9.
```

---

## Prompt 10 — Phase 9: Admin Panel

```
Build Phase 9 — Admin Panel (all ADMIN-only routes).

1. /admin/users — Full user management:
   - TanStack Table: Name, Email, Role, Status, Last Login
   - Edit Role (dropdown), Deactivate toggle, Resend Invite
   - "+ Invite User" modal with email + role selection

2. /admin/integrations — All 9 source configurations:
   - Per-source card: name, icon, connection status badge, API key input (masked) OR OAuth Connect button
   - Last synced + signal count, Test Connection button
   - Per-account config (Jira JQL, Google Drive folder IDs, Personas API URL)

3. /admin/sync — Sync Console:
   - Trigger: per-source (all accounts) OR per-account (all sources)
   - Job table: Source, Account, Status, Signals Found, KPIs Updated, Started, Duration, Error
   - Auto-refresh every 5 seconds, "Re-run Failed" button

4. /admin/audit — Audit Log:
   - All mutations: KPI edits, syncs, Vitally pushes, role changes, report downloads
   - Filter: user, action, date range
   - CSV export button

Output file manifest and summary. Wait for confirmation before Phase 10.
```

---

## Prompt 11 — Phase 10: Polish + Production

```
Build Phase 10 — Polish + Production Readiness.

1. Loading skeletons on every data-fetching page
2. Empty states with CTAs on all list pages
3. Error boundaries wrapping each route segment
4. Framer Motion: page transitions on all route changes, staggered reveals on dashboard cards/table rows
5. Mobile responsive pass: collapsible sidebar overlay, stacked cards, horizontal scroll tables
6. Redis rate limiting on all API routes (Upstash)
7. Structured error logging (console.error with context objects)
8. Final build check: npx next build must pass with 0 errors

Output final complete file manifest covering all 10 phases.
```

---

## Post-Build Setup Commands

```bash
# 1. Install dependencies
cd clearpulse && npm install

# 2. Start local Supabase (requires Docker Desktop running)
supabase start

# 3. Copy .env and fill in Supabase values from supabase start output
cp .env.local.example .env

# 4. Enable pgvector
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 5. Push schema + seed
npx prisma db push
npx tsx prisma/seed.ts

# 6. Run
npm run dev

# Login: admin@clearpulse.dev / admin123
# Supabase Studio: http://127.0.0.1:54323
```

# ClearPulse

ClearPulse is an AI-powered customer intelligence product for post-sale teams. It pulls customer signals from the tools your team already uses, normalizes them into one evidence layer, extracts measurable KPIs, scores health with narrative context, and turns account chaos into a leadership-ready operating system.

## What It Solves

Customer success data usually lives everywhere at once: Slack threads, meeting transcripts, CSM notes, Jira blockers, docs, CRM history, and success platforms. ClearPulse is built for teams that need one reliable account view instead of stitching together the story manually before every QBR, risk review, or exec update.

ClearPulse helps teams:

- unify account evidence from multiple systems
- extract KPIs from raw customer signals with AI
- score KPI health with evidence-backed explanations
- monitor a portfolio, not just one account at a time
- generate leadership-ready account summaries and reports
- push health context back into downstream systems like Vitally

## Who It’s For

- Customer Success leaders who need a real portfolio view
- CSMs and AMs who maintain strategic account plans
- RevOps and CS Ops teams building repeatable post-sale workflows
- Founders and GTM leaders who want a productized way to monitor customer health

## Product Flow

1. ClearPulse ingests signals from connected customer systems.
2. Every source is normalized into a shared raw-signal model.
3. AI extracts KPIs and attaches evidencing signals.
4. KPI health is scored with narrative context and trend data.
5. Teams review accounts, sync updates, and generate reports from one workspace.

## How To Use It

If you want the operational guide for logging in, connecting APIs, configuring the webhook, and running sync/extract/score workflows, start here:

- [Complete Platform Guide](docs/complete-platform-guide.md)
- [Platform Usage and Integrations](docs/platform-usage-and-integrations.md)
- [Product Architecture and AI Flow](docs/product-architecture-and-ai-flow.md)

## Core Product Surfaces

- `/` public product landing page
- `/login` product-style sign-in entry
- `/dashboard` leadership portfolio health view
- `/accounts` searchable account workspace
- `/accounts/[id]` account overview with KPIs, evidence, contacts, and meetings
- `/accounts/[id]/signals` raw signal browser
- `/admin/integrations` browser-managed source credentials, AI provider settings, and config testing
- `/admin/sync` sync console and job visibility
- `/admin/users` user and role management
- `/admin/audit` operational audit trail

## Supported Integrations

Current source coverage includes:

- Slack
- Fathom
- AM Meetings
- Vitally
- Salesforce
- Personas
- SharePoint
- Jira
- Google Drive

Browser-managed integration settings are now supported for the API-key style sources first:

- Slack
- Fathom
- Vitally
- Jira
- Personas

AI providers can also be managed from the browser in the same admin surface:

- Anthropic
- Google Gemini
- OpenAI

The remaining OAuth-heavy or hybrid sources still rely on environment configuration for now:

- AM Meetings
- Salesforce
- SharePoint
- Google Drive

## Stack

- Next.js 14 App Router
- TypeScript strict mode
- Tailwind CSS + shadcn/ui
- Prisma + PostgreSQL
- NextAuth v5
- TanStack Query + TanStack Table
- BullMQ + Redis
- Anthropic or Gemini for text generation + OpenAI embeddings

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

- Use `.env.local.example` as the reference.
- Queue-backed sync requires `UPSTASH_REDIS_URL` or `REDIS_URL`.
- `UPSTASH_REDIS_REST_URL` alone is not enough for BullMQ workers.
- Mutation route rate limiting uses `UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN` when available.
- Browser-managed integration credentials and AI provider keys are encrypted server-side. They use `INTEGRATION_SETTINGS_ENCRYPTION_KEY` when set, otherwise they fall back to `NEXTAUTH_SECRET`.
- Some adapters still rely on additional environment values:
  - `GOOGLE_REFRESH_TOKEN`
  - `SALESFORCE_USERNAME`
  - `SALESFORCE_PASSWORD`
  - `SHAREPOINT_SITE_ID`
  - `GDRIVE_CUSTOMERS_FOLDER_ID`

3. Prepare the database

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

4. Start the app

```bash
npm run dev
```

5. Optional: start the ingestion worker in a second terminal

```bash
npm run worker:ingestion
```

Open [http://localhost:3000](http://localhost:3000).

## Seeded Users

The seed script creates local users for development:

- `admin@clearpulse.dev` / `admin123`
- `leadership@clearpulse.dev` / `lead123`
- `csm@clearpulse.dev` / `csm123`
- `viewer@clearpulse.dev` / `viewer123`

It also creates demo accounts so the product is usable immediately after seeding.

## Useful Scripts

```bash
npm run dev
npm run build
npm test
npm run worker:ingestion
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Current State

ClearPulse now includes:

- account management
- KPI extraction and evidence linking
- health scoring
- leadership dashboarding
- meeting enrichment
- PDF report generation
- admin tooling
- browser-managed encrypted integration settings
- rate limiting, error boundaries, and automated tests for critical policy layers

The app builds successfully with `npm run build`, and the current test suite covers RBAC, rate limiting, and protected route behavior.

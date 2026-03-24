# ClearPulse

ClearPulse is a Next.js 14 customer intelligence application for ingesting account signals, extracting KPIs with AI, and surfacing customer health for CSMs, admins, and leadership.

## Current Scope

- Auth, RBAC, account management, signal ingestion, and KPI extraction are implemented.
- Health scoring, reporting, and the leadership/admin surfaces are still in progress.
- The repo currently builds successfully with `npm run build`.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- Prisma + PostgreSQL
- NextAuth v5
- TanStack Query + TanStack Table
- BullMQ + Upstash Redis
- Anthropic + OpenAI embeddings

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

- Use `.env.local.example` as the reference for required keys.
- The current source adapters also rely on:
  - `GOOGLE_REFRESH_TOKEN`
  - `SALESFORCE_USERNAME`
  - `SALESFORCE_PASSWORD`
  - `SHAREPOINT_SITE_ID`
  - `GDRIVE_CUSTOMERS_FOLDER_ID`

3. Prepare the database:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Seeded Users

The seed script creates local users for development:

- `admin@clearpulse.dev`
- `leadership@clearpulse.dev`
- `csm@clearpulse.dev`
- `viewer@clearpulse.dev`

It also creates three demo accounts.

## Useful Scripts

```bash
npm run dev
npm run build
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Phase 4.5 Cleanup

This cleanup pass aligns the current repo with the implemented app by:

- normalizing account tier values across seed data, filters, and UI
- fixing account list sort parameter mismatches
- adding a working `/accounts/[id]/edit` route
- keeping adapter environment references aligned with `src/lib/sources`

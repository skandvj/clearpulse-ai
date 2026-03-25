# ClearPulse Platform Usage and Integration Guide

This guide explains how to use ClearPulse day to day, how to connect each source, and how to configure the webhook flow that exists today.

## 1. What ClearPulse Does

ClearPulse is a customer intelligence workspace for post-sale teams. It:

- pulls customer signals from external systems
- normalizes them into one signal layer
- extracts KPIs from those signals
- scores KPI health with AI-backed narrative context
- shows the resulting portfolio and account view in one workspace

## 2. Log In and Roles

In local development, the seed script creates these users:

- `admin@clearpulse.dev` / `admin123`
- `leadership@clearpulse.dev` / `lead123`
- `csm@clearpulse.dev` / `csm123`
- `viewer@clearpulse.dev` / `viewer123`

Recommended first login:

- use the Admin account first so you can configure integrations and run syncs

Role summary:

- `ADMIN`: configure integrations, run syncs, manage users, audit, and full account management
- `LEADERSHIP`: portfolio and account visibility, report download
- `CSM`: assigned-account workflows, KPI/account editing, sync and scoring on owned accounts
- `VIEWER`: read-only visibility

## 3. Typical Workflow

The normal operating flow inside ClearPulse is:

1. Log in as Admin or CSM.
2. Open `/admin/integrations` and configure the source credentials and AI provider keys you need.
3. Open `/admin/sync` or an account page and trigger syncs.
4. Review raw evidence in `/accounts/[id]/signals`.
5. Open an account and run `Extract KPIs`.
6. Run `Re-score Health`.
7. Review KPI evidence, meeting detail, dashboard trends, and generated reports.
8. Optionally push KPI health back into Vitally.

## 4. Where To Configure Integrations

Use:

- `/admin/integrations` for connection status, browser-managed credentials, and config tests
- `/admin/sync` for actual sync execution and job tracking

There are three setup modes in the current product:

- browser-managed configuration
- environment/OAuth configuration
- browser-managed AI configuration

### Browser-managed AI settings

These can be configured directly in `/admin/integrations` and are stored encrypted server-side:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

What they power:

- Anthropic: KPI extraction and KPI health scoring
- OpenAI: embeddings and semantic deduplication

### Browser-managed integrations

These can be configured directly in the ClearPulse admin UI and are stored encrypted server-side:

- Slack
- Fathom
- Vitally
- Jira
- Personas

### Environment-managed integrations

These still rely on environment variables and are not yet browser-editable:

- AM Meetings
- Salesforce
- SharePoint
- Google Drive

## 5. Browser-Managed Source Setup

### Slack

Configure in `/admin/integrations`:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`

How account matching works:

- channel names that match the account name slug
- channel names like `cs-{account-name}` or `customer-{account-name}`
- Slack message search results that mention the account domain

Expected permissions:

- access to conversation history
- access to message search

Notes:

- the adapter pulls channel history and domain mentions
- thread replies are included through Slack history/search coverage

### Fathom

Configure in `/admin/integrations`:

- `FATHOM_API_KEY`
- `FATHOM_WEBHOOK_SECRET`

How account matching works:

- attendee email match against `Contact.email`
- fallback to attendee email domain match against `ClientAccount.domain`

What ClearPulse pulls:

- meeting title
- summary
- transcript
- recording URL
- attendees

Notes:

- Fathom is the only inbound webhook currently implemented
- webhook events also upsert `Meeting` records and trigger ingestion

### Vitally

Configure in `/admin/integrations`:

- `VITALLY_API_KEY`
- `VITALLY_ORG_ID`

How account matching works:

- the account must already have `vitallyAccountId` stored on the ClearPulse account record

What ClearPulse pulls:

- notes
- NPS responses

What ClearPulse can push back:

- KPI traits
- health note
- timeline events

### Jira

Configure in `/admin/integrations`:

- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

How account matching works:

- JQL uses the account name in normalized form
- current pattern:
  - `project = "{AccountLabel}"`
  - or `labels = "{account-slug}"`
  - or `labels = "{AccountLabel}"`

What ClearPulse pulls:

- issue summary and description
- issue status, priority, labels, components
- recent comments

Example:

- if the account name is `Acme Corp`, ClearPulse searches using normalized account labels derived from that name

### Personas

Configure in `/admin/integrations`:

- `PERSONAS_API_URL`
- `PERSONAS_API_KEY`

How account matching works:

- requests are made using `account.domain` first
- otherwise ClearPulse falls back to the account name

What ClearPulse pulls:

- persona profiles
- segment updates

How it is used:

- Personas data acts as contextual signal for account understanding and health scoring

## 6. Environment-Managed Source Setup

These sources are supported in code today but still depend on environment values.

### AM Meetings

Required env:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

How account matching works:

- attendee email match against account contacts
- attendee email domain match against `ClientAccount.domain`

What ClearPulse pulls:

- Google Calendar events
- descriptions and organizer info
- account-linked meeting entries

### Salesforce

Required env:

- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`
- `SALESFORCE_INSTANCE_URL`
- `SALESFORCE_USERNAME`
- `SALESFORCE_PASSWORD`

How account matching works:

- the ClearPulse account must have `salesforceId`

What ClearPulse pulls:

- tasks
- opportunities
- cases

### SharePoint

Required env:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- optional but recommended: `SHAREPOINT_SITE_ID`

How account matching works:

- ClearPulse resolves the site using `SHAREPOINT_SITE_ID` or searches by account name
- then it looks for a folder matching the account name with spaces converted to dashes

What ClearPulse pulls:

- document metadata
- document previews where available

### Google Drive

Required env:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- optional but recommended: `GDRIVE_CUSTOMERS_FOLDER_ID`

How account matching works:

- ClearPulse looks for a folder matching the account name
- if `GDRIVE_CUSTOMERS_FOLDER_ID` is set, folder lookup is scoped under that parent folder

What ClearPulse pulls:

- Google Docs text exports
- Drive file metadata
- customer-folder files

## 7. Fathom Webhook Setup

Current webhook endpoint:

- `POST /api/webhooks/fathom`

Required header:

- `x-fathom-signature`

Signature behavior:

- ClearPulse computes an HMAC SHA-256 digest using `FATHOM_WEBHOOK_SECRET`
- the request body must verify against that signature

Current supported event:

- `meeting.completed`

What happens when the webhook is valid:

1. ClearPulse verifies the signature.
2. It matches the meeting to an account by attendee email or domain.
3. It fetches richer Fathom meeting data when possible.
4. It upserts a `Meeting` record.
5. It triggers Fathom ingestion for that account.

### Local webhook testing

For local development, expose your app publicly with a tunnel such as:

- ngrok
- Cloudflare Tunnel

Example local flow:

1. Start ClearPulse locally.
2. Expose `http://localhost:3000`.
3. Point Fathom webhook delivery to:
   - `https://your-public-url/api/webhooks/fathom`
4. Save the same webhook secret in `/admin/integrations`.

## 8. Sync Behavior

You can trigger syncs from:

- `/admin/sync`
- account-level pages and account tools

Queue behavior:

- if Redis is configured, syncs are queued through BullMQ
- if Redis is not configured, ClearPulse falls back to inline processing

To enable proper queued ingestion:

- set `REDIS_URL` or `UPSTASH_REDIS_URL`
- start the worker with:

```bash
npm run worker:ingestion
```

To run the web app:

```bash
npm run dev
```

## 9. After Sources Are Connected

Once sources are configured and sync is working:

1. Open `/accounts/[id]/signals` to confirm evidence is arriving.
2. Open `/accounts/[id]`.
3. Click `Extract KPIs`.
4. Click `Re-score Health`.
5. Review the KPI table, evidence drawer, and meeting history.
6. Generate a report if needed.
7. Push to Vitally if that integration is configured.

## 10. Admin Surfaces

Primary admin pages:

- `/admin/integrations`
- `/admin/sync`
- `/admin/users`
- `/admin/audit`

Useful account-level pages:

- `/accounts`
- `/accounts/[id]`
- `/accounts/[id]/signals`
- `/accounts/[id]/meetings`

## 11. Troubleshooting

### Integration says Partial

This usually means:

- some required keys are still missing
- a browser-managed source was only partially saved

Use:

- `Test Configuration` in `/admin/integrations`

### Sync jobs are not moving

Check:

- Redis configuration
- whether `npm run worker:ingestion` is running

If Redis is not configured, ClearPulse will fall back to inline sync instead of queued processing.

### No signals are appearing for an account

Check:

- the account has `domain`, `vitallyAccountId`, or `salesforceId` where required
- account contacts are populated for attendee-based matching
- the source-specific credentials are valid

### Fathom webhook is failing

Check:

- the webhook URL is reachable publicly
- `FATHOM_WEBHOOK_SECRET` matches in both Fathom and ClearPulse
- Fathom is sending `meeting.completed`
- attendee emails map to a ClearPulse contact or account domain

## 12. Recommended First Admin Setup

For a practical first setup, do this in order:

1. Seed the database and log in as `admin@clearpulse.dev`.
2. Add or verify account domains and contacts.
3. Configure Fathom and Slack first.
4. Configure Vitally and Jira next.
5. Set up Redis and run the ingestion worker.
6. Trigger syncs from `/admin/sync`.
7. Open an account and run extraction and scoring.
8. Enable the Fathom webhook once the account matching rules are verified.

import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/logging";
import { resolveMockFallback } from "@/lib/sources/mock-fallback";

interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string | JiraDocNode;
    issuetype: { name: string };
    status: { name: string };
    priority: { name: string };
    created: string;
    updated: string;
    assignee?: { displayName: string; emailAddress: string };
    reporter?: { displayName: string; emailAddress: string };
    labels: string[];
    components?: { name: string }[];
    resolution?: { name: string };
    comment?: {
      comments: {
        body: string | JiraDocNode;
        author: { displayName: string };
        created: string;
      }[];
    };
  };
}

interface JiraDocNode {
  type: string;
  content?: JiraDocNode[];
  text?: string;
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

export class JiraAdapter implements SourceAdapter {
  source = SignalSource.JIRA;

  async fetchSignals(
    accountId: string,
    since?: Date,
  ): Promise<RawSignalInput[]> {
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;
    const baseUrl = process.env.JIRA_BASE_URL;

    const mockSignals = await resolveMockFallback({
      source: this.source,
      accountId,
      requiredEnv: ["JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_BASE_URL"],
      createMockSignals: () => this.generateMockSignals(accountId),
    });
    if (mockSignals) return mockSignals;

    try {
      const account = await prisma.clientAccount.findUniqueOrThrow({
        where: { id: accountId },
      });

      const accountLabel = account.name.replace(/[^a-zA-Z0-9]/g, "");
      const accountSlug = account.name.toLowerCase().replace(/\s+/g, "-");
      const sinceDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sinceJQL = sinceDate.toISOString().split("T")[0];

      const jql = `(project = "${accountLabel}" OR labels = "${accountSlug}" OR labels = "${accountLabel}") AND updated >= "${sinceJQL}" ORDER BY updated DESC`;

      const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
      const headers = {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      const signals: RawSignalInput[] = [];
      let startAt = 0;
      const maxResults = 50;

      do {
        const params = new URLSearchParams({
          jql,
          startAt: String(startAt),
          maxResults: String(maxResults),
          fields:
            "summary,description,issuetype,status,priority,created,updated,assignee,reporter,labels,components,resolution,comment",
        });

        const res = await fetch(
          `${baseUrl}/rest/api/3/search?${params}`,
          { headers },
        );

        if (!res.ok) {
          throw new Error(
            `Jira API error: ${res.status} ${res.statusText}`,
          );
        }

        const data = (await res.json()) as JiraSearchResponse;

        for (const issue of data.issues) {
          const f = issue.fields;
          const description = this.extractText(f.description);
          const recentComments = f.comment?.comments
            .filter(
              (c) => new Date(c.created) >= sinceDate,
            )
            .map(
              (c) =>
                `${c.author.displayName}: ${this.extractText(c.body)}`,
            )
            .join("\n");

          const contentParts = [
            `[${f.issuetype.name}] ${f.summary}`,
            `Status: ${f.status.name} | Priority: ${f.priority.name}`,
            f.assignee
              ? `Assignee: ${f.assignee.displayName}`
              : null,
            f.resolution
              ? `Resolution: ${f.resolution.name}`
              : null,
            f.components?.length
              ? `Components: ${f.components.map((c) => c.name).join(", ")}`
              : null,
            f.labels.length
              ? `Labels: ${f.labels.join(", ")}`
              : null,
            description ? `\nDescription:\n${description}` : null,
            recentComments
              ? `\nRecent Comments:\n${recentComments}`
              : null,
          ].filter(Boolean);

          signals.push({
            externalId: `jira-${issue.key}`,
            title: `${issue.key}: ${f.summary}`,
            content: contentParts.join("\n"),
            author: f.reporter?.displayName,
            url: `${baseUrl}/browse/${issue.key}`,
            signalDate: new Date(f.updated),
          });
        }

        startAt += data.issues.length;
        if (startAt >= data.total) break;
      } while (true);

      return signals;
    } catch (error) {
      logError("adapter.fetch_failed", error, {
        adapter: "JiraAdapter",
        source: this.source,
        accountId,
      });
      throw error;
    }
  }

  private extractText(
    node: string | JiraDocNode | undefined | null,
  ): string {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (node.text) return node.text;
    if (node.content) {
      return node.content.map((n) => this.extractText(n)).join(" ");
    }
    return "";
  }

  private async generateMockSignals(
    accountId: string,
  ): Promise<RawSignalInput[]> {
    const mockIssues = [
      {
        title: "ACME-1234: Dashboard export fails for large datasets",
        content: `[Bug] Dashboard export fails for large datasets
Status: In Progress | Priority: High
Assignee: Elena Rodriguez
Labels: customer-reported, data-export
Components: Dashboard, Export Service

Description:
When users attempt to export dashboard data exceeding 10,000 rows, the export times out with a 504 error. Customer needs this for their monthly board report. The issue appears to be with the pagination cursor in the export service not properly handling offset-based pagination for aggregated queries.

Recent Comments:
Elena Rodriguez: Identified the root cause — the cursor implementation doesn't account for GROUP BY queries. Working on a fix that streams results instead of loading into memory. ETA: end of day tomorrow.
Support Team: Customer escalated — they need this by Friday for their board presentation.`,
        author: "Derek Yamamoto",
      },
      {
        title: "ACME-1567: Add support for custom fiscal year calendars",
        content: `[Feature Request] Add support for custom fiscal year calendars
Status: Backlog | Priority: Medium
Assignee: Unassigned
Labels: customer-request, reporting, fiscal-year
Components: Reporting, Settings

Description:
Customer's fiscal year runs Feb-Jan. All current reports and dashboards assume Jan-Dec calendar year. They need the ability to configure a custom fiscal year start month so that Q1 reports align with their internal reporting periods. This affects: quarterly roll-ups, YTD calculations, comparison views, and automated report scheduling.

Recent Comments:
Product Manager: Adding to Q2 roadmap. Multiple enterprise customers have requested this — affects 12 accounts. Scheduling design review for next sprint.`,
        author: "Lisa Wong",
      },
      {
        title: "ACME-2089: Critical: SSO login loop after IdP migration",
        content: `[Bug] Critical: SSO login loop after IdP migration
Status: Resolved | Priority: Critical
Assignee: Marcus Chen
Labels: sso, auth, customer-blocker
Components: Authentication

Description:
After migrating from Okta to Azure AD, users experience an infinite redirect loop when attempting SSO login. The SAML response contains a NameID format of 'emailAddress' but our system expects 'persistent'. Approximately 200 users are unable to access the platform.

Recent Comments:
Marcus Chen: Deployed hotfix to accept both NameID formats. Also added a configuration option in Admin Settings to specify expected NameID format. All users confirmed access restored.
QA: Verified fix in production. No regression in existing SSO integrations.`,
        author: "Laura Chen",
      },
      {
        title: "ACME-2201: Sprint 14 completed — 23 story points delivered",
        content: `[Story] Sprint 14 completed — 23 story points delivered
Status: Done | Priority: Medium
Labels: sprint-completion, customer-project
Components: Project Tracking

Description:
Sprint 14 deliverables for the account's custom project:
- Custom role-based access control for Ops managers (5 pts) ✅
- Bulk user import via CSV (3 pts) ✅
- Dashboard widget: team utilization heatmap (8 pts) ✅
- API endpoint for external data push (5 pts) ✅
- Bug fix: timezone handling in scheduled reports (2 pts) ✅

Velocity trending up from 19 to 23 story points. Sprint 15 planning complete — targeting 25 points with focus on data warehouse integration.`,
        author: "Scrum Master",
      },
    ];

    return mockIssues.map((issue, i) => ({
      externalId: `mock-jira-${accountId}-${i}`,
      title: issue.title,
      content: issue.content,
      author: issue.author,
      signalDate: randomDateWithinLast30Days(),
    }));
  }
}

function randomDateWithinLast30Days(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo));
}

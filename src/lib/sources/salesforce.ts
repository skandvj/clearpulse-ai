import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";

interface SalesforceTokenResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
}

interface SalesforceQueryResponse<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

interface SalesforceActivity {
  Id: string;
  Subject: string;
  Description?: string;
  ActivityDate?: string;
  CreatedDate: string;
  Status?: string;
  Priority?: string;
  Owner?: { Name: string };
  Who?: { Name: string };
}

interface SalesforceOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount?: number;
  CloseDate: string;
  LastModifiedDate: string;
  Owner?: { Name: string };
  Description?: string;
}

interface SalesforceCase {
  Id: string;
  Subject: string;
  Description?: string;
  Status: string;
  Priority: string;
  CreatedDate: string;
  CaseNumber: string;
  Owner?: { Name: string };
  Contact?: { Name: string };
}

const SF_API_VERSION = "v58.0";

export class SalesforceAdapter implements SourceAdapter {
  source = SignalSource.SALESFORCE;

  async fetchSignals(
    accountId: string,
    since?: Date,
  ): Promise<RawSignalInput[]> {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
    const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
    const username = process.env.SALESFORCE_USERNAME;
    const password = process.env.SALESFORCE_PASSWORD;

    if (!clientId || !clientSecret || !instanceUrl) {
      return this.generateMockSignals(accountId);
    }

    try {
      const account = await prisma.clientAccount.findUniqueOrThrow({
        where: { id: accountId },
      });

      if (!account.salesforceId) {
        console.warn(
          `[SalesforceAdapter] No Salesforce ID for ${account.name}`,
        );
        return [];
      }

      const auth = await this.authenticate(
        instanceUrl,
        clientId,
        clientSecret,
        username,
        password,
      );

      const sinceISO = (
        since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).toISOString();

      const signals: RawSignalInput[] = [];

      const activities = await this.query<SalesforceActivity>(
        auth,
        `SELECT Id, Subject, Description, ActivityDate, CreatedDate, Status, Priority, Owner.Name, Who.Name FROM Task WHERE AccountId = '${account.salesforceId}' AND CreatedDate >= ${sinceISO} ORDER BY CreatedDate DESC`,
      );

      for (const task of activities) {
        const parts = [task.Subject];
        if (task.Description) parts.push(task.Description);
        if (task.Status) parts.push(`Status: ${task.Status}`);
        if (task.Priority) parts.push(`Priority: ${task.Priority}`);
        if (task.Who?.Name) parts.push(`Contact: ${task.Who.Name}`);

        signals.push({
          externalId: `sf-task-${task.Id}`,
          title: `Activity: ${task.Subject}`,
          content: parts.join("\n"),
          author: task.Owner?.Name,
          url: `${auth.instance_url}/${task.Id}`,
          signalDate: new Date(task.ActivityDate || task.CreatedDate),
        });
      }

      const opps = await this.query<SalesforceOpportunity>(
        auth,
        `SELECT Id, Name, StageName, Amount, CloseDate, LastModifiedDate, Owner.Name, Description FROM Opportunity WHERE AccountId = '${account.salesforceId}' AND LastModifiedDate >= ${sinceISO} ORDER BY LastModifiedDate DESC`,
      );

      for (const opp of opps) {
        const parts = [
          `Opportunity: ${opp.Name}`,
          `Stage: ${opp.StageName}`,
          opp.Amount ? `Amount: $${opp.Amount.toLocaleString()}` : null,
          `Close Date: ${opp.CloseDate}`,
          opp.Description ? `\n${opp.Description}` : null,
        ].filter(Boolean);

        signals.push({
          externalId: `sf-opp-${opp.Id}`,
          title: `Opportunity Update: ${opp.Name} → ${opp.StageName}`,
          content: parts.join("\n"),
          author: opp.Owner?.Name,
          url: `${auth.instance_url}/${opp.Id}`,
          signalDate: new Date(opp.LastModifiedDate),
        });
      }

      const cases = await this.query<SalesforceCase>(
        auth,
        `SELECT Id, Subject, Description, Status, Priority, CreatedDate, CaseNumber, Owner.Name, Contact.Name FROM Case WHERE AccountId = '${account.salesforceId}' AND CreatedDate >= ${sinceISO} ORDER BY CreatedDate DESC`,
      );

      for (const cs of cases) {
        const parts = [
          `Case #${cs.CaseNumber}: ${cs.Subject}`,
          `Status: ${cs.Status} | Priority: ${cs.Priority}`,
          cs.Contact?.Name ? `Contact: ${cs.Contact.Name}` : null,
          cs.Description ? `\n${cs.Description}` : null,
        ].filter(Boolean);

        signals.push({
          externalId: `sf-case-${cs.Id}`,
          title: `Case: ${cs.Subject} [${cs.Priority}]`,
          content: parts.join("\n"),
          author: cs.Owner?.Name,
          url: `${auth.instance_url}/${cs.Id}`,
          signalDate: new Date(cs.CreatedDate),
        });
      }

      return signals;
    } catch (error) {
      console.error("[SalesforceAdapter] Error fetching signals:", error);
      throw error;
    }
  }

  private async authenticate(
    instanceUrl: string,
    clientId: string,
    clientSecret: string,
    username?: string,
    password?: string,
  ): Promise<SalesforceTokenResponse> {
    const body = new URLSearchParams({
      grant_type: username
        ? "password"
        : "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
    });

    const res = await fetch(
      `${instanceUrl}/services/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );

    if (!res.ok) {
      throw new Error(`Salesforce auth failed: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as SalesforceTokenResponse;
  }

  private async query<T>(
    auth: SalesforceTokenResponse,
    soql: string,
  ): Promise<T[]> {
    const allRecords: T[] = [];
    let url: string | undefined = `${auth.instance_url}/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`;

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
      });

      if (!res.ok) {
        throw new Error(`Salesforce query error: ${res.status}`);
      }

      const data = (await res.json()) as SalesforceQueryResponse<T>;
      allRecords.push(...data.records);
      url = data.nextRecordsUrl
        ? `${auth.instance_url}${data.nextRecordsUrl}`
        : undefined;
    }

    return allRecords;
  }

  private async generateMockSignals(
    accountId: string,
  ): Promise<RawSignalInput[]> {
    const mockSignals = [
      {
        title: "Opportunity Update: Enterprise Renewal → Negotiation",
        content: `Opportunity: Enterprise Platform Renewal FY26
Stage: Negotiation
Amount: $285,000
Close Date: 2026-04-30

Moved from Proposal to Negotiation. Customer's procurement team is reviewing the 3-year commitment option with 15% discount. Key blocker: they want to include the Advanced Analytics add-on at no extra cost. VP of Sales to join next call to discuss packaging.`,
        author: "Natalie Brooks",
      },
      {
        title: "Case: API Rate Limiting Errors [High]",
        content: `Case #00847291: API Rate Limiting Errors in Production
Status: Escalated | Priority: High
Contact: Derek Yamamoto

Customer's integration pipeline hitting 429 errors during peak hours (9-11am EST). Their ETL process pulls 50k+ records daily. Current rate limit of 100 req/min is insufficient for their use case. Engineering escalation in progress — evaluating dedicated rate limit tier for enterprise accounts.`,
        author: "Michelle Torres",
      },
      {
        title: "Activity: Executive Business Review Completed",
        content: `Completed executive business review with C-suite stakeholders.
Status: Completed
Priority: High
Contact: Gregory Phillips (CTO)

Presented platform ROI analysis showing $1.2M in operational savings over 12 months. CFO was impressed with the metrics but wants to see more detail on projected savings for Year 2. CTO committed to expanding integration scope — wants to connect their BI tool and CRM directly.`,
        author: "Brandon Clarke",
      },
      {
        title: "Case: Single Sign-On Configuration Issue [Medium]",
        content: `Case #00851034: SAML SSO Configuration Failing for New IdP
Status: In Progress | Priority: Medium
Contact: Laura Chen (IT Admin)

Customer migrating from Okta to Azure AD. SAML assertions are being rejected due to NameID format mismatch. Provided updated metadata XML and configuration guide. Scheduled a joint troubleshooting call with their IT team for Tuesday at 2pm.`,
        author: "Support Team",
      },
    ];

    return mockSignals.map((s, i) => ({
      externalId: `mock-salesforce-${accountId}-${i}`,
      title: s.title,
      content: s.content,
      author: s.author,
      signalDate: randomDateWithinLast30Days(),
    }));
  }
}

function randomDateWithinLast30Days(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo));
}

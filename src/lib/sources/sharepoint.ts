import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";
import { logError, logWarn } from "@/lib/logging";
import { resolveMockFallback } from "@/lib/sources/mock-fallback";

interface MicrosoftTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface SharePointDriveItem {
  id: string;
  name: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy?: { user?: { displayName?: string; email?: string } };
  lastModifiedBy?: { user?: { displayName?: string; email?: string } };
  file?: { mimeType: string };
  folder?: { childCount: number };
  size?: number;
  "@microsoft.graph.downloadUrl"?: string;
}

interface SharePointListResponse {
  value: SharePointDriveItem[];
  "@odata.nextLink"?: string;
}

interface SharePointSite {
  id: string;
  name: string;
  webUrl: string;
}

interface SharePointSiteSearchResponse {
  value: SharePointSite[];
}

const GRAPH_API = "https://graph.microsoft.com/v1.0";

export class SharePointAdapter implements SourceAdapter {
  source = SignalSource.SHAREPOINT;

  async fetchSignals(
    accountId: string,
    since?: Date,
  ): Promise<RawSignalInput[]> {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID;
    const siteId = process.env.SHAREPOINT_SITE_ID;

    const mockSignals = await resolveMockFallback({
      source: this.source,
      accountId,
      requiredEnv: [
        "MICROSOFT_CLIENT_ID",
        "MICROSOFT_CLIENT_SECRET",
        "MICROSOFT_TENANT_ID",
      ],
      createMockSignals: () => this.generateMockSignals(accountId),
    });
    if (mockSignals) return mockSignals;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        "SharePoint adapter is missing Microsoft credentials after fallback resolution.",
      );
    }

    try {
      const account = await prisma.clientAccount.findUniqueOrThrow({
        where: { id: accountId },
      });

      const accessToken = await this.getAccessToken(
        tenantId,
        clientId,
        clientSecret,
      );

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };

      const sinceDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const signals: RawSignalInput[] = [];

      const resolvedSiteId =
        siteId || (await this.findSiteByName(headers, account.name));
      if (!resolvedSiteId) {
        logWarn("adapter.sharepoint.site_not_found", {
          accountId,
          accountName: account.name,
        });
        return [];
      }

      const accountFolder = account.name.replace(/\s+/g, "-");
      const items = await this.listDriveItems(
        headers,
        resolvedSiteId,
        accountFolder,
      );

      for (const item of items) {
        if (item.folder) continue;
        if (new Date(item.lastModifiedDateTime) < sinceDate) continue;

        let content = `Document: ${item.name}`;
        if (item.file?.mimeType) {
          content += `\nType: ${item.file.mimeType}`;
        }
        if (item.size) {
          content += `\nSize: ${(item.size / 1024).toFixed(1)} KB`;
        }
        content += `\nLast modified: ${item.lastModifiedDateTime}`;

        if (
          item.file?.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          item.file?.mimeType === "text/plain"
        ) {
          const preview = await this.getDocumentPreview(
            headers,
            resolvedSiteId,
            item.id,
          );
          if (preview) {
            content += `\n\nContent Preview:\n${preview}`;
          }
        }

        signals.push({
          externalId: `sharepoint-${item.id}`,
          title: item.name,
          content,
          author:
            item.lastModifiedBy?.user?.displayName ||
            item.createdBy?.user?.displayName,
          url: item.webUrl,
          signalDate: new Date(item.lastModifiedDateTime),
        });
      }

      return signals;
    } catch (error) {
      logError("adapter.fetch_failed", error, {
        adapter: "SharePointAdapter",
        source: this.source,
        accountId,
      });
      throw error;
    }
  }

  private async getAccessToken(
    tenantId: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      },
    );

    if (!res.ok) {
      throw new Error(
        `Microsoft auth failed: ${res.status} ${res.statusText}`,
      );
    }

    const data = (await res.json()) as MicrosoftTokenResponse;
    return data.access_token;
  }

  private async findSiteByName(
    headers: Record<string, string>,
    accountName: string,
  ): Promise<string | null> {
    const res = await fetch(
      `${GRAPH_API}/sites?search=${encodeURIComponent(accountName)}`,
      { headers },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as SharePointSiteSearchResponse;
    return data.value[0]?.id ?? null;
  }

  private async listDriveItems(
    headers: Record<string, string>,
    siteId: string,
    folderPath: string,
  ): Promise<SharePointDriveItem[]> {
    const allItems: SharePointDriveItem[] = [];
    let url: string | undefined = `${GRAPH_API}/sites/${siteId}/drive/root:/${encodeURIComponent(folderPath)}:/children?$top=100`;

    while (url) {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 404) {
          url = `${GRAPH_API}/sites/${siteId}/drive/root/children?$top=100`;
          const fallbackRes = await fetch(url, { headers });
          if (!fallbackRes.ok) break;
          const fallbackData = (await fallbackRes.json()) as SharePointListResponse;
          allItems.push(...fallbackData.value);
          break;
        }
        throw new Error(`SharePoint API error: ${res.status}`);
      }
      const data = (await res.json()) as SharePointListResponse;
      allItems.push(...data.value);
      url = data["@odata.nextLink"] || undefined;
    }

    return allItems;
  }

  private async getDocumentPreview(
    headers: Record<string, string>,
    siteId: string,
    itemId: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(
        `${GRAPH_API}/sites/${siteId}/drive/items/${itemId}/content`,
        { headers },
      );
      if (!res.ok) return null;
      const text = await res.text();
      return text.length > 2000 ? text.slice(0, 2000) + "\n[content truncated]" : text;
    } catch {
      return null;
    }
  }

  private async generateMockSignals(
    accountId: string,
  ): Promise<RawSignalInput[]> {
    const mockDocuments = [
      {
        title: "Q1 2026 QBR Deck - Final.pptx",
        content: `Document: Q1 2026 QBR Deck - Final.pptx
Type: application/vnd.openxmlformats-officedocument.presentationml.presentation
Size: 4.2 MB

Content Preview:
Quarterly Business Review - Q1 2026
Key Metrics:
- Platform uptime: 99.97% (target: 99.9%)
- Active users: 340/400 seats (85% utilization)
- Support tickets: 23 (down 30% QoQ)
- Feature adoption: Analytics module at 62%, Automation at 78%

Recommendations:
1. Expand Analytics module training to underutilizing teams
2. Begin scoping Phase 2 integration with their data warehouse
3. Schedule exec sponsor dinner before renewal negotiation`,
        author: "Wendy Okafor",
      },
      {
        title: "Implementation Runbook - Phase 2.docx",
        content: `Document: Implementation Runbook - Phase 2.docx
Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Size: 892 KB

Content Preview:
Phase 2 Implementation Runbook

Timeline: April 1 - June 30, 2026

Workstreams:
1. Data Warehouse Integration (Weeks 1-4)
   - Connect Snowflake instance via REST API
   - Configure bidirectional sync for 12 key tables
   - UAT with data engineering team

2. Operations Team Onboarding (Weeks 3-6)
   - 150 new users across 3 departments
   - Custom role configuration for Ops managers
   - Training schedule: 4 cohorts of ~38 users

3. Custom Dashboard Build (Weeks 5-8)
   - Executive dashboard with real-time KPIs
   - Operations efficiency scorecard
   - Customer health aggregate view`,
        author: "Implementation Team",
      },
      {
        title: "Success Plan - H1 2026.xlsx",
        content: `Document: Success Plan - H1 2026.xlsx
Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Size: 156 KB

Content Preview:
Success Plan Summary - H1 2026

Goals:
1. Achieve 95% seat utilization (current: 85%) — Target: May 2026
2. Complete Phase 2 implementation — Target: June 2026
3. Secure 3-year renewal commitment — Target: April 2026
4. Launch self-service portal for end users — Target: March 2026

Risks:
- Champion departure risk: VP of Ops (primary sponsor) exploring external roles
- Budget pressure: Finance team questioning ROI on Advanced Analytics add-on
- Technical debt: Legacy integration causing intermittent data sync failures`,
        author: "CSM Team",
      },
    ];

    return mockDocuments.map((doc, i) => ({
      externalId: `mock-sharepoint-${accountId}-${i}`,
      title: doc.title,
      content: doc.content,
      author: doc.author,
      signalDate: randomDateWithinLast30Days(),
    }));
  }
}

function randomDateWithinLast30Days(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo));
}

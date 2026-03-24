import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime: string;
  modifiedTime: string;
  owners?: { displayName: string; emailAddress: string }[];
  lastModifyingUser?: { displayName: string; emailAddress: string };
  size?: string;
  parents?: string[];
}

interface GoogleDriveListResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export class GDriveAdapter implements SourceAdapter {
  source = SignalSource.GOOGLE_DRIVE;

  async fetchSignals(
    accountId: string,
    since?: Date,
  ): Promise<RawSignalInput[]> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const rootFolderId = process.env.GDRIVE_CUSTOMERS_FOLDER_ID;

    if (!clientId || !clientSecret || !refreshToken) {
      return this.generateMockSignals(accountId);
    }

    try {
      const account = await prisma.clientAccount.findUniqueOrThrow({
        where: { id: accountId },
      });

      const accessToken = await this.getAccessToken(
        clientId,
        clientSecret,
        refreshToken,
      );

      const headers = { Authorization: `Bearer ${accessToken}` };
      const sinceDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const accountFolderId = await this.findAccountFolder(
        headers,
        account.name,
        rootFolderId,
      );

      if (!accountFolderId) {
        console.warn(
          `[GDriveAdapter] No Google Drive folder found for ${account.name}`,
        );
        return [];
      }

      const files = await this.listFiles(
        headers,
        accountFolderId,
        sinceDate,
      );

      const signals: RawSignalInput[] = [];

      for (const file of files) {
        let content = `Document: ${file.name}\nType: ${file.mimeType}`;

        if (
          file.mimeType === "application/vnd.google-apps.document"
        ) {
          const text = await this.exportGoogleDoc(
            headers,
            file.id,
          );
          if (text) {
            content += `\n\n${text}`;
          }
        } else if (
          file.mimeType === "application/vnd.google-apps.spreadsheet"
        ) {
          content += "\n[Spreadsheet — content available via Sheets API]";
        } else if (
          file.mimeType === "application/vnd.google-apps.presentation"
        ) {
          content += "\n[Presentation — content available via Slides API]";
        }

        const author =
          file.lastModifyingUser?.displayName ||
          file.owners?.[0]?.displayName;

        signals.push({
          externalId: `gdrive-${file.id}`,
          title: file.name,
          content,
          author,
          url: file.webViewLink,
          signalDate: new Date(file.modifiedTime),
        });
      }

      return signals;
    } catch (error) {
      console.error("[GDriveAdapter] Error fetching signals:", error);
      throw error;
    }
  }

  private async getAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<string> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to refresh Google token: ${res.status}`);
    }

    const data = (await res.json()) as GoogleTokenResponse;
    return data.access_token;
  }

  private async findAccountFolder(
    headers: Record<string, string>,
    accountName: string,
    parentFolderId?: string,
  ): Promise<string | null> {
    const nameQuery = `name = '${accountName.replace(/'/g, "\\'")}'`;
    const folderQuery = "mimeType = 'application/vnd.google-apps.folder'";
    const parentQuery = parentFolderId
      ? `'${parentFolderId}' in parents`
      : "";
    const query = [nameQuery, folderQuery, parentQuery]
      .filter(Boolean)
      .join(" and ");

    const params = new URLSearchParams({
      q: query,
      fields: "files(id,name)",
      pageSize: "10",
    });

    const res = await fetch(`${DRIVE_API}/files?${params}`, { headers });
    if (!res.ok) return null;

    const data = (await res.json()) as GoogleDriveListResponse;
    return data.files[0]?.id ?? null;
  }

  private async listFiles(
    headers: Record<string, string>,
    folderId: string,
    since: Date,
  ): Promise<GoogleDriveFile[]> {
    const allFiles: GoogleDriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const query = `'${folderId}' in parents and trashed = false and modifiedTime >= '${since.toISOString()}'`;
      const params = new URLSearchParams({
        q: query,
        fields:
          "nextPageToken,files(id,name,mimeType,webViewLink,createdTime,modifiedTime,owners,lastModifyingUser,size)",
        pageSize: "100",
        orderBy: "modifiedTime desc",
        ...(pageToken ? { pageToken } : {}),
      });

      const res = await fetch(`${DRIVE_API}/files?${params}`, { headers });
      if (!res.ok) {
        throw new Error(`Google Drive API error: ${res.status}`);
      }

      const data = (await res.json()) as GoogleDriveListResponse;
      allFiles.push(...data.files);
      pageToken = data.nextPageToken;
    } while (pageToken);

    return allFiles;
  }

  private async exportGoogleDoc(
    headers: Record<string, string>,
    fileId: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(
        `${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
        { headers },
      );
      if (!res.ok) return null;
      const text = await res.text();
      return text.length > 3000
        ? text.slice(0, 3000) + "\n[document truncated]"
        : text;
    } catch {
      return null;
    }
  }

  private async generateMockSignals(
    accountId: string,
  ): Promise<RawSignalInput[]> {
    const mockFiles = [
      {
        title: "Account Health Notes - March 2026",
        content: `Document: Account Health Notes - March 2026
Type: Google Doc

Weekly Health Check — Week of March 16, 2026

Overall Health: GREEN (trending up from YELLOW)

Key Updates:
- Resolved the API latency issues that were causing concern in February. P95 latency now at 180ms (target: 200ms).
- New department onboarding progressing ahead of schedule — 95 of 120 new seats activated in first two weeks.
- Champion (Sarah) confirmed verbal commitment for 3-year renewal. Formal proposal to go through procurement next week.

Watch Items:
- Their CTO mentioned evaluating a competitor for a different use case. Not directly competitive but worth monitoring.
- Support ticket volume spiked briefly around the new feature launch — mostly training-related. Resolved with targeted enablement sessions.

Next Steps:
- Prepare renewal proposal with multi-year discount tiers
- Schedule exec-to-exec dinner for April
- Begin scoping Phase 3 (predictive analytics module)`,
        author: "Wendy",
      },
      {
        title: "QBR Prep Doc - Q1 2026",
        content: `Document: QBR Prep Doc - Q1 2026
Type: Google Doc

Quarterly Business Review Preparation

Agenda:
1. Q1 Performance Review (15 min)
   - Platform adoption: 85% → 92% seat utilization
   - Key metrics: 35% ticket deflection, 28% workflow automation savings
   - Customer health score: 82/100

2. Roadmap Preview (10 min)
   - Advanced Analytics module: GA in April
   - Mobile app v2: Beta available now
   - API v3: Breaking changes planned for Q3

3. Expansion Discussion (15 min)
   - APAC region expansion (200 seats)
   - Operations team onboarding (150 seats)
   - Enterprise Security add-on

4. Open Discussion (20 min)
   - Custom fiscal year support request
   - Data warehouse integration timeline
   - Executive sponsor engagement

Attendees (Customer):
- Patricia Nguyen, COO
- Robert Chen, Head of Product
- Sarah Thompson, VP Customer Success
- David Kim, Engineering Manager`,
        author: "Wendy",
      },
      {
        title: "Success Plan Updates - H1 2026",
        content: `Document: Success Plan Updates - H1 2026
Type: Google Doc

Success Plan Progress Tracker

Goal 1: Achieve 95% seat utilization
- Current: 92% (was 85% at start of quarter)
- Status: ON TRACK
- Actions: Launched "power user" ambassador program, 8 ambassadors activated across 4 departments

Goal 2: Complete Phase 2 implementation
- Current: 60% complete
- Status: ON TRACK
- Key milestone: Data warehouse integration in UAT, Ops team training begins next week

Goal 3: Secure 3-year renewal
- Current: Verbal commitment received
- Status: ON TRACK
- Next step: Formal proposal in procurement review

Goal 4: Launch self-service portal
- Current: Portal live, 45% of support requests now self-served
- Status: ACHIEVED
- Impact: 30% reduction in support ticket volume since launch

New Risk Identified:
VP of Operations (key sponsor) has updated LinkedIn status to "Open to Work." Need contingency plan for sponsor continuity. Scheduling meeting with COO to ensure executive coverage.`,
        author: "Wendy",
      },
    ];

    return mockFiles.map((file, i) => ({
      externalId: `mock-gdrive-${accountId}-${i}`,
      title: file.title,
      content: file.content,
      author: file.author,
      signalDate: randomDateWithinLast30Days(),
    }));
  }
}

function randomDateWithinLast30Days(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo));
}

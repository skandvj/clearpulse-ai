import { SignalSource } from "@prisma/client";
import { SourceAdapter, RawSignalInput } from "@/lib/ingestion/types";
import { prisma } from "@/lib/db";
import { logError, logWarn } from "@/lib/logging";
import { resolveMockFallback } from "@/lib/sources/mock-fallback";

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  username?: string;
  thread_ts?: string;
  reply_count?: number;
}

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackConversationsHistoryResponse {
  ok: boolean;
  messages: SlackMessage[];
  has_more: boolean;
  response_metadata?: { next_cursor?: string };
  error?: string;
}

interface SlackSearchResponse {
  ok: boolean;
  messages: {
    matches: SlackMessage[];
    paging: { pages: number; page: number };
  };
  error?: string;
}

interface SlackChannelsResponse {
  ok: boolean;
  channels: SlackChannel[];
  response_metadata?: { next_cursor?: string };
  error?: string;
}

interface SlackUserResponse {
  ok: boolean;
  user?: { real_name?: string; name?: string };
}

const SLACK_API = "https://slack.com/api";

export class SlackAdapter implements SourceAdapter {
  source = SignalSource.SLACK;

  async fetchSignals(
    accountId: string,
    since?: Date,
  ): Promise<RawSignalInput[]> {
    const mockSignals = await resolveMockFallback({
      source: this.source,
      accountId,
      requiredEnv: ["SLACK_BOT_TOKEN"],
      createMockSignals: () => this.generateMockSignals(accountId),
    });
    if (mockSignals) return mockSignals;

    const token = process.env.SLACK_BOT_TOKEN!;

    try {
      const account = await prisma.clientAccount.findUniqueOrThrow({
        where: { id: accountId },
      });
      const accountName = account.name.toLowerCase().replace(/\s+/g, "-");
      const oldest = since
        ? String(since.getTime() / 1000)
        : String((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

      const signals: RawSignalInput[] = [];

      const channelId = await this.findAccountChannel(token, accountName);
      if (channelId) {
        const history = await this.fetchChannelHistory(
          token,
          channelId,
          oldest,
        );
        for (const msg of history) {
          const author = await this.resolveUser(token, msg.user);
          signals.push({
            externalId: `slack-${channelId}-${msg.ts}`,
            title: msg.thread_ts
              ? `Thread in #${accountName}`
              : `Message in #${accountName}`,
            content: this.stripMentions(msg.text),
            author,
            url: `https://slack.com/archives/${channelId}/p${msg.ts.replace(".", "")}`,
            signalDate: new Date(parseFloat(msg.ts) * 1000),
          });
        }
      }

      if (account.domain) {
        const searchResults = await this.searchMessages(
          token,
          account.domain,
          oldest,
        );
        for (const msg of searchResults) {
          if (
            signals.some(
              (s) => s.externalId === `slack-search-${msg.ts}`,
            )
          )
            continue;
          signals.push({
            externalId: `slack-search-${msg.ts}`,
            title: `Mention of ${account.domain}`,
            content: this.stripMentions(msg.text),
            author: msg.username,
            signalDate: new Date(parseFloat(msg.ts) * 1000),
          });
        }
      }

      return signals;
    } catch (error) {
      logError("adapter.fetch_failed", error, {
        adapter: "SlackAdapter",
        source: this.source,
        accountId,
      });
      throw error;
    }
  }

  private async findAccountChannel(
    token: string,
    accountName: string,
  ): Promise<string | null> {
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({
        types: "public_channel,private_channel",
        limit: "200",
        ...(cursor ? { cursor } : {}),
      });
      const res = await fetch(`${SLACK_API}/conversations.list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as SlackChannelsResponse;
      if (!data.ok) break;
      const match = data.channels.find(
        (c) =>
          c.name === accountName ||
          c.name === `cs-${accountName}` ||
          c.name === `customer-${accountName}`,
      );
      if (match) return match.id;
      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor);
    return null;
  }

  private async fetchChannelHistory(
    token: string,
    channelId: string,
    oldest: string,
  ): Promise<SlackMessage[]> {
    const messages: SlackMessage[] = [];
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({
        channel: channelId,
        oldest,
        limit: "100",
        ...(cursor ? { cursor } : {}),
      });
      const res = await fetch(
        `${SLACK_API}/conversations.history?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await res.json()) as SlackConversationsHistoryResponse;
      if (!data.ok) {
        logWarn("adapter.slack.history_error", {
          channelId,
          error: data.error,
        });
        break;
      }
      messages.push(...data.messages);
      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor);
    return messages;
  }

  private async searchMessages(
    token: string,
    domain: string,
    oldest: string,
  ): Promise<SlackMessage[]> {
    const allMatches: SlackMessage[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const params = new URLSearchParams({
        query: domain,
        sort: "timestamp",
        count: "100",
        page: String(page),
      });
      const res = await fetch(`${SLACK_API}/search.messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as SlackSearchResponse;
      if (!data.ok) break;
      const filtered = data.messages.matches.filter(
        (m) => parseFloat(m.ts) >= parseFloat(oldest),
      );
      allMatches.push(...filtered);
      totalPages = data.messages.paging.pages;
      page++;
    } while (page <= totalPages);
    return allMatches;
  }

  private async resolveUser(
    token: string,
    userId?: string,
  ): Promise<string | undefined> {
    if (!userId) return undefined;
    try {
      const res = await fetch(
        `${SLACK_API}/users.info?user=${userId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await res.json()) as SlackUserResponse;
      return data.user?.real_name || data.user?.name || userId;
    } catch {
      return userId;
    }
  }

  private stripMentions(text: string): string {
    return text.replace(/<@[A-Z0-9]+>/g, "").trim();
  }

  private async generateMockSignals(
    accountId: string,
  ): Promise<RawSignalInput[]> {
    const mockMessages = [
      {
        title: "Account Health Discussion",
        content:
          "Team discussed current health metrics for the account. Product usage is trending upward but support ticket volume has increased 20% this quarter. CSM flagged potential risk around upcoming renewal — need to schedule exec alignment call before end of month.",
        author: "Sarah Chen",
      },
      {
        title: "Feature Request Escalation",
        content:
          "Customer's VP of Operations mentioned they urgently need the bulk import feature. This was supposed to ship in Q3 but slipped. They're evaluating a competitor tool that has this capability. Flagging as high-priority churn risk signal.",
        author: "Marcus Rivera",
      },
      {
        title: "Onboarding Progress Update",
        content:
          "New department rollout is going well. 85 of 120 seats are now active. The training sessions received positive feedback. Main blocker is SSO integration — IT team needs our documentation. Shared the setup guide in the channel.",
        author: "Alex Johnson",
      },
      {
        title: "Support Ticket Thread",
        content:
          "Critical bug reported: dashboard export failing for datasets > 10k rows. Customer has a board presentation Friday and needs this resolved. Engineering confirmed it's a known issue with the pagination cursor — hotfix planned for tomorrow.",
        author: "David Park",
      },
      {
        title: "Quarterly Review Prep",
        content:
          "Compiling the usage metrics for next week's QBR. Key highlights: 40% increase in API calls, 3 new departments onboarded, NPS improved from 7.2 to 8.1. Areas to address: slow adoption of new analytics module, pending security questionnaire.",
        author: "Rachel Kim",
      },
      {
        title: "Expansion Opportunity",
        content:
          "Account champion mentioned their EU team is interested in piloting our platform. Could be 200+ additional seats. They want a demo focused on data residency and GDPR compliance features. Looping in solutions engineering.",
        author: "James Wright",
      },
    ];

    return mockMessages.map((msg, i) => ({
      externalId: `mock-slack-${accountId}-${i}`,
      title: msg.title,
      content: msg.content,
      author: msg.author,
      signalDate: randomDateWithinLast30Days(),
    }));
  }
}

function randomDateWithinLast30Days(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  return new Date(thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo));
}

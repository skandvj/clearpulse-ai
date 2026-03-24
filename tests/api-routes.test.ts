import test from "node:test";
import assert from "node:assert/strict";
import { SignalSource } from "@prisma/client";
import { createSyncPostHandler } from "@/lib/api/sync-post";
import { createAccountScorePostHandler } from "@/lib/api/account-score-post";
import { createAccountExtractPostHandler } from "@/lib/api/account-extract-post";
import { createAccountReportGeneratePostHandler } from "@/lib/api/account-report-generate-post";
import type { RateLimitResult } from "@/lib/rate-limit";

const DEFAULT_USER = {
  id: "user-1",
  email: "admin@clearpulse.dev",
  name: "Admin User",
  role: "ADMIN",
};

function makeRequest(body?: unknown) {
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function allowedRateLimit(limit = 10): RateLimitResult {
  return {
    allowed: true,
    key: "rate-limit:test",
    limit,
    remaining: limit - 1,
    retryAfter: 0,
    resetAt: "2026-03-24T22:00:00.000Z",
    driver: "memory",
  };
}

function blockedRateLimit(limit = 10): RateLimitResult {
  return {
    allowed: false,
    key: "rate-limit:test",
    limit,
    remaining: 0,
    retryAfter: 42,
    resetAt: "2026-03-24T22:00:00.000Z",
    driver: "memory",
  };
}

function createSyncDeps(overrides: Record<string, unknown> = {}) {
  return {
    requirePermission: async () => DEFAULT_USER,
    requireAccountAccess: async () => DEFAULT_USER,
    getAccountById: async (accountId: string) => ({
      id: accountId,
      name: "Acme Corp",
      csmId: DEFAULT_USER.id,
    }),
    listAccountsForUser: async () => [{ id: "acct-1", name: "Acme Corp" }],
    enqueueIngestion: async () => ({
      mode: "queued" as const,
      jobs: [
        {
          source: SignalSource.SLACK,
          accountId: "acct-1",
          syncJobId: "sync-1",
          queueJobId: "job-1",
        },
      ],
    }),
    enqueueBulkSync: async () => ({
      mode: "inline" as const,
      results: [],
    }),
    checkRateLimit: async () => allowedRateLimit(20),
    ...overrides,
  };
}

function createScoreDeps(overrides: Record<string, unknown> = {}) {
  return {
    requirePermission: async () => DEFAULT_USER,
    requireAccountAccess: async () => DEFAULT_USER,
    getAccountById: async () => ({ csmId: DEFAULT_USER.id }),
    checkRateLimit: async () => allowedRateLimit(30),
    runAccountHealthScoring: async () => ({
      kpisScored: 3,
      accountHealthScore: 82,
      accountHealthStatus: "HEALTHY",
      scoredAt: "2026-03-24T21:00:00.000Z",
    }),
    logError: () => {},
    ...overrides,
  };
}

function createExtractDeps(overrides: Record<string, unknown> = {}) {
  return {
    requirePermission: async () => DEFAULT_USER,
    requireAccountAccess: async () => DEFAULT_USER,
    getAccountById: async () => ({ csmId: DEFAULT_USER.id }),
    checkRateLimit: async () => allowedRateLimit(15),
    runKpiExtraction: async () => ({
      kpisCreated: 2,
      kpisUpdated: 1,
      evidenceRows: 4,
      signalsMarkedProcessed: 3,
      meetingsMarkedExtracted: 1,
      chunksProcessed: 1,
    }),
    runAccountHealthScoring: async () => ({
      kpisScored: 3,
      accountHealthScore: 70,
      accountHealthStatus: "HEALTHY",
      scoredAt: "2026-03-24T21:00:00.000Z",
    }),
    logError: () => {},
    ...overrides,
  };
}

function createReportDeps(overrides: Record<string, unknown> = {}) {
  return {
    requirePermission: async () => DEFAULT_USER,
    requireAccountAccess: async () => DEFAULT_USER,
    getAccountById: async (accountId: string) => ({
      id: accountId,
      name: "Acme Corp",
      csmId: DEFAULT_USER.id,
    }),
    checkRateLimit: async () => allowedRateLimit(10),
    loadAccountReportData: async () => ({
      kpis: [
        {
          healthScore: 80,
          healthNarrative: "Healthy adoption with strong usage trends.",
        },
      ],
      accountName: "Acme Corp",
    }),
    runAccountHealthScoring: async () => ({}),
    getLatestSnapshotVersion: async () => 2,
    renderAccountReportToBuffer: async () => Buffer.from("pdf-data"),
    uploadReportPdfToSupabase: async () => ({
      signedUrl: "https://signed.example/report.pdf",
      objectUrl: "https://storage.example/report.pdf",
      path: "account-reports/acct-1/report.pdf",
    }),
    createReportSnapshot: async () => ({ id: "snapshot-1" }),
    createAuditLog: async () => {},
    ...overrides,
  };
}

test("sync route returns 401 when permission check fails", async () => {
  const handler = createSyncPostHandler(
    createSyncDeps({
      requirePermission: async () => {
        throw new Error("Unauthorized");
      },
    })
  );

  const response = await handler(
    makeRequest({ accountId: "acct-1", source: "SLACK" })
  );

  assert.equal(response.status, 401);
});

test("sync route returns 403 when account access is forbidden", async () => {
  const handler = createSyncPostHandler(
    createSyncDeps({
      requireAccountAccess: async () => {
        throw new Error("Forbidden: no access to this account");
      },
    })
  );

  const response = await handler(
    makeRequest({ accountId: "acct-1", source: "SLACK" })
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, "Forbidden: no access to this account");
});

test("sync route returns 429 and skips enqueue work when rate limited", async () => {
  let enqueueCalled = false;
  const handler = createSyncPostHandler(
    createSyncDeps({
      checkRateLimit: async () => blockedRateLimit(20),
      enqueueIngestion: async () => {
        enqueueCalled = true;
        return {
          mode: "queued" as const,
          jobs: [],
        };
      },
    })
  );

  const response = await handler(
    makeRequest({ accountId: "acct-1", source: "SLACK" })
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "42");
  assert.equal(enqueueCalled, false);
});

test("sync route success includes dispatch payload and rate limit headers", async () => {
  const handler = createSyncPostHandler(createSyncDeps());

  const response = await handler(
    makeRequest({ accountId: "acct-1", source: "SLACK" })
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-RateLimit-Limit"), "20");
  assert.equal(body.target, "account");
  assert.equal(body.mode, "queued");
  assert.equal(body.account.name, "Acme Corp");
});

test("score route returns 401 when permission check fails", async () => {
  const handler = createAccountScorePostHandler(
    createScoreDeps({
      requirePermission: async () => {
        throw new Error("Unauthorized");
      },
    })
  );

  const response = await handler(makeRequest(), { params: { id: "acct-1" } });

  assert.equal(response.status, 401);
});

test("score route returns 403 when account access is forbidden", async () => {
  const handler = createAccountScorePostHandler(
    createScoreDeps({
      requireAccountAccess: async () => {
        throw new Error("Forbidden: no access to this account");
      },
    })
  );

  const response = await handler(makeRequest(), { params: { id: "acct-1" } });

  assert.equal(response.status, 403);
});

test("score route returns 429 and avoids scoring work when rate limited", async () => {
  let scoringCalled = false;
  const handler = createAccountScorePostHandler(
    createScoreDeps({
      checkRateLimit: async () => blockedRateLimit(30),
      runAccountHealthScoring: async () => {
        scoringCalled = true;
        return {};
      },
    })
  );

  const response = await handler(makeRequest(), { params: { id: "acct-1" } });

  assert.equal(response.status, 429);
  assert.equal(scoringCalled, false);
});

test("extract route returns 401 when permission check fails", async () => {
  const handler = createAccountExtractPostHandler(
    createExtractDeps({
      requirePermission: async () => {
        throw new Error("Unauthorized");
      },
    })
  );

  const response = await handler(makeRequest(), { params: { id: "acct-1" } });

  assert.equal(response.status, 401);
});

test("extract route returns 403 when account access is forbidden", async () => {
  const handler = createAccountExtractPostHandler(
    createExtractDeps({
      requireAccountAccess: async () => {
        throw new Error("Forbidden: no access to this account");
      },
    })
  );

  const response = await handler(makeRequest(), { params: { id: "acct-1" } });

  assert.equal(response.status, 403);
});

test("extract route returns 429 before extraction work runs", async () => {
  let extractionCalled = false;
  const handler = createAccountExtractPostHandler(
    createExtractDeps({
      checkRateLimit: async () => blockedRateLimit(15),
      runKpiExtraction: async () => {
        extractionCalled = true;
        return {};
      },
    })
  );

  const response = await handler(makeRequest(), { params: { id: "acct-1" } });

  assert.equal(response.status, 429);
  assert.equal(extractionCalled, false);
});

test("report generation route returns 401 when permission check fails", async () => {
  const handler = createAccountReportGeneratePostHandler(
    createReportDeps({
      requirePermission: async () => {
        throw new Error("Unauthorized");
      },
    })
  );

  const response = await handler(makeRequest(), { params: { id: "acct-1" } });

  assert.equal(response.status, 401);
});

test("report generation route returns 403 when account access is forbidden", async () => {
  const handler = createAccountReportGeneratePostHandler(
    createReportDeps({
      requireAccountAccess: async () => {
        throw new Error("Forbidden: no access to this account");
      },
    })
  );

  const response = await handler(makeRequest(), { params: { id: "acct-1" } });

  assert.equal(response.status, 403);
});

test("report generation route returns 429 before report work runs", async () => {
  let reportLoaded = false;
  const handler = createAccountReportGeneratePostHandler(
    createReportDeps({
      checkRateLimit: async () => blockedRateLimit(10),
      loadAccountReportData: async () => {
        reportLoaded = true;
        return null;
      },
    })
  );

  const response = await handler(makeRequest(), { params: { id: "acct-1" } });

  assert.equal(response.status, 429);
  assert.equal(reportLoaded, false);
});

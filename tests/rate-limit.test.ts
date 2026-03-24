import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyRateLimitHeaders,
  buildRateLimitKey,
  checkRateLimit,
  rateLimitExceededResponse,
  resetInMemoryRateLimitState,
} from "@/lib/rate-limit";

const ORIGINAL_ENV = {
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/test", { headers });
}

afterEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_ENV.UPSTASH_REDIS_REST_URL;
  process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_ENV.UPSTASH_REDIS_REST_TOKEN;
  resetInMemoryRateLimitState();
});

test("buildRateLimitKey prefers user identity over network headers", () => {
  const key = buildRateLimitKey({
    request: makeRequest({ "x-forwarded-for": "203.0.113.10" }),
    scope: "sync",
    userId: "user-123",
    resource: "account-1",
  });

  assert.equal(key, "rate-limit:sync:user:user-123:account-1");
});

test("buildRateLimitKey falls back to forwarded IPs for anonymous requests", () => {
  const key = buildRateLimitKey({
    request: makeRequest({ "x-forwarded-for": "198.51.100.5, 10.0.0.1" }),
    scope: "integration-test",
  });

  assert.equal(key, "rate-limit:integration-test:ip:198.51.100.5");
});

test("checkRateLimit uses in-memory fallback and blocks once the window is exceeded", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  const policy = {
    key: "rate-limit:test:blocking",
    limit: 2,
    windowSeconds: 60,
  };

  const first = await checkRateLimit(policy);
  const second = await checkRateLimit(policy);
  const third = await checkRateLimit(policy);

  assert.equal(first.allowed, true);
  assert.equal(first.driver, "memory");
  assert.equal(first.remaining, 1);

  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
  assert.equal(third.retryAfter > 0, true);
});

test("checkRateLimit resets after the window passes", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  const policy = {
    key: "rate-limit:test:reset",
    limit: 1,
    windowSeconds: 30,
  };

  const originalNow = Date.now;
  try {
    Date.now = () => 1_000_000;
    const first = await checkRateLimit(policy);
    const blocked = await checkRateLimit(policy);

    Date.now = () => 1_000_000 + 31_000;
    const reset = await checkRateLimit(policy);

    assert.equal(first.allowed, true);
    assert.equal(blocked.allowed, false);
    assert.equal(reset.allowed, true);
    assert.equal(reset.remaining, 0);
  } finally {
    Date.now = originalNow;
  }
});

test("checkRateLimit falls back to memory if Upstash REST is configured but fails", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";

  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response("upstream unavailable", {
      status: 503,
      statusText: "Service Unavailable",
    });

  try {
    const result = await checkRateLimit({
      key: "rate-limit:test:upstash-fallback",
      limit: 1,
      windowSeconds: 60,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.driver, "memory");
  } finally {
    global.fetch = originalFetch;
  }
});

test("rateLimitExceededResponse includes retry metadata and standard headers", () => {
  const response = rateLimitExceededResponse(
    {
      allowed: false,
      key: "rate-limit:test:headers",
      limit: 5,
      remaining: 0,
      retryAfter: 42,
      resetAt: "2026-03-24T22:00:00.000Z",
      driver: "memory",
    },
    "Too many requests"
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "42");
  assert.equal(response.headers.get("X-RateLimit-Limit"), "5");
  assert.equal(response.headers.get("X-RateLimit-Remaining"), "0");
  assert.equal(response.headers.get("X-RateLimit-Driver"), "memory");
});

test("applyRateLimitHeaders decorates successful responses too", async () => {
  const response = applyRateLimitHeaders(
    Response.json({ ok: true }),
    {
      allowed: true,
      key: "rate-limit:test:success",
      limit: 10,
      remaining: 7,
      retryAfter: 0,
      resetAt: "2026-03-24T22:00:00.000Z",
      driver: "memory",
    }
  );

  assert.equal(response.headers.get("X-RateLimit-Limit"), "10");
  assert.equal(response.headers.get("X-RateLimit-Remaining"), "7");
  assert.equal(response.headers.get("Retry-After"), null);
});

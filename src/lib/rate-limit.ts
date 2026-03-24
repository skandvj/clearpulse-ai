import { NextResponse } from "next/server";
import { logError } from "@/lib/logging";

type RateLimitDriver = "upstash-rest" | "memory";

interface RateLimitPolicy {
  key: string;
  limit: number;
  windowSeconds: number;
}

interface UpstashResult {
  result?: unknown;
  error?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number;
  retryAfter: number;
  resetAt: string;
  driver: RateLimitDriver;
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

export function resetInMemoryRateLimitState() {
  memoryStore.clear();
}

function resolveUpstashRestConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/+$/, ""),
    token,
  };
}

function cleanupExpiredMemoryEntries(now: number) {
  for (const [key, entry] of Array.from(memoryStore.entries())) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

function resolveActor(request: Request, userId?: string) {
  if (userId) {
    return `user:${userId}`;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  const ip =
    forwardedFor?.split(",")[0]?.trim() || realIp || cfIp || "anonymous";

  return `ip:${ip}`;
}

export function buildRateLimitKey(args: {
  request: Request;
  scope: string;
  userId?: string;
  resource?: string | null;
}) {
  const actor = resolveActor(args.request, args.userId);
  const resource = args.resource ? `:${args.resource}` : "";
  return `rate-limit:${args.scope}:${actor}${resource}`;
}

async function checkUpstashRateLimit(
  policy: RateLimitPolicy
): Promise<RateLimitResult> {
  const config = resolveUpstashRestConfig();
  if (!config) {
    throw new Error("Upstash REST rate limiting is not configured");
  }

  const response = await fetch(`${config.url}/multi-exec`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["SET", policy.key, "0", "EX", String(policy.windowSeconds), "NX"],
      ["INCR", policy.key],
      ["TTL", policy.key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Upstash rate limit request failed: ${response.status} ${response.statusText}`
    );
  }

  const results = (await response.json()) as UpstashResult[];
  if (!Array.isArray(results) || results.length < 3) {
    throw new Error("Unexpected Upstash rate limit response shape");
  }

  const pipelineErrors = results
    .map((result) => result.error)
    .filter((error): error is string => Boolean(error));

  if (pipelineErrors.length > 0) {
    throw new Error(pipelineErrors.join("; "));
  }

  const count = Number(results[1]?.result);
  const ttlValue = Number(results[2]?.result);
  const ttlSeconds =
    Number.isFinite(ttlValue) && ttlValue > 0 ? ttlValue : policy.windowSeconds;

  if (!Number.isFinite(count) || count < 1) {
    throw new Error("Invalid Upstash rate limit counter response");
  }

  return {
    allowed: count <= policy.limit,
    key: policy.key,
    limit: policy.limit,
    remaining: Math.max(policy.limit - count, 0),
    retryAfter: count > policy.limit ? ttlSeconds : 0,
    resetAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    driver: "upstash-rest",
  };
}

function checkMemoryRateLimit(policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const windowMs = policy.windowSeconds * 1000;

  if (memoryStore.size > 1000) {
    cleanupExpiredMemoryEntries(now);
  }

  const existing = memoryStore.get(policy.key);
  if (!existing || existing.resetAt <= now) {
    const next = {
      count: 1,
      resetAt: now + windowMs,
    };
    memoryStore.set(policy.key, next);

    return {
      allowed: true,
      key: policy.key,
      limit: policy.limit,
      remaining: Math.max(policy.limit - next.count, 0),
      retryAfter: 0,
      resetAt: new Date(next.resetAt).toISOString(),
      driver: "memory",
    };
  }

  existing.count += 1;
  memoryStore.set(policy.key, existing);

  return {
    allowed: existing.count <= policy.limit,
    key: policy.key,
    limit: policy.limit,
    remaining: Math.max(policy.limit - existing.count, 0),
    retryAfter:
      existing.count > policy.limit
        ? Math.max(Math.ceil((existing.resetAt - now) / 1000), 1)
        : 0,
    resetAt: new Date(existing.resetAt).toISOString(),
    driver: "memory",
  };
}

export async function checkRateLimit(
  policy: RateLimitPolicy
): Promise<RateLimitResult> {
  if (resolveUpstashRestConfig()) {
    try {
      return await checkUpstashRateLimit(policy);
    } catch (error) {
      logError("rate_limit.upstash_failed", error, {
        key: policy.key,
        limit: policy.limit,
        windowSeconds: policy.windowSeconds,
      });
    }
  }

  return checkMemoryRateLimit(policy);
}

export function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
) {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", result.resetAt);
  response.headers.set("X-RateLimit-Driver", result.driver);

  if (!result.allowed && result.retryAfter > 0) {
    response.headers.set("Retry-After", String(result.retryAfter));
  }

  return response;
}

export function rateLimitExceededResponse(
  result: RateLimitResult,
  message: string
) {
  const response = NextResponse.json(
    {
      error: message,
      retryAfter: result.retryAfter,
      resetAt: result.resetAt,
    },
    { status: 429 }
  );

  return applyRateLimitHeaders(response, result);
}

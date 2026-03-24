import { logWarn } from "@/lib/logging";

let redisUrl: string | null = null;
let initialized = false;

export interface RedisConnectionOptions {
  url: string;
  tls?: boolean;
}

function resolveUrl(): string | null {
  const url =
    process.env.UPSTASH_REDIS_URL ?? process.env.REDIS_URL ?? null;

  if (!url) {
    if (process.env.UPSTASH_REDIS_REST_URL) {
      logWarn("ingestion.redis.rest_url_only", {
        message:
          "UPSTASH_REDIS_REST_URL is configured, but BullMQ requires a Redis TCP URL. Set UPSTASH_REDIS_URL or REDIS_URL to enable queue features.",
      });
    } else {
      logWarn("ingestion.redis.unconfigured", {
        message: "Redis URL not configured — queue features disabled",
      });
    }
    return null;
  }

  return url;
}

export function getRedisUrl(): string | null {
  if (!initialized) {
    redisUrl = resolveUrl();
    initialized = true;
  }
  return redisUrl;
}

export function getRedisConnectionOptions(): RedisConnectionOptions | null {
  const url = getRedisUrl();
  if (!url) return null;

  return {
    url,
    tls: url.startsWith("rediss://"),
  };
}

export function isQueueAvailable(): boolean {
  return getRedisUrl() !== null;
}

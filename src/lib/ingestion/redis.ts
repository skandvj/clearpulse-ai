let redisUrl: string | null = null;
let initialized = false;

export interface RedisConnectionOptions {
  url: string;
  tls?: boolean;
}

function resolveUrl(): string | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;

  if (!url) {
    console.warn(
      "[ingestion/redis] UPSTASH_REDIS_REST_URL not configured — queue features disabled"
    );
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

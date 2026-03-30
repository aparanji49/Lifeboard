import type { NextRequest } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type LimitConfig = {
  max: number;
  windowMs: number;
};

const DEFAULT_CONFIG: Record<"agent" | "schedule", { user: LimitConfig; ip: LimitConfig }> = {
  agent: {
    user: { max: 20, windowMs: 60_000 },
    ip: { max: 60, windowMs: 60_000 },
  },
  schedule: {
    user: { max: 12, windowMs: 60_000 },
    ip: { max: 40, windowMs: 60_000 },
  },
};

/** Unauthenticated GET proxies — per-IP only (no session). Generous for normal page loads. */
const PUBLIC_PROXY_IP: Record<"weather" | "quote", LimitConfig> = {
  weather: { max: 60, windowMs: 60_000 },
  quote: { max: 60, windowMs: 60_000 },
};

/**
 * NextAuth routes under /api/auth/* (middleware). Per-IP; excludes /api/auth/session in middleware.
 * OAuth flows issue several redirects; keep generous but cap abuse.
 */
const AUTH_MIDDLEWARE_IP: LimitConfig = { max: 45, windowMs: 60_000 };

const globalBuckets = globalThis as typeof globalThis & {
  __lifeboardRateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalBuckets.__lifeboardRateLimitBuckets ?? new Map<string, Bucket>();
if (!globalBuckets.__lifeboardRateLimitBuckets) {
  globalBuckets.__lifeboardRateLimitBuckets = buckets;
}

/**
 * Best-effort client IP for rate limiting. Prefer platform-specific headers when present.
 * @see https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip
 */
export function getRequestIp(req: NextRequest): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const trueClient = req.headers.get("true-client-ip");
  if (trueClient) return trueClient.trim();

  return "unknown";
}

function consume(key: string, config: LimitConfig) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const next: Bucket = { count: 1, resetAt: now + config.windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: Math.max(config.max - 1, 0), resetAt: next.resetAt };
  }

  existing.count += 1;
  buckets.set(key, existing);
  const allowed = existing.count <= config.max;
  return {
    allowed,
    remaining: Math.max(config.max - existing.count, 0),
    resetAt: existing.resetAt,
  };
}

export function checkRouteRateLimit(
  route: "agent" | "schedule",
  userId: string,
  ip: string
): { allowed: boolean; retryAfterSeconds: number; scope: "user" | "ip" | null } {
  const cfg = DEFAULT_CONFIG[route];
  const userRes = consume(`${route}:user:${userId}`, cfg.user);
  const ipRes = consume(`${route}:ip:${ip}`, cfg.ip);

  if (!userRes.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((userRes.resetAt - Date.now()) / 1000)),
      scope: "user",
    };
  }

  if (!ipRes.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((ipRes.resetAt - Date.now()) / 1000)),
      scope: "ip",
    };
  }

  return { allowed: true, retryAfterSeconds: 0, scope: null };
}

/**
 * Rate limit for public proxy routes (weather, quote) where there is no user id — IP only.
 */
export function checkPublicProxyRateLimit(
  route: "weather" | "quote",
  ip: string
): { allowed: boolean; retryAfterSeconds: number } {
  const cfg = PUBLIC_PROXY_IP[route];
  const res = consume(`${route}:ip:${ip}`, cfg);
  if (!res.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((res.resetAt - Date.now()) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Rate limit for NextAuth /api/auth/* (Edge middleware). IP only.
 */
export function checkAuthMiddlewareRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const res = consume(`auth:ip:${ip}`, AUTH_MIDDLEWARE_IP);
  if (!res.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((res.resetAt - Date.now()) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

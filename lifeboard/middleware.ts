import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkAuthMiddlewareRateLimit, getRequestIp } from "@/lib/rateLimit";

/**
 * Per-IP throttling for NextAuth endpoints (sign-in, OAuth callbacks, CSRF, etc.).
 * Skips `/api/auth/session` so client session polling / refetch is not throttled.
 *
 * AI routes (`/api/agent`, `/api/tasks/schedule`) are rate-limited inside route handlers.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/auth/session" || path.startsWith("/api/auth/session/")) {
    return NextResponse.next();
  }

  const ip = getRequestIp(request);
  const rl = checkAuthMiddlewareRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/:path*"],
};

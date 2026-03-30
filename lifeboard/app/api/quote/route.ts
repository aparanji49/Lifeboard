import { NextRequest, NextResponse } from "next/server";
import { checkPublicProxyRateLimit, getRequestIp } from "@/lib/rateLimit";

/**
 * Proxies API Ninjas random quotes so the API key stays server-side.
 */
export async function GET(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = checkPublicProxyRateLimit("quote", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  const key = process.env.API_NINJAS_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Quotes are not configured." },
      { status: 503 }
    );
  }

  const res = await fetch(
    "https://api.api-ninjas.com/v2/randomquotes?categories=inspirational,courage",
    {
      method: "GET",
      headers: { "X-Api-Key": key },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Quote provider error." },
      { status: 502 }
    );
  }

  const data = (await res.json()) as { quote: string; author: string }[];
  const first = Array.isArray(data) ? data[0] : undefined;
  if (!first?.quote) {
    return NextResponse.json(
      { error: "Invalid quote response." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    text: first.quote,
    author: first.author,
  });
}

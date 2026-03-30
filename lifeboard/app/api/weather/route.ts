import { NextRequest, NextResponse } from "next/server";
import { checkPublicProxyRateLimit, getRequestIp } from "@/lib/rateLimit";

/**
 * Proxies OpenWeather so the API key stays server-side.
 * Client should pass `city` (and optional `cc` = ISO country code) from a public geo lookup (e.g. ipapi).
 */
export async function GET(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = checkPublicProxyRateLimit("weather", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Weather is not configured." },
      { status: 503 }
    );
  }

  const city = req.nextUrl.searchParams.get("city")?.trim();
  const cc = req.nextUrl.searchParams.get("cc")?.trim() ?? "";

  if (!city) {
    return NextResponse.json(
      { error: "Missing required query: city" },
      { status: 400 }
    );
  }

  const q = cc ? `${city},${cc}` : city;

  const weatherRes = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=${key}&units=imperial`,
    { cache: "no-store" }
  );

  if (!weatherRes.ok) {
    return NextResponse.json(
      { error: "Weather provider error." },
      { status: 502 }
    );
  }

  const weatherData = (await weatherRes.json()) as {
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
    };
    weather: { description: string; icon: string }[];
  };

  const region = req.nextUrl.searchParams.get("region")?.trim() ?? "";
  const country_name = req.nextUrl.searchParams.get("country")?.trim() ?? "";

  return NextResponse.json({
    location: {
      city,
      region,
      country_name,
    },
    weather: {
      temp: weatherData.main.temp,
      description: weatherData.weather[0]?.description ?? "",
      icon: weatherData.weather[0]?.icon ?? "",
      feels_like: weatherData.main.feels_like,
      temp_min: weatherData.main.temp_min,
      temp_max: weatherData.main.temp_max,
    },
  });
}

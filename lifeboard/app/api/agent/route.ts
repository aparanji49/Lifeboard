import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { agentGraph } from "@/lib/agent/graph";
import { AgentResultSchema } from "@/lib/agent/schemas";
import { logErrorSafe } from "@/lib/devLog";
import { checkRouteRateLimit, getRequestIp } from "@/lib/rateLimit";
import {
  AI_ROUTE_LIMITS,
  readLimitedJsonBody,
} from "@/lib/requestPayloadLimits";

type UserTimeContext = {
  timestamp: string;
  timezone: string;
  localTime: string;
};

const L = AI_ROUTE_LIMITS;

function parseAgentRequestBody(body: unknown): {
  text: string;
  timeZone?: string;
  userTimeContext?: UserTimeContext;
} {
  if (
    !body ||
    typeof body !== "object" ||
    !("text" in body) ||
    typeof (body as { text: unknown }).text !== "string" ||
    !(body as { text: string }).text.trim()
  ) {
    throw new Error("text is required");
  }

  const text = (body as { text: string }).text.trim();
  if (text.length > L.agentTextMaxChars) {
    throw new Error(`text must be at most ${L.agentTextMaxChars} characters`);
  }

  const timeZoneRaw = (body as { timeZone?: unknown }).timeZone;
  const timeZone =
    typeof timeZoneRaw === "string" && timeZoneRaw.trim()
      ? timeZoneRaw.trim()
      : undefined;
  if (timeZone && timeZone.length > L.timeZoneMaxChars) {
    throw new Error("timeZone is too long");
  }

  const ctx = (body as { userTimeContext?: unknown }).userTimeContext;
  let userTimeContext: UserTimeContext | undefined;
  if (
    ctx &&
    typeof ctx === "object" &&
    ctx !== null &&
    "timestamp" in ctx &&
    "timezone" in ctx &&
    "localTime" in ctx &&
    typeof (ctx as UserTimeContext).timestamp === "string" &&
    typeof (ctx as UserTimeContext).timezone === "string" &&
    typeof (ctx as UserTimeContext).localTime === "string"
  ) {
    const utc = (ctx as UserTimeContext).timestamp;
    const tz = (ctx as UserTimeContext).timezone;
    const local = (ctx as UserTimeContext).localTime;
    if (utc.length > L.userTimeTimestampMaxChars) {
      throw new Error("userTimeContext.timestamp is too long");
    }
    if (tz.length > L.timeZoneMaxChars) {
      throw new Error("userTimeContext.timezone is too long");
    }
    if (local.length > L.userTimeLocalTimeMaxChars) {
      throw new Error("userTimeContext.localTime is too long");
    }
    userTimeContext = { timestamp: utc, timezone: tz, localTime: local };
  }

  return { text, timeZone, userTimeContext };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const ip = getRequestIp(req);
    const rateLimit = checkRouteRateLimit("agent", session.user.id, ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          status: "error",
          message: `Rate limit exceeded (${rateLimit.scope}). Try again later.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const raw = await readLimitedJsonBody(req);
    if (!raw.ok) {
      return NextResponse.json(
        { status: "error", message: raw.message },
        { status: raw.status }
      );
    }

    let body: {
      text: string;
      timeZone?: string;
      userTimeContext?: UserTimeContext;
    };
    try {
      body = parseAgentRequestBody(raw.value);
    } catch (e) {
      const msg =
        e instanceof Error && e.message ? e.message : "Invalid request";
      return NextResponse.json({ status: "error", message: msg }, { status: 400 });
    }

    const userId = session.user.id;

    const [account, user] = await Promise.all([
      prisma.account.findFirst({
        where: { userId, provider: "google" },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      }),
    ]);

    if (!account?.refresh_token) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Google Calendar not linked. Sign out and sign in again with Google to grant calendar access.",
        },
        { status: 403 }
      );
    }

    // Use timezone from client (getUserTimeContext/timezone from getBrowserTimezone) for all agent prompts; fallback to DB then UTC
    const timeZone =
      body.userTimeContext?.timezone ??
      body.timeZone ??
      user?.timezone ??
      "UTC";

    const state = await agentGraph.invoke({
      userId,
      text: body.text,
      refreshToken: account.refresh_token,
      timeZone,
      userTimeContext: body.userTimeContext ?? null,
    });

    const parsed = AgentResultSchema.safeParse(state.result);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: "Agent returned invalid result.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (err) {
    logErrorSafe("Error in /api/agent:", err);
    return NextResponse.json(
      {
        status: "error",
        message: "Agent failed to process request. Please try again.",
      },
      { status: 500 }
    );
  }
}


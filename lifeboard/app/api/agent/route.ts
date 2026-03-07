import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { agentGraph } from "@/lib/agent/graph";
import { AgentResultSchema } from "@/lib/agent/schemas";

type UserTimeContext = {
  timestamp: string;
  timezone: string;
  localTime: string;
};

const AgentRequestSchema = {
  parse(body: unknown): {
    text: string;
    timeZone?: string;
    userTimeContext?: UserTimeContext;
  } {
    if (
      body &&
      typeof body === "object" &&
      "text" in body &&
      typeof (body as any).text === "string" &&
      (body as any).text.trim().length > 0
    ) {
      const timeZone =
        typeof (body as any).timeZone === "string" && (body as any).timeZone.trim()
          ? (body as any).timeZone.trim()
          : undefined;
      const ctx = (body as any).userTimeContext;
      const userTimeContext =
        ctx &&
        typeof ctx === "object" &&
        typeof ctx.timestamp === "string" &&
        typeof ctx.timezone === "string" &&
        typeof ctx.localTime === "string"
          ? {
              timestamp: ctx.timestamp,
              timezone: ctx.timezone,
              localTime: ctx.localTime,
            }
          : undefined;
      return { text: (body as any).text.trim(), timeZone, userTimeContext };
    }
    throw new Error("text is required");
  },
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    let body: {
      text: string;
      timeZone?: string;
      userTimeContext?: UserTimeContext;
    };
    try {
      body = AgentRequestSchema.parse(await req.json());
    } catch {
      return NextResponse.json(
        { status: "error", message: "Invalid request: text is required" },
        { status: 400 }
      );
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
    console.error("Error in /api/agent:", err);
    return NextResponse.json(
      {
        status: "error",
        message: "Agent failed to process request. Please try again.",
      },
      { status: 500 }
    );
  }
}


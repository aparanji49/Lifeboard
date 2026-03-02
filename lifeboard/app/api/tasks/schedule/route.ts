// app/api/tasks/schedule/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const TaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  start: z.string(),
  end: z.string(),
});

function getCalendarForUser(refreshToken: string): calendar_v3.Calendar {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

// ---- helpers ----

type ParsedTask = {
  title: string;
  description: string;
  start: string; // ISO dateTime
  end: string; // ISO dateTime
};

/**
 * Use LLM to convert natural language into structured task.
 */
async function parseTaskWithAI(text: string): Promise<ParsedTask> {
  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: `
          You are a scheduling assistant.
          For each user task, produce:
          - A short, clear title (<= 60 chars)
          - A 1–2 sentence description
          - Start and end times in ISO 8601 with timezone.
        `.trim(),
      },
      { role: "user", content: text },
    ],
    text: {
      format: zodTextFormat(TaskSchema, "task"),
    },
  });

  const task = response.output_parsed as ParsedTask;

  return task;
}

/**
 * Check if time range conflicts with existing events.
 */
async function hasConflict(
  calendar: calendar_v3.Calendar,
  start: string,
  end: string
) {
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: start,
      timeMax: end,
      items: [{ id: "primary" }],
    },
  });

  const busyBlocks = res.data.calendars?.primary?.busy ?? [];
  return busyBlocks.length > 0 ? busyBlocks : null;
}

/**
 * Create event in Google Calendar.
 */
// async function createCalendarEvent(parsed: ParsedTask) {
//   const res = await calendar.events.insert({
//     calendarId: "primary",
//     requestBody: {
//       summary: parsed.title,
//       description: parsed.description,
//       start: { dateTime: parsed.start },
//       end: { dateTime: parsed.end },
//     },
//   });

//   return res.data.id;
// }

async function createCalendarEvent(
  calendar: calendar_v3.Calendar,
  parsed: ParsedTask
) {
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: parsed.title,
      description: parsed.description,
      start: {
        dateTime: parsed.start,
        timeZone: "America/New_York", // 👈 add explicit tz
      },
      end: {
        dateTime: parsed.end,
        timeZone: "America/New_York", // 👈 add explicit tz
      },
    },
  });

  return res.data;
}

// ---- POST handler ----

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
    });

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

    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { status: "error", message: "Text is required" },
        { status: 400 }
      );
    }

    const calendar = getCalendarForUser(account.refresh_token);

    // 1) LLM: parse natural language
    const parsed = await parseTaskWithAI(text);

    // 2) Calendar: check for conflicts
    const busyBlocks = await hasConflict(calendar, parsed.start, parsed.end);

    if (busyBlocks) {
      const first = busyBlocks[0];
      const conflictMessage = `You already have an event between ${first.start} and ${first.end}.`;

      return NextResponse.json({
        status: "conflict" as const,
        title: parsed.title,
        description: parsed.description,
        start: parsed.start,
        end: parsed.end,
        conflictMessage,
      });
    }

    // 3) No conflict → create event
    const event = await createCalendarEvent(calendar, parsed);

    return NextResponse.json({
      status: "scheduled" as const,
      title: parsed.title,
      description: parsed.description,
      start: parsed.start,
      end: parsed.end,
      calendarEventId: event.id,
      calendarEventLink: event.htmlLink,
    });
  } catch (error) {
    console.error("Error scheduling task:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Could not schedule this task. Please try again.",
      },
      { status: 500 }
    );
  }
}

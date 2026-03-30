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
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { computeAvailability } from "@/lib/agent/availability";
import { devLog, logErrorSafe } from "@/lib/devLog";
import { timeDebug } from "@/lib/timeDebug";
import { checkRouteRateLimit, getRequestIp } from "@/lib/rateLimit";
import {
  AI_ROUTE_LIMITS,
  readLimitedJsonBody,
} from "@/lib/requestPayloadLimits";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const TaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  start: z.string(),
  end: z.string(),
});

const L = AI_ROUTE_LIMITS;

const OverrideSchema = z.object({
  title: z.string().min(1).max(L.overrideTitleMaxChars),
  description: z.string().max(L.overrideDescriptionMaxChars).optional(),
  start: z.string().min(1).max(L.isoDateTimeMaxChars),
  end: z.string().min(1).max(L.isoDateTimeMaxChars),
});

const UserTimeContextSchema = z.object({
  timestamp: z.string().max(L.userTimeTimestampMaxChars),
  timezone: z.string().max(L.timeZoneMaxChars),
  localTime: z.string().max(L.userTimeLocalTimeMaxChars),
});

const ScheduleRequestSchema = z
  .object({
    text: z.string().max(L.scheduleTextMaxChars).optional(),
    override: OverrideSchema.optional(),
    timeZone: z.string().max(L.timeZoneMaxChars).optional(),
    userTimeContext: UserTimeContextSchema.optional(),
  })
  .refine(
    (data) =>
      data.override != null ||
      (typeof data.text === "string" && data.text.trim().length > 0),
    { message: "Provide either text or override." }
  );

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

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  const out = d.toISOString();
  timeDebug("addDaysIso", { iso, days, out });
  return out;
}

function durationMs(task: ParsedTask) {
  return new Date(task.end).getTime() - new Date(task.start).getTime();
}

function takeDurationFromSlots(
  slots: { start: string; end: string }[],
  durMs: number,
  max = 3
) {
  const out: { start: string; end: string }[] = [];
  for (const s of slots) {
    const sStart = new Date(s.start).getTime();
    const sEnd = new Date(s.end).getTime();
    if (sEnd - sStart >= durMs) {
      out.push({
        start: new Date(sStart).toISOString(),
        end: new Date(sStart + durMs).toISOString(),
      });
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * If the LLM returned a time in UTC (Z or +00:00), reinterpret that clock time as
 * local time in the user's timezone so "11am" stays 11am for the user.
 */
function correctUtcToLocal(
  isoString: string,
  timeZone: string
): string {
  const trimmed = isoString.trim();
  if (!trimmed) return isoString;
  // Has non-UTC offset (e.g. +05:00, -04:00) — assume already correct
  const offsetMatch = trimmed.match(/([+-])(\d{2}):?(\d{2})$/);
  if (offsetMatch) {
    const [, sign, h, m] = offsetMatch;
    const offsetMinutes = (sign === "+" ? 1 : -1) * (parseInt(h, 10) * 60 + parseInt(m, 10));
    if (offsetMinutes !== 0) return isoString; // non-UTC offset, skip correction
  }
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)/);
  if (!match) return isoString;
  const [, datePart, timePart] = match;
  const timeNormalized = timePart.length === 5 ? `${timePart}:00` : timePart.slice(0, 8);
  const localString = `${datePart} ${timeNormalized}`;
  try {
    const utcDate = fromZonedTime(localString, timeZone);
    return utcDate.toISOString();
  } catch {
    return isoString;
  }
}

function formatUserTimeContextBlock(ctx: { timestamp: string; timezone: string; localTime: string }): string {
  return [
    "Use the following user context for any time-sensitive queries:",
    `Current UTC Time: ${ctx.timestamp}`,
    `User Timezone: ${ctx.timezone}`,
    `User Local Time: ${ctx.localTime}`,
  ].join("\n");
}

/**
 * Use LLM to convert natural language into structured task.
 * Accepts full user time context or fallback timeZone string.
 */
async function parseTaskWithAI(
  text: string,
  timeZone: string,
  userTimeContext?: { timestamp: string; timezone: string; localTime: string }
): Promise<ParsedTask> {
  const timeContextBlock = userTimeContext
    ? formatUserTimeContextBlock(userTimeContext)
    : `User timezone: ${timeZone}. Interpret all relative times (e.g. "3pm tomorrow", "noon") in this timezone.`;
  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: `
          You are a scheduling assistant.
          ${timeContextBlock}

          Critical: When the user says a clock time (e.g. "11am tomorrow", "3pm"), they mean that time in their local timezone (User Timezone / User Local Time above). Output start and end in ISO 8601 with the user's timezone offset so that the clock time is correct in their zone.
          - Correct: for "11am tomorrow" in Asia/Karachi (UTC+5) output start like 2026-03-07T11:00:00+05:00 (11am local).
          - Wrong: do NOT output 2026-03-07T11:00:00.000Z or 11:00:00Z — that means 11am UTC and will show as a different local time (e.g. 4pm in Pakistan).
          Always use an explicit offset (e.g. +05:00, -05:00), never the Z suffix, so the event is at the user's intended local time.

          For each user task, produce:
          - A short, clear title (<= 60 chars)
          - A 1–2 sentence description
          - Start and end times in ISO 8601 with timezone offset matching the user's timezone (e.g. 2025-03-02T15:00:00-05:00 for 3pm Eastern).
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
 * Check if time range conflicts with existing events using events.list.
 * This works with the calendar.events scope (no freebusy scope needed).
 */
async function hasConflict(
  calendar: calendar_v3.Calendar,
  start: string,
  end: string
) {
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: start,
    timeMax: end,
    singleEvents: true,
    maxResults: 1,
    orderBy: "startTime",
  });

  const items = res.data.items ?? [];
  return items.length > 0 ? items : null;
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
  parsed: ParsedTask,
  timeZone: string
) {
  // Google ignores timeZone when dateTime has "Z" (UTC). Send local time without offset
  // so Google interprets it in the given timeZone (e.g. "11:00" = 11am in user's zone).
  const localStart = formatInTimeZone(
    new Date(parsed.start),
    timeZone,
    "yyyy-MM-dd'T'HH:mm:ss"
  );
  const localEnd = formatInTimeZone(
    new Date(parsed.end),
    timeZone,
    "yyyy-MM-dd'T'HH:mm:ss"
  );
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: parsed.title,
      description: parsed.description,
      start: {
        dateTime: localStart,
        timeZone,
      },
      end: {
        dateTime: localEnd,
        timeZone,
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

    const ip = getRequestIp(req);
    const rateLimit = checkRouteRateLimit("schedule", session.user.id, ip);
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

    const body = ScheduleRequestSchema.safeParse(raw.value);
    if (!body.success) {
      const first = body.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json(
        { status: "error", message: first },
        { status: 400 }
      );
    }

    const [account, user] = await Promise.all([
      prisma.account.findFirst({
        where: { userId: session.user.id, provider: "google" },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { timezone: true },
      }),
    ]);

    const userTimeContext = body.data.userTimeContext;
    const timeZone =
      body.data.userTimeContext?.timezone ??
      body.data.timeZone ??
      user?.timezone ??
      "UTC";

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

    const calendar = getCalendarForUser(account.refresh_token);

    timeDebug("schedule request body", {
      hasOverride: !!body.data.override,
      textLength: body.data.text?.length ?? 0,
      override_start: body.data.override?.start,
      override_end: body.data.override?.end,
    });

    // If the user text is extremely vague (e.g. "do something sometime") and
    // does not contain any concrete time hints, fail fast instead of asking
    // the model to invent an arbitrary time.
    if (!body.data.override) {
      const rawText = (body.data.text ?? "").toLowerCase();
      const hasDigits = /\d/.test(rawText);
      const hasTimeKeyword = /today|tonight|tomorrow|morning|afternoon|evening|weekend|next\s+\w+|this\s+\w+|\bmon(day)?\b|\btue(sday)?\b|\bwed(nesday)?\b|\bthu(rsday)?\b|\bfri(day)?\b|\bsat(urday)?\b|\bsun(day)?\b|\b\d{1,2}\s*(am|pm)\b/.test(
        rawText
      );
      const hasVagueOnly = /\bsome ?time\b|\bsometime\b|\bsomeday\b/.test(
        rawText
      );

      if (hasVagueOnly && !hasDigits && !hasTimeKeyword) {
        return NextResponse.json(
          { status: "error", message: "Could not understand task time." },
          { status: 400 }
        );
      }
    }

    // 1) Determine the task details (override skips LLM)
    // When no override, pass client's exact time from getBrowserTimezone (getUserTimeContext): timestamp, timezone, localTime
    let parsed: ParsedTask = body.data.override
      ? {
          title: body.data.override.title,
          description: body.data.override.description ?? "",
          start: body.data.override.start,
          end: body.data.override.end,
        }
      : await parseTaskWithAI(body.data.text ?? "", timeZone, userTimeContext ?? undefined);

    if (!body.data.override) {
      const rawStart = parsed.start;
      const rawEnd = parsed.end;
      parsed = {
        ...parsed,
        start: correctUtcToLocal(parsed.start, timeZone),
        end: correctUtcToLocal(parsed.end, timeZone),
      };
      timeDebug("schedule UTC→local correction", {
        timeZone,
        rawStart,
        rawEnd,
        correctedStart: parsed.start,
        correctedEnd: parsed.end,
      });
    }

    timeDebug("schedule parsed (before conflict check)", {
      start: parsed.start,
      end: parsed.end,
      timeZone,
      hasUserTimeContext: !!userTimeContext,
    });

    if (!parsed.title || !parsed.start || !parsed.end) {
      return NextResponse.json(
        { status: "error", message: "Could not understand task time." },
        { status: 400 }
      );
    }

    // 2) Calendar: check for conflicts
    const busyBlocks = await hasConflict(calendar, parsed.start, parsed.end);

    if (busyBlocks) {
      const first = busyBlocks[0];
      const firstStart = first.start?.dateTime ?? first.start?.date ?? parsed.start;
      const firstEnd = first.end?.dateTime ?? first.end?.date ?? parsed.end;
      const conflictMessage = `You already have an event between ${firstStart} and ${firstEnd}.`;

      // Suggest next available slots in the next 7 days using events.list
      const window = { start: parsed.start, end: addDaysIso(parsed.start, 7) };
      const busyRes = await calendar.events.list({
        calendarId: "primary",
        timeMin: window.start,
        timeMax: window.end,
        singleEvents: true,
        orderBy: "startTime",
      });

      const busyAll =
        busyRes.data.items
          ?.map((ev) => {
            const s = ev.start?.dateTime ?? ev.start?.date;
            const e = ev.end?.dateTime ?? ev.end?.date;
            if (!s || !e) return null;
            return { start: s, end: e };
          })
          .filter(
            (b): b is { start: string; end: string } => !!b && !!b.start && !!b.end
          ) ?? [];

      const gaps = computeAvailability(
        window,
        busyAll,
        Math.max(15, Math.round(durationMs(parsed) / 60000)),
        20
      );
      const suggestions = takeDurationFromSlots(gaps, durationMs(parsed), 3);

      return NextResponse.json({
        status: "conflict" as const,
        title: parsed.title,
        description: parsed.description,
        start: parsed.start,
        end: parsed.end,
        conflictMessage,
        suggestions,
      });
    }

    // 3) No conflict → create event
    timeDebug("schedule createCalendarEvent input", {
      start: parsed.start,
      end: parsed.end,
      timeZone,
    });
    const event = await createCalendarEvent(calendar, parsed, timeZone);

    if (!event?.id || !event?.htmlLink) {
      devLog("Calendar API returned incomplete event:", {
        id: event?.id,
        htmlLink: event?.htmlLink,
      });
      console.error("Calendar API returned incomplete event");
      return NextResponse.json(
        { status: "error", message: "Calendar did not return the created event." },
        { status: 500 }
      );
    }

    devLog("[schedule] Event created", {
      eventId: event.id,
      start: parsed.start,
      end: parsed.end,
      userId: session.user.id,
    });

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
    logErrorSafe("Error scheduling task:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Could not schedule this task. Please try again.",
      },
      { status: 500 }
    );
  }
}

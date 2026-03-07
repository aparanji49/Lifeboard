import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";

export function getCalendarForRefreshToken(refreshToken: string): calendar_v3.Calendar {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

export type BusyBlock = { start: string; end: string };

export async function getBusyBlocks(
  calendar: calendar_v3.Calendar,
  window: { start: string; end: string }
): Promise<BusyBlock[]> {
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: window.start,
      timeMax: window.end,
      items: [{ id: "primary" }],
    },
  });

  const busy = res.data.calendars?.primary?.busy ?? [];
  return busy
    .filter((b): b is { start: string; end: string } => !!b.start && !!b.end)
    .map((b) => ({ start: b.start, end: b.end }));
}

export async function createCalendarEvent(
  calendar: calendar_v3.Calendar,
  input: {
    title: string;
    description?: string;
    start: string;
    end: string;
    timeZone?: string;
  }
): Promise<{ id?: string; htmlLink?: string }> {
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.title,
      description: input.description,
      start: { dateTime: input.start, timeZone: input.timeZone },
      end: { dateTime: input.end, timeZone: input.timeZone },
    },
  });

  return { id: res.data.id ?? undefined, htmlLink: res.data.htmlLink ?? undefined };
}


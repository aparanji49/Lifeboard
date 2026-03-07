/**
 * User time context for time-sensitive queries (scheduling, availability).
 * Send from the client so the server/LLM can use the user's actual local time.
 *
 * Why UTC timestamp + timezone (and not "everything in user timezone")?
 * - We need one canonical "instant in time" for the whole flow: Google Calendar API,
 *   conflict checks, and storage all work with instants. A single UTC timestamp (or
 *   ISO 8601 with offset) is that instant.
 * - Flow: (1) Client sends current instant as UTC + user timezone + localTime for context.
 *   (2) LLM interprets "3pm tomorrow" in the user's timezone and outputs one instant as
 *   ISO with offset (e.g. 2026-03-07T20:00:00-04:00). (3) That same string is used
 *   everywhere: calendar insert, conflict check, DB. No second timezone for "entire process"
 *   is needed—we use one representation (instant) and only use timezone for interpretation
 *   and display.
 */
export type UserTimeContext = {
  timestamp: string; // UTC ISO, e.g. "2026-03-06T21:04:00.000Z" — the single "now" instant
  timezone: string; // IANA, e.g. "America/New_York" — for interpreting relative times
  localTime: string; // locale string, e.g. "3/6/2026, 9:04:00 PM" — for human context in prompts
};

/**
 * Get current timestamp, timezone, and local time from the browser.
 * Use when calling schedule/agent APIs so prompts get accurate user context.
 */
export function getUserTimeContext(): UserTimeContext {
  try {
    const now = new Date();
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return {
      timestamp: now.toISOString(),
      timezone,
      localTime: now.toLocaleString(),
    };
  } catch {
    const now = new Date();
    return {
      timestamp: now.toISOString(),
      timezone: "UTC",
      localTime: now.toLocaleString(),
    };
  }
}

/**
 * Detect the user's timezone from the browser (e.g. "America/New_York").
 * Use this on the client and send it to APIs so scheduling uses the user's local time.
 * Prefer sending getUserTimeContext() for full context in prompts.
 */
export function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && typeof tz === "string" ? tz : "UTC";
  } catch {
    return "UTC";
  }
}

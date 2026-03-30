/**
 * User-facing copy for /api/tasks/schedule failures (HTTP + JSON body).
 */

export function scheduleErrorUserMessage(
  httpStatus: number,
  body: { message?: unknown } | null | undefined
): string {
  if (httpStatus === 429) {
    return "You're scheduling a bit too fast. Please wait about a minute, then tap Retry.";
  }

  const msg =
    body && typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : null;

  if (msg) {
    if (/rate limit exceeded/i.test(msg)) {
      return "Too many scheduling attempts right now. Please wait a minute and try again.";
    }
    return msg;
  }

  if (httpStatus >= 400) {
    return "We couldn't schedule this task. Please try again.";
  }

  return "Something went wrong. Please try again.";
}

/** Short line for task progress log */
export function scheduleProgressOnFailure(httpStatus: number): string {
  if (httpStatus === 429) {
    return "Rate limited — wait a minute, then tap Retry.";
  }
  return "Scheduling failed.";
}

export function parseJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** True when we should keep the schedule op queued for a later retry (FIFO). */
export function isScheduleRateLimited(httpStatus: number): boolean {
  return httpStatus === 429;
}

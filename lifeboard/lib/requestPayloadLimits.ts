import type { NextRequest } from "next/server";
import { TASK_INPUT_TEXT_MAX_CHARS } from "./aiInputLimits";

/** Shared limits for AI-heavy routes (agent + schedule). */
export const AI_ROUTE_LIMITS = {
  /** Max raw JSON body size (UTF-16 length ≈ bytes for ASCII). */
  maxBodyBytes: 64 * 1024,
  agentTextMaxChars: TASK_INPUT_TEXT_MAX_CHARS,
  scheduleTextMaxChars: TASK_INPUT_TEXT_MAX_CHARS,
  timeZoneMaxChars: 120,
  userTimeTimestampMaxChars: 100,
  userTimeLocalTimeMaxChars: 120,
  overrideTitleMaxChars: 500,
  overrideDescriptionMaxChars: 10_000,
  /** ISO 8601 datetime strings */
  isoDateTimeMaxChars: 120,
} as const;

export type LimitedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number; message: string };

/**
 * Read request body as text with a byte/length cap, then JSON.parse.
 * Rejects oversized bodies via Content-Length when present, and after read.
 */
export async function readLimitedJsonBody(
  req: NextRequest,
  maxBytes: number = AI_ROUTE_LIMITS.maxBodyBytes
): Promise<LimitedJsonResult> {
  const cl = req.headers.get("content-length");
  if (cl) {
    const n = parseInt(cl, 10);
    if (Number.isFinite(n) && n > maxBytes) {
      return {
        ok: false,
        status: 413,
        message: "Request body is too large.",
      };
    }
  }

  const text = await req.text();
  if (text.length > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: "Request body is too large.",
    };
  }

  if (!text.trim()) {
    return { ok: false, status: 400, message: "Request body is empty." };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON." };
  }
}

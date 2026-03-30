/**
 * Debug logging for time/window processing. Grep for "[time-debug]" to trace where
 * start/end dates flow and to spot wrong years (e.g. 2023 instead of 2025).
 *
 * - **Production**: off by default (no user text or noisy logs).
 * - **Development**: on.
 * - **Production override**: set `TIME_DEBUG=1` to enable (still redacts long user fields).
 */
const PREFIX = "[time-debug]";

const timeDebugEnabled =
  process.env.TIME_DEBUG === "1" ||
  (process.env.NODE_ENV !== "production" && process.env.TIME_DEBUG !== "0");

/** Keys that may contain user-provided content — never log raw values when enabled. */
const SENSITIVE_KEYS = new Set([
  "text",
  "rawText",
  "description",
  "title",
  "userInstruction",
]);

function redactSensitive(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(k) && typeof v === "string") {
      out[k] = `[${v.length} chars]`;
    } else if (k === "userTimeContext" && v && typeof v === "object") {
      out[k] = { present: true };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function extractYear(iso: string): string {
  if (typeof iso !== "string" || iso.length < 4) return "?";
  return iso.slice(0, 4);
}

function enrichPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      out[`${k}_year`] = extractYear(v);
    }
    if (
      v &&
      typeof v === "object" &&
      "start" in v &&
      typeof (v as { start: string }).start === "string"
    ) {
      const obj = v as { start: string; end?: string };
      out[`${k}_start_year`] = extractYear(obj.start);
      if (typeof obj.end === "string") out[`${k}_end_year`] = extractYear(obj.end);
    }
  }
  return out;
}

export function timeDebug(label: string, payload: Record<string, unknown>): void {
  if (!timeDebugEnabled) return;
  const safe = redactSensitive(payload);
  console.log(PREFIX, label, JSON.stringify(enrichPayload(safe)));
}

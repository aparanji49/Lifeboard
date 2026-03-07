/**
 * Debug logging for time/window processing. Grep for "[time-debug]" to trace where
 * start/end dates flow and to spot wrong years (e.g. 2023 instead of 2025).
 */
const PREFIX = "[time-debug]";

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
  console.log(PREFIX, label, JSON.stringify(enrichPayload(payload)));
}

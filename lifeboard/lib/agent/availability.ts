import { timeDebug } from "@/lib/timeDebug";
import type { AvailabilitySlot, TimeWindow } from "./schemas";

type BusyBlock = { start: string; end: string };

function clampRangeToWindow(window: TimeWindow, block: BusyBlock): BusyBlock | null {
  const ws = new Date(window.start).getTime();
  const we = new Date(window.end).getTime();
  const bs = new Date(block.start).getTime();
  const be = new Date(block.end).getTime();
  const start = Math.max(ws, bs);
  const end = Math.min(we, be);
  if (end <= start) return null;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export function computeAvailability(
  window: TimeWindow,
  busy: BusyBlock[],
  minMinutes = 30,
  maxSlots = 5
): AvailabilitySlot[] {
  timeDebug("availability computeAvailability input", { window, busyCount: busy.length });
  const ws = new Date(window.start).getTime();
  const we = new Date(window.end).getTime();
  if (!Number.isFinite(ws) || !Number.isFinite(we) || we <= ws) return [];

  const clipped = busy
    .map((b) => clampRangeToWindow(window, b))
    .filter((b): b is BusyBlock => b !== null)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // merge overlaps
  const merged: BusyBlock[] = [];
  for (const b of clipped) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(b);
      continue;
    }
    const lastEnd = new Date(last.end).getTime();
    const curStart = new Date(b.start).getTime();
    const curEnd = new Date(b.end).getTime();
    if (curStart <= lastEnd) {
      const end = Math.max(lastEnd, curEnd);
      last.end = new Date(end).toISOString();
    } else {
      merged.push(b);
    }
  }

  const minMs = minMinutes * 60 * 1000;
  const slots: AvailabilitySlot[] = [];

  let cursor = ws;
  for (const b of merged) {
    const bs = new Date(b.start).getTime();
    if (bs - cursor >= minMs) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(bs).toISOString(),
      });
      if (slots.length >= maxSlots) return slots;
    }
    cursor = Math.max(cursor, new Date(b.end).getTime());
  }

  if (we - cursor >= minMs) {
    slots.push({
      start: new Date(cursor).toISOString(),
      end: new Date(we).toISOString(),
    });
  }

  const result = slots.slice(0, maxSlots);
  timeDebug("availability computeAvailability output", {
    slots: result,
    count: result.length,
  });
  return result;
}


/**
 * Tracks which day's end-of-day summary the user has already seen.
 * Used by the Routine page to show yesterday's recap once on next-day open.
 *
 * This store only stores a date string. It does NOT change summary UI.
 */

const KEY = "dailyos.summary-seen.v1";

interface SummarySeenState {
  lastSeenDate: string | null; // YYYY-MM-DD
}

function read(): SummarySeenState {
  if (typeof window === "undefined") return { lastSeenDate: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lastSeenDate: null };
    return JSON.parse(raw) as SummarySeenState;
  } catch {
    return { lastSeenDate: null };
  }
}

function write(s: SummarySeenState) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
}

export function getLastSeenSummaryDate(): string | null {
  return read().lastSeenDate;
}

export function markSummarySeen(date: string): void {
  write({ lastSeenDate: date });
}

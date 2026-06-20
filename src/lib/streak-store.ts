import { useEffect, useRef, useState } from "react";
import { getSummaryFor, readAllSummaries } from "@/lib/daily-summary-store";

const KEY = "dailyos.streak.v2";

interface StreakState {
  streak: number;
  lastCompletedDate: string | null;   // YYYY-MM-DD of last day that hit threshold
  lastResetDate: string | null;       // YYYY-MM-DD we already reset for
  lastBrokenAt: number | null;        // timestamp of last reset (for one-time notification)
  lastEvaluatedDate?: string | null;  // YYYY-MM-DD up to which catch-up has run (exclusive of "today")
}

const STREAK_THRESHOLD = 0.8; // 80%
const STREAK_THRESHOLD_PCT = 80; // daily-summary stores rounded percent

const DEFAULT_STATE: StreakState = {
  streak: 0,
  lastCompletedDate: null,
  lastResetDate: null,
  lastBrokenAt: null,
  lastEvaluatedDate: null,
};

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(d = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return todayKey(y);
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + n);
  return todayKey(dt);
}

function read(): StreakState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as StreakState) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function write(s: StreakState) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
}

/**
 * Pure catch-up: walks all elapsed days since `state.lastEvaluatedDate` up to
 * (and including) yesterday using the daily-summary store. Idempotent — calling
 * twice on the same day is a no-op after the first run.
 *
 * Rules:
 *  - day with total === 0   → neutral (skipped)
 *  - day with no summary    → neutral (skipped, treat as untracked)
 *  - day with pct ≥ 80      → streak++ and lastCompletedDate = day
 *  - day with pct  < 80     → if streak > 0, reset to 0 and record lastBrokenAt
 */
function catchUp(state: StreakState): { state: StreakState; brokeNow: boolean } {
  const today = todayKey();
  const yesterday = yesterdayKey();

  // Nothing to evaluate before yesterday.
  if (state.lastEvaluatedDate === yesterday || state.lastEvaluatedDate === today) {
    return { state, brokeNow: false };
  }

  // Determine first date to evaluate.
  let cursor: string;
  if (state.lastEvaluatedDate) {
    cursor = addDays(state.lastEvaluatedDate, 1);
  } else {
    const all = readAllSummaries();
    if (all.length === 0) {
      // No history at all → just stamp lastEvaluatedDate to avoid re-walking.
      return { state: { ...state, lastEvaluatedDate: yesterday }, brokeNow: false };
    }
    cursor = all[0].date;
  }

  let next: StreakState = { ...state };
  let brokeNow = false;

  while (cursor <= yesterday) {
    const day = getSummaryFor(cursor);
    if (day && day.total > 0) {
      if (day.pct >= STREAK_THRESHOLD_PCT) {
        const continues = next.lastCompletedDate === addDays(cursor, -1);
        next.streak = continues ? next.streak + 1 : 1;
        next.lastCompletedDate = cursor;
      } else if (next.streak > 0) {
        next.streak = 0;
        next.lastResetDate = cursor;
        next.lastBrokenAt = Date.now();
        brokeNow = true;
      }
    }
    cursor = addDays(cursor, 1);
  }

  next.lastEvaluatedDate = yesterday;
  return { state: next, brokeNow };
}

export interface StreakInfo {
  streak: number;
  justBroke: boolean;
  status: "idle" | "active" | "atRisk" | "brokenToday";
}

/**
 * Hook returning streak info.
 * - reachedThreshold: true when today's completion percent >= 80%.
 * - endOfDayMissed:   end-of-day reached and threshold not met → reset streak.
 *
 * On mount, runs a catch-up that walks elapsed days since last evaluation and
 * extends / resets the streak accordingly. Live updates handle today.
 */
export function useStreak(reachedThreshold: boolean, endOfDayMissed: boolean): StreakInfo {
  const [state, setState] = useState<StreakState>(DEFAULT_STATE);
  const [justBroke, setJustBroke] = useState(false);
  const announcedRef = useRef<number | null>(null);
  const didCatchUpRef = useRef(false);

  // Initial load + catch-up. Runs once per mount.
  useEffect(() => {
    const loaded = read();
    if (didCatchUpRef.current) {
      setState(loaded);
      return;
    }
    didCatchUpRef.current = true;
    const { state: caught, brokeNow } = catchUp(loaded);
    if (caught !== loaded) write(caught);
    setState(caught);
    if (brokeNow) {
      announcedRef.current = caught.lastBrokenAt;
      setJustBroke(true);
      const t = setTimeout(() => setJustBroke(false), 100);
      return () => clearTimeout(t);
    }
  }, []);

  // Today live update.
  useEffect(() => {
    const today = todayKey();
    let next = { ...state };
    let changed = false;
    let brokeNow = false;

    if (reachedThreshold && state.lastCompletedDate !== today) {
      const bump = state.lastCompletedDate === yesterdayKey() ? state.streak + 1 : 1;
      next = { ...next, streak: bump, lastCompletedDate: today };
      changed = true;
    } else if (
      endOfDayMissed &&
      state.lastResetDate !== today &&
      state.lastCompletedDate !== today &&
      state.streak > 0
    ) {
      brokeNow = true;
      next = { ...next, streak: 0, lastResetDate: today, lastBrokenAt: Date.now() };
      changed = true;
    } else if (endOfDayMissed && state.lastResetDate !== today && state.lastCompletedDate !== today) {
      next = { ...next, lastResetDate: today };
      changed = true;
    }

    if (changed) {
      write(next);
      setState(next);
    }

    if (brokeNow && announcedRef.current !== next.lastBrokenAt) {
      announcedRef.current = next.lastBrokenAt;
      setJustBroke(true);
      const t = setTimeout(() => setJustBroke(false), 100);
      return () => clearTimeout(t);
    }
  }, [reachedThreshold, endOfDayMissed, state]);

  // Derive status.
  const today = todayKey();
  let status: StreakInfo["status"] = "idle";
  if (justBroke) {
    status = "brokenToday";
  } else if (state.lastCompletedDate === today && state.streak > 0) {
    status = "active";
  } else if (state.streak > 0) {
    const hour = typeof window !== "undefined" ? new Date().getHours() : 0;
    if (hour >= 18 && !reachedThreshold) status = "atRisk";
    else status = "active";
  } else {
    status = "idle";
  }

  return { streak: state.streak, justBroke, status };
}

export { STREAK_THRESHOLD };

import { useEffect, useRef, useState } from "react";

const KEY = "dailyos.streak.v2";

interface StreakState {
  streak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD of last day that hit threshold
  lastResetDate: string | null;     // YYYY-MM-DD we already reset for
  lastBrokenAt: number | null;      // timestamp of last reset (for one-time notification)
}

const STREAK_THRESHOLD = 0.8; // 80%

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(d = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return todayKey(y);
}

function read(): StreakState {
  if (typeof window === "undefined") return { streak: 0, lastCompletedDate: null, lastResetDate: null, lastBrokenAt: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { streak: 0, lastCompletedDate: null, lastResetDate: null, lastBrokenAt: null };
    return JSON.parse(raw) as StreakState;
  } catch {
    return { streak: 0, lastCompletedDate: null, lastResetDate: null, lastBrokenAt: null };
  }
}

function write(s: StreakState) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
}

export interface StreakInfo {
  streak: number;
  justBroke: boolean;
}

/**
 * Hook returning streak info.
 * - reachedThreshold: true when today's completion percent >= 80%.
 * - endOfDayMissed: end-of-day reached and threshold not met → reset streak.
 */
export function useStreak(reachedThreshold: boolean, endOfDayMissed: boolean): StreakInfo {
  const [state, setState] = useState<StreakState>({ streak: 0, lastCompletedDate: null, lastResetDate: null, lastBrokenAt: null });
  const [justBroke, setJustBroke] = useState(false);
  const announcedRef = useRef<number | null>(null);

  useEffect(() => {
    setState(read());
  }, []);

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

  return { streak: state.streak, justBroke };
}

export { STREAK_THRESHOLD };

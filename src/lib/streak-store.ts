import { useEffect, useState } from "react";

const KEY = "dailyos.streak.v1";

interface StreakState {
  streak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD of last fully-completed day
  lastResetDate: string | null;     // YYYY-MM-DD we already reset for
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(d = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return todayKey(y);
}

function read(): StreakState {
  if (typeof window === "undefined") return { streak: 0, lastCompletedDate: null, lastResetDate: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { streak: 0, lastCompletedDate: null, lastResetDate: null };
    return JSON.parse(raw) as StreakState;
  } catch {
    return { streak: 0, lastCompletedDate: null, lastResetDate: null };
  }
}

function write(s: StreakState) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
}

/**
 * Hook that returns the current streak.
 * - `allDone`: every task for today is completed → mark today as completed, bump streak.
 * - `endOfDayMissed`: end-of-day reached and not all done → reset streak.
 */
export function useStreak(allDone: boolean, endOfDayMissed: boolean): number {
  const [state, setState] = useState<StreakState>({ streak: 0, lastCompletedDate: null, lastResetDate: null });

  useEffect(() => {
    setState(read());
  }, []);

  useEffect(() => {
    const today = todayKey();
    let next = { ...state };
    let changed = false;

    if (allDone && state.lastCompletedDate !== today) {
      const bump = state.lastCompletedDate === yesterdayKey() ? state.streak + 1 : 1;
      next = { ...next, streak: bump, lastCompletedDate: today };
      changed = true;
    } else if (endOfDayMissed && state.lastResetDate !== today && state.lastCompletedDate !== today) {
      next = { ...next, streak: 0, lastResetDate: today };
      changed = true;
    }

    if (changed) {
      write(next);
      setState(next);
    }
  }, [allDone, endOfDayMissed, state]);

  return state.streak;
}

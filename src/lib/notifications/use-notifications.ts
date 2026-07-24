import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTasks, useTasksForDate } from "@/lib/tasks-store";
import { useEvents } from "@/lib/events-store";
import { useMissions } from "@/lib/missions-store";
import { useExpenses } from "@/lib/expenses-store";
import { getSummaryFor } from "@/lib/daily-summary-store";
import {
  getSettings,
  setSettingsUser,
  subscribeSettings,
} from "./notification-settings-store";
import {
  refreshSchedule,
  startScheduler,
  stopScheduler,
} from "./notification-scheduler";
import type { PlannerContext } from "./planner";

const STREAK_LEGACY_KEY = "dailyos.streak.v2";

function todayStr(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function tomorrowStr(d = new Date()): string {
  const t = new Date(d);
  t.setDate(t.getDate() + 1);
  return todayStr(t);
}

function readRoutineStreak(): { streak: number; completedToday: boolean } {
  if (typeof window === "undefined") return { streak: 0, completedToday: false };
  try {
    const raw = window.localStorage.getItem(STREAK_LEGACY_KEY);
    if (!raw) return { streak: 0, completedToday: false };
    const parsed = JSON.parse(raw) as {
      streak?: number;
      lastCompletedDate?: string | null;
    };
    return {
      streak: Number(parsed.streak) || 0,
      completedToday: parsed.lastCompletedDate === todayStr(),
    };
  } catch {
    return { streak: 0, completedToday: false };
  }
}

/**
 * Mount once (e.g. inside AppShell) to power the offline notification
 * layer. Wires the current auth user to the settings store, provides
 * the scheduler with fresh context whenever any source store changes,
 * and re-plans on visibility / online events (handled internally by
 * the scheduler).
 */
export function useNotifications(): void {
  const { userId } = useAuth();
  const today = useTasks();
  const tomorrow = useTasksForDate(tomorrowStr());
  const events = useEvents();
  const missions = useMissions();
  const expenses = useExpenses();

  // Force re-plan when settings change.
  const settingsVersion = useSyncExternalStore(
    subscribeSettings,
    () => getSettings(),
    () => getSettings(),
  );

  const ctxRef = useRef<PlannerContext | null>(null);

  useEffect(() => {
    setSettingsUser(userId);
  }, [userId]);

  useEffect(() => {
    const summary = getSummaryFor(todayStr());
    const streak = readRoutineStreak();
    ctxRef.current = {
      now: Date.now(),
      settings: settingsVersion,
      todayTasks: today,
      tomorrowTasks: tomorrow,
      events,
      missions,
      expenses,
      todaySummary: summary,
      routineStreak: streak.streak,
      routineCompletedToday: streak.completedToday,
    };
    // Rebuild the plan on any dependency change.
    refreshSchedule();
  }, [settingsVersion, today, tomorrow, events, missions, expenses]);

  useEffect(() => {
    startScheduler(() => ctxRef.current);
    return () => {
      stopScheduler();
    };
  }, []);
}

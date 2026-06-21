/**
 * DailyOS — Behavior AI.
 * Lightweight, frontend-only pattern detection over the last 7 days
 * of locally-stored data. No backend, no AI API.
 */

import type { Task } from "@/lib/tasks-store";
import { taskShowsOnWeekday } from "@/lib/tasks-store";
import { isCompletedOn } from "@/lib/task-completions-store";
import type { Expense } from "@/lib/expenses-store";

const TASKS_KEY = "dailyos.tasks.v1";

function readAllTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Task[]) : [];
  } catch {
    return [];
  }
}

export type BehaviorType = "pattern" | "warning" | "positive";

export type BehaviorInsight = {
  message: string;
  type: BehaviorType;
};

export type BehaviorInput = {
  tasks?: Task[];
  expenses?: Expense[];
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function behaviorIcon(type: BehaviorType): string {
  if (type === "pattern") return "📊";
  if (type === "warning") return "⚠️";
  return "🌟";
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function hhmmHour(s: string): number {
  const h = parseInt(s.split(":")[0] ?? "0", 10);
  return Number.isFinite(h) ? h : 0;
}

export function getBehaviorInsights(data: BehaviorInput): BehaviorInsight[] {
  const tasks = data.tasks ?? readAllTasks();
  const expenses = data.expenses ?? [];

  const insights: BehaviorInsight[] = [];

  // Build last 7 days window (today and 6 prior).
  const today = new Date();
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  const windowStart = days[0].getTime();
  const windowEnd = startOfDay(today.getTime()) + 86400000;

  // ----- Expense pattern: highest spending weekday -----
  const recentExpenses = expenses.filter(
    (e) => e.type === "expense" && e.createdAt >= windowStart && e.createdAt < windowEnd,
  );
  if (recentExpenses.length >= 3) {
    const byDay = new Array(7).fill(0) as number[];
    for (const e of recentExpenses) {
      const wd = new Date(e.createdAt).getDay();
      byDay[wd] += e.amount;
    }
    let topDay = -1;
    let topAmount = 0;
    for (let i = 0; i < 7; i++) {
      if (byDay[i] > topAmount) {
        topAmount = byDay[i];
        topDay = i;
      }
    }
    if (topDay >= 0 && topAmount > 0) {
      insights.push({
        message: `You spend most on ${WEEKDAY_NAMES[topDay]} 💸`,
        type: "pattern",
      });
    }
  }

  // ----- Task completion patterns over last 7 days -----
  let totalVisible = 0;
  let totalDone = 0;
  let morningDone = 0;
  let afternoonDone = 0;
  let eveningDone = 0;

  for (const day of days) {
    const wd = day.getDay();
    const key = dateKey(day);
    for (const t of tasks) {
      if (!taskShowsOnWeekday(t, wd)) continue;
      totalVisible++;
      const done = isCompletedOn(t.id, key);
      if (!done) continue;
      totalDone++;
      const hour = hhmmHour(t.time);
      if (hour < 12) morningDone++;
      else if (hour < 18) afternoonDone++;
      else eveningDone++;
    }
  }

  if (totalDone >= 5) {
    if (
      morningDone >= afternoonDone &&
      morningDone >= eveningDone &&
      morningDone / totalDone >= 0.5
    ) {
      insights.push({
        message: "You're most productive in the morning ☀️",
        type: "positive",
      });
    } else if (
      eveningDone > morningDone &&
      eveningDone >= afternoonDone &&
      eveningDone / totalDone >= 0.5
    ) {
      insights.push({
        message: "You get things done in the evening 🌙",
        type: "positive",
      });
    }
  }

  if (totalVisible >= 5) {
    const missedPct = (totalVisible - totalDone) / totalVisible;
    if (missedPct >= 0.5) {
      insights.push({
        message: "You often miss tasks — try simplifying your routine ⚠️",
        type: "warning",
      });
    }
  }

  // ----- Empty state -----
  if (insights.length === 0 && tasks.length === 0 && expenses.length === 0) {
    insights.push({
      message: "Start using DailyOS to unlock smart insights 🚀",
      type: "pattern",
    });
  }

  return insights;
}

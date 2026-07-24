/**
 * Pure planner — turns the current app state into a list of
 * scheduled notification items for the next 24 hours.
 *
 * The planner never fires notifications, never writes to stores,
 * and never reads from the DOM. It only takes plain snapshots so
 * it stays trivially testable and cheap to re-run on every store
 * change.
 */

import type { Task } from "@/lib/tasks-store";
import type { EventItem } from "@/lib/events-store";
import type { Mission } from "@/lib/missions-store";
import type { Expense } from "@/lib/expenses-store";
import type { DaySummary } from "@/lib/daily-summary-store";
import type { NotificationSettings } from "./notification-settings-store";
import { fireStamp } from "./notification-log-store";

export type NotificationCategory =
  | "routine"
  | "mission"
  | "event"
  | "expense"
  | "summary"
  | "streak";

export interface PlannedItem {
  key: string;
  fireAt: number;
  category: NotificationCategory;
  title: string;
  body?: string;
  url?: string;
}

export interface PlannerContext {
  now: number;
  settings: NotificationSettings;
  todayTasks: Task[];
  tomorrowTasks: Task[];
  events: EventItem[];
  missions: Mission[];
  expenses: Expense[];
  todaySummary: DaySummary | null;
  routineStreak: number;
  routineCompletedToday: boolean;
}

const HORIZON_MS = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parse an "HH:MM" wall-clock time on a specific calendar date to ms. */
function timeOnDate(dateStr: string, hhmm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (
    !Number.isFinite(h) || !Number.isFinite(m) ||
    !Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)
  ) return null;
  const dt = new Date(y, (mo || 1) - 1, d || 1, h, m, 0, 0);
  return dt.getTime();
}

function todayStr(now: number): string {
  return dateKey(new Date(now));
}

function tomorrowStr(now: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return dateKey(d);
}

function inHorizon(now: number, fireAt: number): boolean {
  return fireAt > now && fireAt - now <= HORIZON_MS;
}

function planRoutine(ctx: PlannerContext, out: PlannedItem[]): void {
  if (!ctx.settings.routineEnabled) return;
  const today = todayStr(ctx.now);
  const tomorrow = tomorrowStr(ctx.now);

  const pushFor = (task: Task, dateStr: string) => {
    if (task.completed) return;
    const fireAt = timeOnDate(dateStr, task.time);
    if (fireAt === null || !inHorizon(ctx.now, fireAt)) return;
    out.push({
      key: `routine:${task.id}:${fireStamp(fireAt)}`,
      fireAt,
      category: "routine",
      title: task.title,
      body: task.note || "Time to start this task.",
      url: "/routine",
    });
  };

  for (const t of ctx.todayTasks) pushFor(t, today);
  for (const t of ctx.tomorrowTasks) pushFor(t, tomorrow);
}

function planMission(ctx: PlannerContext, out: PlannedItem[]): void {
  if (!ctx.settings.missionEnabled) return;
  const pending = ctx.missions.reduce(
    (n, m) => n + m.tasks.filter((t) => !t.completed).length,
    0,
  );
  if (pending === 0) return;

  const today = todayStr(ctx.now);
  const tomorrow = tomorrowStr(ctx.now);
  for (const dateStr of [today, tomorrow]) {
    const fireAt = timeOnDate(dateStr, ctx.settings.morningReminderTime);
    if (fireAt === null || !inHorizon(ctx.now, fireAt)) continue;
    out.push({
      key: `mission:daily:${fireStamp(fireAt)}`,
      fireAt,
      category: "mission",
      title: "Mission check-in",
      body: `You have ${pending} mission ${pending === 1 ? "step" : "steps"} pending.`,
      url: "/missions",
    });
  }
}

function planEvents(ctx: PlannerContext, out: PlannedItem[]): void {
  if (!ctx.settings.eventEnabled) return;
  const lead = Math.max(0, ctx.settings.eventLeadMinutes | 0);

  for (const ev of ctx.events) {
    if (ev.completed) continue;
    if (!ev.date || !ev.time) continue;
    const start = timeOnDate(ev.date, ev.time);
    if (start === null) continue;

    const isBirthday =
      ev.type === "Personal" && /birthday/i.test(ev.title || "");
    const fireAt = isBirthday
      ? timeOnDate(ev.date, "09:00")
      : start - lead * 60_000;
    if (fireAt === null || !inHorizon(ctx.now, fireAt)) continue;

    out.push({
      key: `event:${ev.id}:${fireStamp(fireAt)}`,
      fireAt,
      category: "event",
      title: ev.title || "Upcoming event",
      body: isBirthday
        ? "Don't forget to wish them today."
        : lead > 0
          ? `Starts in ${lead} minutes.`
          : "Starting now.",
      url: "/events",
    });
  }
}

function planExpense(ctx: PlannerContext, out: PlannedItem[]): void {
  if (!ctx.settings.expenseEnabled) return;
  const today = todayStr(ctx.now);
  const startOfToday = timeOnDate(today, "00:00") ?? 0;
  const hasExpenseToday = ctx.expenses.some(
    (e) => e.type === "expense" && e.createdAt >= startOfToday,
  );
  if (hasExpenseToday) return;
  const fireAt = timeOnDate(today, ctx.settings.expenseReminderTime);
  if (fireAt === null || !inHorizon(ctx.now, fireAt)) return;
  out.push({
    key: `expense:daily:${fireStamp(fireAt)}`,
    fireAt,
    category: "expense",
    title: "Log today's expenses",
    body: "Don't forget to record today's spending.",
    url: "/expenses",
  });
}

function planSummary(ctx: PlannerContext, out: PlannedItem[]): void {
  if (!ctx.settings.summaryEnabled) return;
  const today = todayStr(ctx.now);
  const fireAt = timeOnDate(today, ctx.settings.dailySummaryTime);
  if (fireAt === null || !inHorizon(ctx.now, fireAt)) return;
  const s = ctx.todaySummary;
  const body =
    s && s.total > 0
      ? `You completed ${s.done} of ${s.total} tasks today.`
      : "How did today go? Tap to review.";
  out.push({
    key: `summary:daily:${fireStamp(fireAt)}`,
    fireAt,
    category: "summary",
    title: "Daily summary",
    body,
    url: "/",
  });
}

function planStreak(ctx: PlannerContext, out: PlannedItem[]): void {
  if (!ctx.settings.streakEnabled) return;
  if (ctx.routineStreak <= 0) return;
  if (ctx.routineCompletedToday) return;
  const today = todayStr(ctx.now);
  const fireAt = timeOnDate(today, ctx.settings.nightReminderTime);
  if (fireAt === null || !inHorizon(ctx.now, fireAt)) return;
  out.push({
    key: `streak:daily:${fireStamp(fireAt)}`,
    fireAt,
    category: "streak",
    title: "Keep your streak alive",
    body: `You're on a ${ctx.routineStreak}-day streak. Finish today's routine to keep it.`,
    url: "/routine",
  });
}

export function planNotifications(ctx: PlannerContext): PlannedItem[] {
  const out: PlannedItem[] = [];
  if (!ctx.settings.masterEnabled) return out;
  planRoutine(ctx, out);
  planMission(ctx, out);
  planEvents(ctx, out);
  planExpense(ctx, out);
  planSummary(ctx, out);
  planStreak(ctx, out);
  return out;
}

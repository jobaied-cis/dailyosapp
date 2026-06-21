/**
 * DailyOS — Weekly AI Report.
 * Aggregates the last 7 days from Memory + Expenses to produce a short report.
 */

import { readMemory } from "./memory-store";
import type { Expense } from "./expenses-store";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type WeeklyStat = {
  label: string;
  value: string;
  icon: string;
};

export type WeeklyInsight = {
  message: string;
  tone: "positive" | "warning" | "neutral";
};

export type WeeklyReport = {
  summary: string;
  stats: WeeklyStat[];
  insights: WeeklyInsight[];
};

export type WeeklyReportInput = {
  expenses: Expense[];
  dailyLimit?: number;
  eventsThisWeek?: number;
  currencySymbol?: string;
};

function startOfWeekAgo() {
  return Date.now() - 7 * 86400000;
}

export function getWeeklyReport(data: WeeklyReportInput): WeeklyReport {
  const cutoff = startOfWeekAgo();
  const mem = readMemory();
  const sym = data.currencySymbol ?? "";

  // Task completions from memory.taskHistory in the last 7 days
  const recentTasks = mem.taskHistory.filter((e) => e.time >= cutoff);
  const completedCount = recentTasks.length;

  // Per-day activity tally
  const perDay: Record<number, number> = {};
  mem.activityLog
    .filter((e) => e.time >= cutoff)
    .forEach((e) => {
      const d = new Date(e.time).getDay();
      perDay[d] = (perDay[d] ?? 0) + 1;
    });
  const activeDays = Object.keys(perDay).length;
  const bestDayEntry = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0];
  const bestDay = bestDayEntry ? WEEKDAYS[Number(bestDayEntry[0])] : null;

  // Expense totals in the last 7 days
  const recentExpenses = data.expenses.filter(
    (e) => e.type === "expense" && e.createdAt >= cutoff,
  );
  const totalSpent = recentExpenses.reduce((s, e) => s + e.amount, 0);
  const weeklyLimit = (data.dailyLimit ?? 0) * 7;
  const overBudget = weeklyLimit > 0 && totalSpent > weeklyLimit;

  // ---- Stats ----
  const stats: WeeklyStat[] = [
    { label: "Tasks done", value: String(completedCount), icon: "✅" },
    { label: "Active days", value: `${activeDays}/7`, icon: "📅" },
    { label: "Spent", value: `${sym}${totalSpent.toLocaleString()}`, icon: "💸" },
  ];
  if (typeof data.eventsThisWeek === "number") {
    stats.push({ label: "Events", value: String(data.eventsThisWeek), icon: "📌" });
  }

  // ---- Insights ----
  const insights: WeeklyInsight[] = [];

  if (completedCount > 0) {
    insights.push({
      message: `You completed ${completedCount} task${completedCount > 1 ? "s" : ""} this week 💪`,
      tone: "positive",
    });
  }

  if (activeDays >= 6) {
    insights.push({ message: "Great consistency this week 🔥", tone: "positive" });
  } else if (activeDays > 0 && activeDays <= 3) {
    insights.push({
      message: `Only ${activeDays} active day${activeDays > 1 ? "s" : ""} — push a bit more next week 💡`,
      tone: "warning",
    });
  }

  if (totalSpent > 0) {
    insights.push({
      message: `You spent ${sym}${totalSpent.toLocaleString()} this week`,
      tone: "neutral",
    });
  }
  if (overBudget) {
    insights.push({ message: "You're slightly over budget ⚠️", tone: "warning" });
  }

  if (bestDay) {
    insights.push({
      message: `Your most productive day was ${bestDay} 📈`,
      tone: "positive",
    });
  }

  // ---- Summary ----
  let summary: string;
  if (completedCount === 0 && totalSpent === 0 && activeDays === 0) {
    summary = "Not much activity yet — start logging tasks and expenses to see your weekly report 🚀";
  } else {
    const parts: string[] = [];
    parts.push(`${completedCount} tasks done`);
    parts.push(`${activeDays}/7 active days`);
    if (totalSpent > 0) parts.push(`${sym}${totalSpent.toLocaleString()} spent`);
    summary = parts.join(" · ");
  }

  return { summary, stats, insights: insights.slice(0, 4) };
}

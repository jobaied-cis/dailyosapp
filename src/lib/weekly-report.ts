/**
 * DailyOS — Weekly AI Report.
 * Aggregates the last 7 days from Memory + Expenses to produce a short report.
 */

import { readMemory } from "./memory-store";
import type { Expense } from "./expenses-store";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type StatTone = "good" | "warn" | "neutral";

export type WeeklyStat = {
  label: string;
  value: string;
  icon: string;
  tone: StatTone;
};

export type WeeklyInsight = {
  message: string;
  tone: "positive" | "warning" | "neutral";
};

export type WeeklyReport = {
  summary: string;
  stats: WeeklyStat[];
  insights: WeeklyInsight[];
  meta: {
    completedCount: number;
    previousCompletedCount: number;
    activeDays: number;
    totalSpent: number;
    bestDay: string | null;
    bestDayCount: number;
  };
};

export type WeeklyReportInput = {
  expenses: Expense[];
  dailyLimit?: number;
  eventsThisWeek?: number;
  currencySymbol?: string;
  /** Tasks completed in the prior 7-day window (days 8–14 ago). */
  previousCompletedCount?: number;
};

function startOfWeekAgo() {
  return Date.now() - 7 * 86400000;
}

export function getWeeklyReport(data: WeeklyReportInput): WeeklyReport {
  const cutoff = startOfWeekAgo();
  const prevCutoff = Date.now() - 14 * 86400000;
  const mem = readMemory();
  const sym = data.currencySymbol ?? "";

  // Task completions in last 7 days
  const recentTasks = mem.taskHistory.filter((e) => e.time >= cutoff);
  const completedCount = recentTasks.length;

  // Previous week completions (passed in, else derived from memory window)
  const previousCompletedCount =
    typeof data.previousCompletedCount === "number"
      ? data.previousCompletedCount
      : mem.taskHistory.filter((e) => e.time >= prevCutoff && e.time < cutoff).length;

  // Per-day activity tally (incl. best day count)
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
  const bestDayCount = bestDayEntry ? bestDayEntry[1] : 0;

  // Expense totals
  const recentExpenses = data.expenses.filter(
    (e) => e.type === "expense" && e.createdAt >= cutoff,
  );
  const totalSpent = recentExpenses.reduce((s, e) => s + e.amount, 0);
  const weeklyLimit = (data.dailyLimit ?? 0) * 7;
  const overBudget = weeklyLimit > 0 && totalSpent > weeklyLimit;
  const nearBudget = weeklyLimit > 0 && !overBudget && totalSpent > weeklyLimit * 0.8;

  // ---- Stats with tone hints ----
  const stats: WeeklyStat[] = [
    {
      label: "Tasks done",
      value: String(completedCount),
      icon: "✅",
      tone: completedCount > 0 ? "good" : "neutral",
    },
    {
      label: "Active days",
      value: `${activeDays}/7`,
      icon: "📅",
      tone: activeDays >= 4 ? "good" : "neutral",
    },
    {
      label: "Spent",
      value: `${sym}${totalSpent.toLocaleString()}`,
      icon: "💸",
      tone: overBudget || nearBudget ? "warn" : "neutral",
    },
  ];
  if (typeof data.eventsThisWeek === "number") {
    stats.push({
      label: "Events",
      value: String(data.eventsThisWeek),
      icon: "📌",
      tone: "neutral",
    });
  }

  // ---- Insights (collected, then ordered positive → warning → neutral) ----
  const positives: WeeklyInsight[] = [];
  const suggestions: WeeklyInsight[] = [];
  const neutrals: WeeklyInsight[] = [];

  if (completedCount > 0) {
    const diff = completedCount - previousCompletedCount;
    if (previousCompletedCount > 0 && diff > 0) {
      positives.push({
        message: `${completedCount} tasks done — up from ${previousCompletedCount} last week 📈`,
        tone: "positive",
      });
    } else if (previousCompletedCount > 0 && diff < 0) {
      suggestions.push({
        message: `${completedCount} tasks done — a little less than last week, you've got this 💪`,
        tone: "warning",
      });
    } else {
      positives.push({
        message: `You completed ${completedCount} task${completedCount > 1 ? "s" : ""} this week 💪`,
        tone: "positive",
      });
    }
  }

  if (bestDay && bestDayCount > 0) {
    positives.push({
      message: `Your best day: ${bestDay} — ${bestDayCount} action${bestDayCount > 1 ? "s" : ""} 🌟`,
      tone: "positive",
    });
  }

  if (activeDays >= 6) {
    positives.push({ message: "Great consistency this week 🔥", tone: "positive" });
  } else if (activeDays > 0 && activeDays <= 3) {
    suggestions.push({
      message: `You were active ${activeDays} day${activeDays > 1 ? "s" : ""} this week — try spreading tasks across more days next week 💡`,
      tone: "warning",
    });
  }

  if (overBudget) {
    suggestions.push({
      message: "Spending edged above your weekly target — small tweaks go a long way 💡",
      tone: "warning",
    });
  }

  if (totalSpent > 0) {
    neutrals.push({
      message: `You spent ${sym}${totalSpent.toLocaleString()} this week`,
      tone: "neutral",
    });
  }

  const insights = [...positives, ...suggestions, ...neutrals].slice(0, 4);

  // ---- Summary ----
  let summary: string;
  if (completedCount === 0 && totalSpent === 0 && activeDays === 0) {
    summary = "Not much activity yet — start building your week 🚀";
  } else {
    const parts: string[] = [];
    parts.push(`${completedCount} tasks done`);
    parts.push(`${activeDays}/7 active days`);
    if (totalSpent > 0) parts.push(`${sym}${totalSpent.toLocaleString()} spent`);
    summary = parts.join(" · ");
  }

  return {
    summary,
    stats,
    insights,
    meta: {
      completedCount,
      previousCompletedCount,
      activeDays,
      totalSpent,
      bestDay,
      bestDayCount,
    },
  };
}

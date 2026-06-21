/**
 * DailyOS — Memory AI.
 * Reads the last 7–14 days of stored memory and produces lightweight
 * pattern-based insights. No backend, no heavy computation.
 */

import { readMemory, type MemoryShape, type MemoryEntry } from "./memory-store";

export type MemoryInsightType = "time" | "task" | "expense" | "consistency";

export type MemoryInsight = {
  message: string;
  type: MemoryInsightType;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeBucket(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

function topKey<T extends string>(counts: Record<T, number>): T | null {
  let best: T | null = null;
  let max = 0;
  (Object.keys(counts) as T[]).forEach((k) => {
    if (counts[k] > max) {
      max = counts[k];
      best = k;
    }
  });
  return max > 0 ? best : null;
}

function recentWithinDays(entries: MemoryEntry[], days: number): MemoryEntry[] {
  const cutoff = Date.now() - days * 86400000;
  return entries.filter((e) => e.time >= cutoff);
}

export function memoryIcon(type: MemoryInsightType): string {
  if (type === "time") return "🌙";
  if (type === "task") return "⚠️";
  if (type === "expense") return "💸";
  return "🔥";
}

export function getMemoryInsights(memory?: MemoryShape): MemoryInsight[] {
  const mem = memory ?? readMemory();
  const insights: MemoryInsight[] = [];

  // 1. TIME PATTERN — most active time of day from activityLog (last 14d)
  const activity = recentWithinDays(mem.activityLog, 14);
  if (activity.length >= 5) {
    const buckets: Record<"morning" | "afternoon" | "evening" | "night", number> = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
    };
    activity.forEach((e) => {
      buckets[timeBucket(new Date(e.time).getHours())]++;
    });
    const top = topKey(buckets);
    if (top) {
      const emoji =
        top === "morning" ? "☀️" : top === "afternoon" ? "🌤️" : top === "evening" ? "🌆" : "🌙";
      insights.push({
        message: `You are most active in the ${top} ${emoji}`,
        type: "time",
      });
    }
  }

  // 2. TASK PATTERN — weekday with most "missed" markers (task entries tagged "missed")
  const taskEntries = recentWithinDays(mem.taskHistory, 14);
  const missed = taskEntries.filter((e) => (e.meta ?? "").includes("missed"));
  if (missed.length >= 3) {
    const dayCounts: Record<number, number> = {};
    missed.forEach((e) => {
      const d = new Date(e.time).getDay();
      dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    });
    const worstDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
    if (worstDay) {
      insights.push({
        message: `You often miss tasks on ${WEEKDAYS[Number(worstDay[0])]} ⚠️`,
        type: "task",
      });
    }
  }

  // 3. EXPENSE PATTERN — weekday with highest spend total
  const expEntries = recentWithinDays(mem.expenseHistory, 14);
  if (expEntries.length >= 3) {
    const daySums: Record<number, number> = {};
    expEntries.forEach((e) => {
      const amount = Number((e.meta ?? "").split(":")[1] ?? 0);
      if (Number.isFinite(amount) && amount > 0) {
        const d = new Date(e.time).getDay();
        daySums[d] = (daySums[d] ?? 0) + amount;
      }
    });
    const sorted = Object.entries(daySums).sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      const topDay = Number(sorted[0][0]);
      const weekendHeavy = (daySums[0] ?? 0) + (daySums[6] ?? 0) >
        Object.values(daySums).reduce((s, v) => s + v, 0) * 0.5;
      if (weekendHeavy) {
        insights.push({ message: "You spend more on weekends 💸", type: "expense" });
      } else {
        insights.push({
          message: `You spend most on ${WEEKDAYS[topDay]} 💸`,
          type: "expense",
        });
      }
    }
  }

  // 4. CONSISTENCY — active most days in the last 7
  const last7 = recentWithinDays(mem.activityLog, 7);
  const activeDays = new Set(
    last7.map((e) => new Date(e.time).toDateString()),
  ).size;
  if (activeDays >= 5) {
    insights.push({
      message: "You're consistent — great job 🔥",
      type: "consistency",
    });
  }

  return insights;
}

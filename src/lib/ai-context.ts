/**
 * Builds a compact, personalized prompt for /api/ai from existing app data.
 * Keep the summary short — never dump raw arrays.
 */

export type AIContext = {
  name?: string;
  priorities?: string[];
  pendingTasks?: number;
  completedTasks?: number;
  todaysEvents?: string[]; // short labels e.g. "Math exam 14:00"
  missionTitle?: string;
  missionProgressPct?: number;
  todayExpense?: number;
  dailyLimit?: number;
  currencySymbol?: string;
};

export function hasAnyContext(ctx: AIContext): boolean {
  return Boolean(
    ctx.name ||
      (ctx.priorities && ctx.priorities.length) ||
      ctx.pendingTasks ||
      ctx.completedTasks ||
      (ctx.todaysEvents && ctx.todaysEvents.length) ||
      ctx.missionTitle ||
      ctx.todayExpense ||
      ctx.dailyLimit,
  );
}

export function buildAIPrompt(ctx: AIContext, userPrompt: string): string {
  const sym = ctx.currencySymbol ?? "";
  const priorities = ctx.priorities?.length ? ctx.priorities.join(", ") : "—";
  const events = ctx.todaysEvents?.length
    ? ctx.todaysEvents.slice(0, 4).join("; ")
    : "none";
  const mission = ctx.missionTitle
    ? `${ctx.missionTitle} (${ctx.missionProgressPct ?? 0}%)`
    : "none";
  const spend =
    ctx.dailyLimit && ctx.dailyLimit > 0
      ? `${sym}${ctx.todayExpense ?? 0} / ${sym}${ctx.dailyLimit}`
      : `${sym}${ctx.todayExpense ?? 0}`;

  return [
    "You are a smart productivity assistant.",
    "",
    "User data:",
    `- Name: ${ctx.name ?? "User"}`,
    `- Priorities: ${priorities}`,
    `- Pending tasks: ${ctx.pendingTasks ?? 0}`,
    `- Completed tasks: ${ctx.completedTasks ?? 0}`,
    `- Today's events: ${events}`,
    `- Active mission: ${mission}`,
    `- Today's spending: ${spend}`,
    "",
    `User question: ${userPrompt}`,
    "",
    "Give a short, helpful, personalized answer in 2–3 lines.",
  ].join("\n");
}

/**
 * DailyOS — Simple frontend AI Personalization Engine.
 * No external API. Pure rule-based logic over existing data.
 */

export type SuggestionType = "focus" | "warning" | "motivation";

export type DailySuggestion = {
  message: string;
  type: SuggestionType;
};

export type SuggestionInput = {
  priorities?: string[];
  hasMission?: boolean;
  incompleteTaskCount?: number;
  totalTaskCount?: number;
  todayExpense?: number;
  dailyLimit?: number;
  upcomingEventCount?: number;
};

export function suggestionIcon(type: SuggestionType): string {
  if (type === "focus") return "🎯";
  if (type === "warning") return "⚠️";
  return "🔥";
}

/**
 * Returns multiple personalized insights based on the user's current state.
 * Always includes at least one positive/motivational message.
 */
export function getDailyInsights(data: SuggestionInput): DailySuggestion[] {
  const {
    priorities = [],
    hasMission = false,
    incompleteTaskCount = 0,
    totalTaskCount = 0,
    todayExpense = 0,
    dailyLimit = 0,
    upcomingEventCount = 0,
  } = data;

  const insights: DailySuggestion[] = [];

  if (dailyLimit > 0 && todayExpense > dailyLimit) {
    insights.push({
      message: "You're over your budget today ⚠️",
      type: "warning",
    });
  }

  if (priorities.includes("study") && hasMission) {
    insights.push({
      message: "Focus on your mission today 📚",
      type: "focus",
    });
  }

  if (incompleteTaskCount > 0) {
    insights.push({
      message: `You still have ${incompleteTaskCount} task${incompleteTaskCount > 1 ? "s" : ""} left 💪`,
      type: "motivation",
    });
  }

  if (upcomingEventCount > 0) {
    insights.push({
      message: "You have an event coming up ⏳",
      type: "focus",
    });
  }

  if (totalTaskCount === 0 && upcomingEventCount === 0) {
    insights.push({
      message: "Start planning your day 🚀",
      type: "focus",
    });
  }

  // Always include at least one positive note.
  insights.push({
    message: "You're doing great — keep going 🔥",
    type: "motivation",
  });

  return insights;
}

/**
 * Back-compat: returns the first insight as a single suggestion.
 */
export function getDailySuggestion(data: SuggestionInput): DailySuggestion {
  return getDailyInsights(data)[0];
}

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
};

export function suggestionIcon(type: SuggestionType): string {
  if (type === "focus") return "🎯";
  if (type === "warning") return "⚠️";
  return "🔥";
}

/**
 * Returns a personalized daily message based on user state.
 * If multiple rules match, rotates between them based on the day-of-year
 * so the same situation can surface different copy across days.
 */
export function getDailySuggestion(data: SuggestionInput): DailySuggestion {
  const {
    priorities = [],
    hasMission = false,
    incompleteTaskCount = 0,
    totalTaskCount = 0,
    todayExpense = 0,
    dailyLimit = 0,
  } = data;

  const matches: DailySuggestion[] = [];

  if (dailyLimit > 0 && todayExpense > dailyLimit) {
    matches.push({
      message: "You're over your budget today ⚠️",
      type: "warning",
    });
  }

  if (priorities.includes("study") && hasMission) {
    matches.push({
      message: "Focus on your mission today 📚",
      type: "focus",
    });
  }

  if (incompleteTaskCount > 2) {
    matches.push({
      message: "You still have tasks left — keep going 💪",
      type: "motivation",
    });
  }

  if (totalTaskCount === 0) {
    matches.push({
      message: "Start your day by planning something 🚀",
      type: "focus",
    });
  }

  if (matches.length === 0) {
    return {
      message: "You're doing great today — keep it up 🔥",
      type: "motivation",
    };
  }

  // Rotate suggestions across days when several match.
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((now.getTime() - start) / 86400000);
  return matches[dayOfYear % matches.length];
}

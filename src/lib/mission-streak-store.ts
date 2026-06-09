const STREAK_PREFIX = "dailyos.mission-streak.";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface StreakState {
  streak: number;
  lastCompletedDate: string | null;
  lastResetDate: string | null;
}

function read(missionId: string): StreakState {
  if (typeof window === "undefined") {
    return { streak: 0, lastCompletedDate: null, lastResetDate: null };
  }
  try {
    const raw = localStorage.getItem(STREAK_PREFIX + missionId);
    if (!raw) return { streak: 0, lastCompletedDate: null, lastResetDate: null };
    return JSON.parse(raw) as StreakState;
  } catch {
    return { streak: 0, lastCompletedDate: null, lastResetDate: null };
  }
}

function write(missionId: string, state: StreakState) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STREAK_PREFIX + missionId, JSON.stringify(state));
  }
}

/**
 * Call when a task is completed. Records today's completion for the mission.
 * Returns the new streak and whether it increased.
 */
export function recordMissionCompletion(missionId: string): { streak: number; increased: boolean } {
  const today = todayKey();
  const state = read(missionId);

  if (state.lastCompletedDate === today) {
    return { streak: state.streak, increased: false };
  }

  let newStreak: number;
  let increased: boolean;

  if (state.lastCompletedDate === yesterdayKey()) {
    newStreak = state.streak + 1;
    increased = true;
  } else {
    // First completion or streak was broken
    newStreak = 1;
    increased = false;
  }

  write(missionId, {
    streak: newStreak,
    lastCompletedDate: today,
    lastResetDate: state.lastResetDate,
  });

  return { streak: newStreak, increased };
}

/**
 * Get the current streak for a mission.
 * Streak is 0 if the last completion was before yesterday.
 * atRisk is true if streak > 0 but today hasn't been completed yet.
 */
export function getMissionStreak(missionId: string): StreakState & { atRisk: boolean } {
  const state = read(missionId);
  const today = todayKey();
  const yesterday = yesterdayKey();

  let effectiveStreak = state.streak;
  if (state.lastCompletedDate && state.lastCompletedDate !== today && state.lastCompletedDate !== yesterday) {
    effectiveStreak = 0;
  }

  const atRisk = effectiveStreak > 0 && state.lastCompletedDate !== today;

  return {
    ...state,
    streak: effectiveStreak,
    atRisk,
  };
}

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSummaryFor, readAllSummaries } from "@/lib/daily-summary-store";

/**
 * Global routine streak. Cloud-backed via `streak_state` (one row per user).
 * LocalStorage mirror kept as offline fallback.
 */

const LEGACY_KEY = "dailyos.streak.v2";

interface StreakState {
  streak: number;
  lastCompletedDate: string | null;
  lastResetDate: string | null;
  lastBrokenAt: number | null;
  lastEvaluatedDate?: string | null;
}

const STREAK_THRESHOLD = 0.8;
const STREAK_THRESHOLD_PCT = 80;

const DEFAULT_STATE: StreakState = {
  streak: 0,
  lastCompletedDate: null,
  lastResetDate: null,
  lastBrokenAt: null,
  lastEvaluatedDate: null,
};

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(d = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return todayKey(y);
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + n);
  return todayKey(dt);
}

let cache: StreakState = { ...DEFAULT_STATE };
let currentUserId: string | null = null;
let initialized = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function loadLocal(): StreakState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as StreakState) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveLocal(s: StreakState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

function ensureInit() {
  if (!initialized) {
    cache = loadLocal();
    initialized = true;
  }
}

function subscribeStreak(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function fromRow(row: any): StreakState {
  return {
    streak: Number(row.streak) || 0,
    lastCompletedDate: row.last_completed_date ?? null,
    lastResetDate: row.last_reset_date ?? null,
    lastBrokenAt: row.last_broken_at ? new Date(row.last_broken_at).getTime() : null,
    lastEvaluatedDate: row.last_evaluated_date ?? null,
  };
}

async function loadFromCloud(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("streak_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[streak] load failed:", error.message);
    return;
  }
  if (!data) {
    // No row yet — keep local cache as-is (may still have offline state).
    return;
  }
  cache = fromRow(data);
  saveLocal(cache);
  emit();
}

function persistCloud(next: StreakState): void {
  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("streak_state").upsert(
      {
        user_id: currentUserId!,
        streak: next.streak,
        last_completed_date: next.lastCompletedDate,
        last_reset_date: next.lastResetDate,
        last_evaluated_date: next.lastEvaluatedDate ?? null,
        last_broken_at: next.lastBrokenAt ? new Date(next.lastBrokenAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) console.error("[streak] upsert failed:", error.message);
  })();
}

function writeState(next: StreakState) {
  cache = next;
  saveLocal(next);
  emit();
  persistCloud(next);
}

export function useStreakSync(userId: string | null) {
  useEffect(() => {
    if (userId === currentUserId) return;
    currentUserId = userId;
    if (!userId) {
      cache = { ...DEFAULT_STATE };
      emit();
      return;
    }
    // Keep local cache until cloud row loads to avoid flash of zero.
    ensureInit();
    void loadFromCloud(userId);
  }, [userId]);
}

/**
 * Catch-up walker: uses the LOCAL daily-summary store to extend/reset
 * the streak for elapsed days. Idempotent.
 */
function catchUp(state: StreakState): { state: StreakState; brokeNow: boolean } {
  const today = todayKey();
  const yesterday = yesterdayKey();

  if (state.lastEvaluatedDate === yesterday || state.lastEvaluatedDate === today) {
    return { state, brokeNow: false };
  }

  let cursor: string;
  if (state.lastEvaluatedDate) {
    cursor = addDays(state.lastEvaluatedDate, 1);
  } else {
    const all = readAllSummaries();
    if (all.length === 0) {
      return { state: { ...state, lastEvaluatedDate: yesterday }, brokeNow: false };
    }
    cursor = all[0].date;
  }

  const next: StreakState = { ...state };
  let brokeNow = false;

  while (cursor <= yesterday) {
    const day = getSummaryFor(cursor);
    if (day && day.total > 0) {
      if (day.pct >= STREAK_THRESHOLD_PCT) {
        const continues = next.lastCompletedDate === addDays(cursor, -1);
        next.streak = continues ? next.streak + 1 : 1;
        next.lastCompletedDate = cursor;
      } else if (next.streak > 0) {
        next.streak = 0;
        next.lastResetDate = cursor;
        next.lastBrokenAt = Date.now();
        brokeNow = true;
      }
    }
    cursor = addDays(cursor, 1);
  }

  next.lastEvaluatedDate = yesterday;
  return { state: next, brokeNow };
}

export interface StreakInfo {
  streak: number;
  justBroke: boolean;
  status: "idle" | "active" | "atRisk" | "brokenToday";
}

export function useStreak(reachedThreshold: boolean, endOfDayMissed: boolean): StreakInfo {
  const [state, setState] = useState<StreakState>(() => {
    ensureInit();
    return cache;
  });
  const [justBroke, setJustBroke] = useState(false);
  const announcedRef = useRef<number | null>(null);
  const didCatchUpRef = useRef(false);

  // Subscribe to store changes (cloud loads, external writes).
  useEffect(() => {
    return subscribeStreak(() => setState(cache));
  }, []);

  // Initial catch-up. Runs once per mount.
  useEffect(() => {
    if (didCatchUpRef.current) return;
    didCatchUpRef.current = true;
    const { state: caught, brokeNow } = catchUp(cache);
    if (caught !== cache) {
      writeState(caught);
      setState(caught);
    }
    if (brokeNow) {
      announcedRef.current = caught.lastBrokenAt;
      setJustBroke(true);
      const t = setTimeout(() => setJustBroke(false), 100);
      return () => clearTimeout(t);
    }
  }, []);

  // Today live update.
  useEffect(() => {
    const today = todayKey();
    let next = { ...state };
    let changed = false;
    let brokeNow = false;

    if (reachedThreshold && state.lastCompletedDate !== today) {
      const bump = state.lastCompletedDate === yesterdayKey() ? state.streak + 1 : 1;
      next = { ...next, streak: bump, lastCompletedDate: today };
      changed = true;
    } else if (
      endOfDayMissed &&
      state.lastResetDate !== today &&
      state.lastCompletedDate !== today &&
      state.streak > 0
    ) {
      brokeNow = true;
      next = { ...next, streak: 0, lastResetDate: today, lastBrokenAt: Date.now() };
      changed = true;
    } else if (
      endOfDayMissed &&
      state.lastResetDate !== today &&
      state.lastCompletedDate !== today
    ) {
      next = { ...next, lastResetDate: today };
      changed = true;
    }

    if (changed) {
      writeState(next);
      setState(next);
    }

    if (brokeNow && announcedRef.current !== next.lastBrokenAt) {
      announcedRef.current = next.lastBrokenAt;
      setJustBroke(true);
      const t = setTimeout(() => setJustBroke(false), 100);
      return () => clearTimeout(t);
    }
  }, [reachedThreshold, endOfDayMissed, state]);

  const today = todayKey();
  let status: StreakInfo["status"] = "idle";
  if (justBroke) {
    status = "brokenToday";
  } else if (state.lastCompletedDate === today && state.streak > 0) {
    status = "active";
  } else if (state.streak > 0) {
    const hour = typeof window !== "undefined" ? new Date().getHours() : 0;
    if (hour >= 18 && !reachedThreshold) status = "atRisk";
    else status = "active";
  } else {
    status = "idle";
  }

  return { streak: state.streak, justBroke, status };
}

export { STREAK_THRESHOLD };

/** Used by cloud-migrate to push legacy localStorage streak state. */
export async function bulkInsertStreak(state: StreakState): Promise<void> {
  if (!currentUserId) return;
  const { error } = await supabase.from("streak_state").upsert(
    {
      user_id: currentUserId,
      streak: state.streak,
      last_completed_date: state.lastCompletedDate,
      last_reset_date: state.lastResetDate,
      last_evaluated_date: state.lastEvaluatedDate ?? null,
      last_broken_at: state.lastBrokenAt ? new Date(state.lastBrokenAt).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[streak] bulk upsert failed:", error.message);
    return;
  }
  cache = state;
  saveLocal(state);
  emit();
}

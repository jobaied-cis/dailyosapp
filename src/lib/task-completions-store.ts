import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-day completion store for tasks (both recurring and one-off).
 *
 * Cloud-backed via `task_completions`. LocalStorage is kept as an offline
 * cache under the legacy key.
 *
 * In-memory shape: { [YYYY-MM-DD]: { [taskId]: true } }
 */

const LEGACY_KEY = "dailyos.task-completions.v1";
const PRUNE_DAYS = 60;

type CompletionMap = Record<string, Record<string, true>>;

let cache: CompletionMap = {};
let currentUserId: string | null = null;
let initialized = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function loadLocal(): CompletionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as CompletionMap) : {};
  } catch {
    return {};
  }
}

function saveLocal(m: CompletionMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(m));
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

function commit(next: CompletionMap) {
  cache = next;
  saveLocal(next);
  emit();
}

export function subscribeCompletions(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadFromCloud(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("task_completions")
    .select("task_id, date")
    .eq("user_id", userId);
  if (error) {
    console.error("[task-completions] load failed:", error.message);
    return;
  }
  const next: CompletionMap = {};
  for (const row of data ?? []) {
    const key = String(row.date);
    if (!next[key]) next[key] = {};
    next[key][String(row.task_id)] = true;
  }
  commit(next);
}

/** Wire to current Supabase session — call from a top-level effect. */
export function useCompletionSync(userId: string | null) {
  useEffect(() => {
    if (userId === currentUserId) return;
    currentUserId = userId;
    if (!userId) {
      commit({});
      return;
    }
    void loadFromCloud(userId);
  }, [userId]);
}

export function isCompletedOn(taskId: string, date: Date | string = new Date()): boolean {
  ensureInit();
  const key = typeof date === "string" ? date : dateKey(date);
  return Boolean(cache[key]?.[taskId]);
}

export function setCompletedOn(
  taskId: string,
  value: boolean,
  date: Date | string = new Date(),
): void {
  ensureInit();
  const key = typeof date === "string" ? date : dateKey(date);
  const prev = cache;
  const day = { ...(cache[key] ?? {}) };
  if (value) {
    day[taskId] = true;
  } else {
    delete day[taskId];
  }
  const next = { ...cache };
  if (Object.keys(day).length === 0) {
    delete next[key];
  } else {
    next[key] = day;
  }
  commit(next);

  if (!currentUserId) return;
  void (async () => {
    if (value) {
      const { error } = await supabase
        .from("task_completions")
        .upsert(
          { user_id: currentUserId!, task_id: taskId, date: key },
          { onConflict: "user_id,task_id,date" },
        );
      if (error) {
        console.error("[task-completions] upsert failed:", error.message);
        commit(prev);
      }
    } else {
      const { error } = await supabase
        .from("task_completions")
        .delete()
        .eq("user_id", currentUserId!)
        .eq("task_id", taskId)
        .eq("date", key);
      if (error) {
        console.error("[task-completions] delete failed:", error.message);
        commit(prev);
      }
    }
  })();
}

export function toggleCompletedOn(taskId: string, date: Date | string = new Date()): boolean {
  const current = isCompletedOn(taskId, date);
  setCompletedOn(taskId, !current, date);
  return !current;
}

export function clearCompletionsForDay(date: Date | string = new Date()): void {
  ensureInit();
  const key = typeof date === "string" ? date : dateKey(date);
  if (!cache[key]) return;
  const prev = cache;
  const next = { ...cache };
  delete next[key];
  commit(next);

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase
      .from("task_completions")
      .delete()
      .eq("user_id", currentUserId!)
      .eq("date", key);
    if (error) {
      console.error("[task-completions] clearDay failed:", error.message);
      commit(prev);
    }
  })();
}

export function getCompletionsForDay(date: Date | string = new Date()): string[] {
  ensureInit();
  const key = typeof date === "string" ? date : dateKey(date);
  return Object.keys(cache[key] ?? {});
}

export function clearCompletionsForTask(taskId: string): void {
  ensureInit();
  const prev = cache;
  const next: CompletionMap = {};
  let changed = false;
  for (const k of Object.keys(cache)) {
    if (cache[k][taskId]) {
      const day = { ...cache[k] };
      delete day[taskId];
      if (Object.keys(day).length > 0) next[k] = day;
      changed = true;
    } else {
      next[k] = cache[k];
    }
  }
  if (!changed) return;
  commit(next);

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase
      .from("task_completions")
      .delete()
      .eq("user_id", currentUserId!)
      .eq("task_id", taskId);
    if (error) {
      console.error("[task-completions] clearForTask failed:", error.message);
      commit(prev);
    }
  })();
}

export function pruneOldCompletions(maxDays = PRUNE_DAYS): void {
  ensureInit();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);
  const cutoffKey = dateKey(cutoff);
  const next: CompletionMap = {};
  let changed = false;
  for (const k of Object.keys(cache)) {
    if (k < cutoffKey) {
      changed = true;
    } else {
      next[k] = cache[k];
    }
  }
  if (changed) commit(next);
}

/** Used by cloud-migrate to seed from localStorage. */
export async function bulkInsertCompletions(
  rows: { taskId: string; date: string }[],
): Promise<void> {
  if (!currentUserId || rows.length === 0) return;
  const payload = rows.map((r) => ({
    user_id: currentUserId!,
    task_id: r.taskId,
    date: r.date,
  }));
  const { error } = await supabase
    .from("task_completions")
    .upsert(payload, { onConflict: "user_id,task_id,date" });
  if (error) {
    console.error("[task-completions] bulk insert failed:", error.message);
    return;
  }
  // Mirror to cache.
  const next = { ...cache };
  for (const r of rows) {
    if (!next[r.date]) next[r.date] = {};
    next[r.date][r.taskId] = true;
  }
  commit(next);
}

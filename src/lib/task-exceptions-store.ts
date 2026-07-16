import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/lib/tasks-store";

/**
 * Per-day exception/override store for recurring tasks.
 * Cloud-backed via `task_exceptions`. LocalStorage acts as offline cache.
 *
 * Shape: { [YYYY-MM-DD]: { [taskId]: TaskException } }
 */

const LEGACY_KEY = "dailyos.task-exceptions.v1";
const PRUNE_DAYS = 60;

export interface TaskException {
  skipped?: boolean;
  time?: string;
  endTime?: string;
  title?: string;
  note?: string;
}

type ExceptionMap = Record<string, Record<string, TaskException>>;

let cache: ExceptionMap = {};
let currentUserId: string | null = null;
let initialized = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function loadLocal(): ExceptionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as ExceptionMap) : {};
  } catch {
    return {};
  }
}

function saveLocal(m: ExceptionMap) {
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

function commit(next: ExceptionMap) {
  cache = next;
  saveLocal(next);
  emit();
}

export function subscribeExceptions(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromRow(row: any): { key: string; taskId: string; patch: TaskException } {
  return {
    key: String(row.date),
    taskId: String(row.task_id),
    patch: (row.patch ?? {}) as TaskException,
  };
}

async function loadFromCloud(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("task_exceptions")
    .select("task_id, date, patch")
    .eq("user_id", userId);
  if (error) {
    console.error("[task-exceptions] load failed:", error.message);
    return;
  }
  const next: ExceptionMap = {};
  for (const row of data ?? []) {
    const { key, taskId, patch } = fromRow(row);
    if (!next[key]) next[key] = {};
    next[key][taskId] = patch;
  }
  commit(next);
}

export function useExceptionSync(userId: string | null) {
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

export function getException(
  taskId: string,
  date: Date | string = new Date(),
): TaskException | undefined {
  ensureInit();
  const key = typeof date === "string" ? date : dateKey(date);
  return cache[key]?.[taskId];
}

export function setException(
  taskId: string,
  patch: TaskException,
  date: Date | string = new Date(),
): void {
  ensureInit();
  const key = typeof date === "string" ? date : dateKey(date);
  const prev = cache;
  const dayMap = { ...(cache[key] ?? {}) };
  const merged: TaskException = { ...(dayMap[taskId] ?? {}), ...patch };
  dayMap[taskId] = merged;
  const next = { ...cache, [key]: dayMap };
  commit(next);

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase
      .from("task_exceptions")
      .upsert(
        {
          user_id: currentUserId!,
          task_id: taskId,
          date: key,
          patch: merged as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,task_id,date" },
      );
    if (error) {
      console.error("[task-exceptions] upsert failed:", error.message);
      commit(prev);
    }
  })();
}

export function skipToday(taskId: string, date: Date | string = new Date()): void {
  setException(taskId, { skipped: true }, date);
}

export function clearException(taskId: string, date: Date | string = new Date()): void {
  ensureInit();
  const key = typeof date === "string" ? date : dateKey(date);
  if (!cache[key]?.[taskId]) return;
  const prev = cache;
  const dayMap = { ...(cache[key] ?? {}) };
  delete dayMap[taskId];
  const next = { ...cache };
  if (Object.keys(dayMap).length === 0) delete next[key];
  else next[key] = dayMap;
  commit(next);

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase
      .from("task_exceptions")
      .delete()
      .eq("user_id", currentUserId!)
      .eq("task_id", taskId)
      .eq("date", key);
    if (error) {
      console.error("[task-exceptions] delete failed:", error.message);
      commit(prev);
    }
  })();
}

export function clearExceptionsForTask(taskId: string): void {
  ensureInit();
  const prev = cache;
  const next: ExceptionMap = {};
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
      .from("task_exceptions")
      .delete()
      .eq("user_id", currentUserId!)
      .eq("task_id", taskId);
    if (error) {
      console.error("[task-exceptions] clearForTask failed:", error.message);
      commit(prev);
    }
  })();
}

export function applyException(task: Task, ex: TaskException | undefined): Task {
  if (!ex) return task;
  return {
    ...task,
    time: ex.time ?? task.time,
    endTime: ex.endTime !== undefined ? (ex.endTime || undefined) : task.endTime,
    title: ex.title ?? task.title,
    note: ex.note !== undefined ? (ex.note || undefined) : task.note,
  };
}

export function pruneOldExceptions(maxDays = PRUNE_DAYS): void {
  ensureInit();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);
  const cutoffKey = dateKey(cutoff);
  const next: ExceptionMap = {};
  let changed = false;
  for (const k of Object.keys(cache)) {
    if (k < cutoffKey) changed = true;
    else next[k] = cache[k];
  }
  if (changed) commit(next);
}

export async function bulkInsertExceptions(
  rows: { taskId: string; date: string; patch: TaskException }[],
): Promise<void> {
  if (!currentUserId || rows.length === 0) return;
  const payload = rows.map((r) => ({
    user_id: currentUserId!,
    task_id: r.taskId,
    date: r.date,
    patch: r.patch as any,
  }));
  const { error } = await supabase
    .from("task_exceptions")
    .upsert(payload, { onConflict: "user_id,task_id,date" });
  if (error) {
    console.error("[task-exceptions] bulk insert failed:", error.message);
    return;
  }
  const next = { ...cache };
  for (const r of rows) {
    if (!next[r.date]) next[r.date] = {};
    next[r.date][r.taskId] = r.patch;
  }
  commit(next);
}

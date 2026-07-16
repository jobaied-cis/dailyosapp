import { useEffect, useMemo as useMemoReact, useReducer, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isCompletedOn,
  setCompletedOn,
  clearCompletionsForTask,
  clearCompletionsForDay,
  getCompletionsForDay,
  subscribeCompletions,
} from "@/lib/task-completions-store";
import {
  applyException,
  clearException,
  clearExceptionsForTask,
  getException,
  setException,
  skipToday,
  subscribeExceptions,
  type TaskException,
} from "@/lib/task-exceptions-store";
import { archiveRoutineDay } from "@/lib/routine-archive-store";

/**
 * Cloud-backed routine tasks store.
 * Local cache mirrored to localStorage under the legacy key so offline
 * reads keep working. Mutations follow the events-store pattern:
 * optimistic cache update → Supabase write → rollback on error.
 *
 * NOTE: the `tasks` table intentionally has no `completed` column.
 * Completion (for both recurring and one-off tasks) lives in
 * `task_completions` keyed by date. The `completed` field on the Task
 * type below is a derived overlay, never persisted to the tasks row.
 */

export type Repeat =
  | "none"
  | "daily"
  | "weekdays"
  | "weekends"
  | { days: number[] };

export interface Task {
  id: string;
  time: string;
  endTime?: string;
  title: string;
  note?: string;
  completed: boolean; // derived from task_completions
  repeat?: Repeat;
  /** Calendar date for one-off tasks (YYYY-MM-DD). Undefined for recurring. */
  date?: string;
  priority?: string;
  category?: string;
}

const LEGACY_KEY = "dailyos.tasks.v1";
const MIN_TITLE_LEN = 2;

function isValidTitle(s: string | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (t.length < MIN_TITLE_LEN) return false;
  return /[\p{L}\p{N}]/u.test(t);
}

const listeners = new Set<() => void>();
let cache: Task[] = [];
let currentUserId: string | null = null;
let initialized = false;

function emit() {
  listeners.forEach((l) => l());
}

function loadLocal(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(next: Task[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(next));
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

function commit(next: Task[]) {
  cache = next;
  saveLocal(next);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  ensureInit();
  return cache;
}

const EMPTY_TASKS: Task[] = [];
function getServerSnapshot(): Task[] {
  return EMPTY_TASKS;
}

function todayDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromRow(row: any): Task {
  const repeatRaw = row.repeat;
  let repeat: Repeat | undefined;
  if (repeatRaw && typeof repeatRaw === "object") {
    if (Array.isArray((repeatRaw as any).days)) {
      repeat = { days: ((repeatRaw as any).days as number[]).filter((n) => Number.isFinite(n)) };
    }
  } else if (typeof repeatRaw === "string") {
    if (repeatRaw === "daily" || repeatRaw === "weekdays" || repeatRaw === "weekends") {
      repeat = repeatRaw;
    }
  }
  return {
    id: String(row.id),
    time: String(row.time ?? ""),
    endTime: row.end_time ? String(row.end_time) : undefined,
    title: String(row.title ?? ""),
    note: row.note ? String(row.note) : undefined,
    completed: false,
    repeat,
    date: row.date ? String(row.date) : undefined,
    priority: row.priority ? String(row.priority) : undefined,
    category: row.category ? String(row.category) : undefined,
  };
}

function toRow(t: Task, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    title: t.title,
    note: t.note ?? null,
    time: t.time,
    end_time: t.endTime ?? null,
    repeat: (t.repeat ?? null) as any,
    date: t.date ?? null,
    priority: t.priority ?? null,
    category: t.category ?? null,
  };
}

async function loadFromCloud(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId);
  if (error) {
    console.error("[tasks] load failed:", error.message);
    return;
  }
  commit((data ?? []).map(fromRow));
}

export function useTasksSync(userId: string | null) {
  useEffect(() => {
    if (userId === currentUserId) return;
    currentUserId = userId;
    if (!userId) {
      commit([]);
      return;
    }
    void loadFromCloud(userId);
  }, [userId]);
}

/* ---------------------------- selectors ---------------------------- */

export function getAllRawTasks(): Task[] {
  ensureInit();
  return cache;
}

export function useAllRawTasks(): Task[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function taskShowsOnWeekday(t: Task, weekday: number): boolean {
  const r = t.repeat;
  if (!r || r === "none") return true;
  if (r === "daily") return true;
  if (r === "weekdays") return weekday >= 1 && weekday <= 5;
  if (r === "weekends") return weekday === 0 || weekday === 6;
  if (typeof r === "object" && Array.isArray(r.days)) {
    return r.days.includes(weekday);
  }
  return true;
}

function isRecurring(t: Task | undefined): boolean {
  if (!t) return false;
  const r = t.repeat;
  if (!r || r === "none") return false;
  if (r === "daily" || r === "weekdays" || r === "weekends") return true;
  if (typeof r === "object" && Array.isArray(r.days) && r.days.length > 0) return true;
  return false;
}

function getTasksForDate(tasks: Task[], dateKey: string): Task[] {
  const d = new Date(dateKey + "T00:00:00");
  const weekday = d.getDay();

  const out: Task[] = [];
  for (const raw of tasks) {
    if (!taskShowsOnWeekday(raw, weekday)) continue;
    const recurring = isRecurring(raw);
    // Future-dated one-off tasks stay hidden until their day arrives.
    if (!recurring && raw.date && raw.date !== dateKey) continue;
    const ex = recurring ? getException(raw.id, dateKey) : undefined;
    if (ex?.skipped) continue;
    const withException = ex ? applyException(raw, ex) : raw;
    // Completion always comes from task_completions now (for both flavors).
    const completionKey = recurring ? dateKey : (raw.date || dateKey);
    const completed = isCompletedOn(raw.id, completionKey);
    out.push({ ...withException, completed });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

export function useTasks(): Task[] {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [version, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const u1 = subscribeCompletions(force);
    const u2 = subscribeExceptions(force);
    return () => {
      u1();
      u2();
    };
  }, []);

  return useMemoReact(() => getTasksForDate(tasks, todayDateKey()), [tasks, version]);
}

export function useTasksForDate(dateKey: string): Task[] {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [version, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const u1 = subscribeCompletions(force);
    const u2 = subscribeExceptions(force);
    return () => {
      u1();
      u2();
    };
  }, []);

  return useMemoReact(() => getTasksForDate(tasks, dateKey), [tasks, version, dateKey]);
}

/* ---------------------------- mutations ---------------------------- */

export function toggleTask(id: string) {
  ensureInit();
  const t = cache.find((x) => x.id === id);
  if (!t) return;
  const recurring = isRecurring(t);
  const dateKey = recurring ? todayDateKey() : (t.date || todayDateKey());
  const wasDone = isCompletedOn(id, dateKey);
  setCompletedOn(id, !wasDone, dateKey);
  if (!wasDone) {
    void import("@/lib/memory-store").then(({ logMemory }) =>
      logMemory({ type: "task", meta: `done:${t.title}` }),
    );
  }
}

export function addTask(input: {
  time: string;
  endTime?: string;
  title: string;
  note?: string;
  repeat?: Repeat;
  date?: string;
}) {
  ensureInit();
  if (!isValidTitle(input.title)) return;
  const recurring = input.repeat && input.repeat !== "none";
  const task: Task = {
    id: crypto.randomUUID(),
    time: input.time,
    endTime: input.endTime || undefined,
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    completed: false,
    repeat: recurring ? input.repeat : undefined,
    date: !recurring ? (input.date || todayDateKey()) : undefined,
  };
  const prev = cache;
  commit([...cache, task]);

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("tasks").insert(toRow(task, currentUserId!));
    if (error) {
      console.error("[tasks] insert failed:", error.message);
      commit(prev);
    }
  })();
}

export function deleteTask(id: string) {
  ensureInit();
  const prev = cache;
  commit(cache.filter((t) => t.id !== id));
  clearCompletionsForTask(id);
  clearExceptionsForTask(id);

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      console.error("[tasks] delete failed:", error.message);
      commit(prev);
    }
  })();
}

export function resetDay() {
  ensureInit();
  clearCompletionsForDay(todayDateKey());
}

let startNewDayInFlight = false;
let lastStartNewDayKey: string | null = null;

export function startNewRoutineDay(): void {
  ensureInit();
  if (typeof window === "undefined") return;
  if (startNewDayInFlight) return;

  const today = new Date();
  const weekday = today.getDay();
  const dateKey = todayDateKey(today);

  if (lastStartNewDayKey === dateKey) return;

  startNewDayInFlight = true;
  try {
    const completedIds = new Set(getCompletionsForDay(dateKey));
    const snapshot: Task[] = [];
    const oneOffToDelete: string[] = [];
    for (const raw of cache) {
      if (!taskShowsOnWeekday(raw, weekday)) continue;
      const recurring = isRecurring(raw);
      if (!recurring && raw.date && raw.date !== dateKey) continue;
      const completionKey = recurring ? dateKey : (raw.date || dateKey);
      const completed = isCompletedOn(raw.id, completionKey) || completedIds.has(raw.id);
      snapshot.push({ ...raw, completed });
      if (!recurring && completed) oneOffToDelete.push(raw.id);
    }
    const done = snapshot.filter((t) => t.completed).length;
    archiveRoutineDay({
      dateKey,
      archivedAt: new Date().toISOString(),
      tasks: snapshot,
      done,
      total: snapshot.length,
    });

    // Wipe today's completion overlay (untick recurring tasks for the new day).
    clearCompletionsForDay(dateKey);

    // Delete completed one-off tasks from the active list.
    if (oneOffToDelete.length > 0) {
      const nextCache = cache.filter((t) => !oneOffToDelete.includes(t.id));
      commit(nextCache);
      if (currentUserId) {
        void (async () => {
          const { error } = await supabase
            .from("tasks")
            .delete()
            .in("id", oneOffToDelete);
          if (error) console.error("[tasks] startNewDay cleanup failed:", error.message);
        })();
      }
    }

    lastStartNewDayKey = dateKey;
  } finally {
    startNewDayInFlight = false;
  }
}

export function editTask(id: string, updates: Partial<Omit<Task, "id" | "completed">>) {
  ensureInit();
  if (updates.title !== undefined && !isValidTitle(updates.title)) return;
  const prev = cache;
  let updatedRow: Task | null = null;
  const next = cache.map((t) => {
    if (t.id !== id) return t;
    const merged: Task = {
      ...t,
      time: updates.time ?? t.time,
      endTime: updates.endTime !== undefined ? (updates.endTime || undefined) : t.endTime,
      title: updates.title !== undefined ? updates.title.trim() : t.title,
      note: updates.note !== undefined ? (updates.note?.trim() || undefined) : t.note,
      repeat:
        updates.repeat !== undefined
          ? updates.repeat && updates.repeat !== "none"
            ? updates.repeat
            : undefined
          : t.repeat,
      date: updates.date !== undefined ? updates.date : t.date,
      priority: updates.priority !== undefined ? updates.priority : t.priority,
      category: updates.category !== undefined ? updates.category : t.category,
    };
    updatedRow = merged;
    return merged;
  });
  commit(next);

  if (!currentUserId || !updatedRow) return;
  void (async () => {
    const patch = toRow(updatedRow!, currentUserId!);
    const { error } = await supabase
      .from("tasks")
      .update({
        title: patch.title,
        note: patch.note,
        time: patch.time,
        end_time: patch.end_time,
        repeat: patch.repeat,
        date: patch.date,
        priority: patch.priority,
        category: patch.category,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      console.error("[tasks] update failed:", error.message);
      commit(prev);
    }
  })();
}

export function editTaskToday(
  id: string,
  updates: Pick<TaskException, "time" | "endTime" | "title" | "note">,
) {
  ensureInit();
  const t = cache.find((x) => x.id === id);
  if (!t) return;
  if (!isRecurring(t)) {
    editTask(id, updates);
    return;
  }
  if (updates.title !== undefined && !isValidTitle(updates.title)) return;
  const patch: TaskException = {};
  if (updates.time !== undefined) patch.time = updates.time;
  if (updates.endTime !== undefined) patch.endTime = updates.endTime || undefined;
  if (updates.title !== undefined) patch.title = updates.title.trim();
  if (updates.note !== undefined) patch.note = updates.note?.trim() || undefined;
  setException(id, patch, todayDateKey());
}

export function editTaskFuture(
  id: string,
  updates: Partial<Omit<Task, "id" | "completed">>,
) {
  editTask(id, updates);
}

export function skipTaskToday(id: string) {
  ensureInit();
  const t = cache.find((x) => x.id === id);
  if (!t || !isRecurring(t)) return;
  skipToday(id, todayDateKey());
}

export function clearTaskTodayOverride(id: string) {
  clearException(id, todayDateKey());
}

export function getTodayCompletion(visibleTasks: Task[]): {
  total: number;
  done: number;
  pct: number;
} {
  const total = visibleTasks.length;
  const done = visibleTasks.filter((t) => t.completed).length;
  const pct = total > 0 ? done / total : 0;
  return { total, done, pct };
}

/** Used by cloud-migrate to seed from localStorage. */
export async function bulkInsertTasks(rows: Task[]): Promise<void> {
  if (!currentUserId || rows.length === 0) return;
  const payload = rows.map((t) => toRow(t, currentUserId!));
  const { data, error } = await supabase.from("tasks").insert(payload).select();
  if (error) {
    console.error("[tasks] bulk insert failed:", error.message);
    return;
  }
  commit([...cache, ...(data ?? []).map(fromRow)]);
}

import { useEffect, useMemo as useMemoReact, useReducer, useSyncExternalStore } from "react";
import {
  isCompletedOn,
  setCompletedOn,
  clearCompletionsForTask,
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

/**
 * Repeat rule for a task.
 * - undefined / "none": one-off task (always visible).
 * - "daily": shows every day.
 * - "weekdays": shows Mon–Fri.
 * - { days: number[] }: custom — 0=Sun … 6=Sat.
 */
export type Repeat =
  | "none"
  | "daily"
  | "weekdays"
  | "weekends"
  | { days: number[] };

export interface Task {
  id: string;
  time: string; // "HH:MM"
  endTime?: string; // "HH:MM" optional
  title: string;
  note?: string;
  completed: boolean;
  repeat?: Repeat;
}

const STORAGE_KEY = "dailyos.tasks.v1";
const SEED: Task[] = [];
const MIN_TITLE_LEN = 2;

function isValidTitle(s: string | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (t.length < MIN_TITLE_LEN) return false;
  return /[\p{L}\p{N}]/u.test(t);
}

const listeners = new Set<() => void>();
let cache: Task[] = [];
let initialized = false;

function load(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return SEED;
    }
    return JSON.parse(raw) as Task[];
  } catch {
    return SEED;
  }
}

function persist(next: Task[]) {
  cache = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function ensureInit() {
  if (!initialized && typeof window !== "undefined") {
    cache = load();
    initialized = true;
  }
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

/** Does this task's repeat rule include the given weekday? (0=Sun … 6=Sat) */
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

function todayDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Returns today's visible tasks with:
 *  - per-day completion overlay (recurring tasks)
 *  - per-day exception overlay (edit-only-today + skip-today)
 *  - one-off tasks keep their existing `completed` boolean.
 */
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

  // Memoize derivation so render-pass identity is stable when nothing changed.
  return useMemoReact(() => {
    const today = new Date();
    const weekday = today.getDay();
    const dateKey = todayDateKey(today);

    const out: Task[] = [];
    for (const raw of tasks) {
      if (!taskShowsOnWeekday(raw, weekday)) continue;
      const recurring = isRecurring(raw);
      const ex = recurring ? getException(raw.id, dateKey) : undefined;
      if (ex?.skipped) continue;
      const withException = ex ? applyException(raw, ex) : raw;
      const completed = recurring ? isCompletedOn(raw.id, dateKey) : raw.completed;
      out.push({ ...withException, completed });
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  }, [tasks, version]);
}

export function toggleTask(id: string) {
  ensureInit();
  const t = cache.find((x) => x.id === id);
  if (t && isRecurring(t)) {
    const dateKey = todayDateKey();
    const wasDone = isCompletedOn(id, dateKey);
    setCompletedOn(id, !wasDone, dateKey);
    if (!wasDone) {
      void import("@/lib/memory-store").then(({ logMemory }) =>
        logMemory({ type: "task", meta: `done:${t.title}` }),
      );
    }
    return;
  }
  const target = cache.find((x) => x.id === id);
  persist(cache.map((x) => (x.id === id ? { ...x, completed: !x.completed } : x)));
  if (target && !target.completed) {
    void import("@/lib/memory-store").then(({ logMemory }) =>
      logMemory({ type: "task", meta: `done:${target.title}` }),
    );
  }
}


export function addTask(input: { time: string; endTime?: string; title: string; note?: string; repeat?: Repeat }) {
  ensureInit();
  if (!isValidTitle(input.title)) return;
  const task: Task = {
    id: crypto.randomUUID(),
    time: input.time,
    endTime: input.endTime || undefined,
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    completed: false,
    repeat: input.repeat && input.repeat !== "none" ? input.repeat : undefined,
  };
  persist([...cache, task]);
}

export function deleteTask(id: string) {
  ensureInit();
  persist(cache.filter((t) => t.id !== id));
  // Sweep per-day data tied to this id.
  clearCompletionsForTask(id);
  clearExceptionsForTask(id);
}

export function resetDay() {
  ensureInit();
  persist(cache.map((t) => ({ ...t, completed: false })));
}

export function editTask(id: string, updates: Partial<Omit<Task, "id" | "completed">>) {
  ensureInit();
  if (updates.title !== undefined && !isValidTitle(updates.title)) return;
  persist(
    cache.map((t) => {
      if (t.id !== id) return t;
      return {
        ...t,
        time: updates.time ?? t.time,
        endTime: updates.endTime !== undefined ? (updates.endTime || undefined) : t.endTime,
        title: updates.title !== undefined ? updates.title.trim() : t.title,
        note: updates.note !== undefined ? (updates.note?.trim() || undefined) : t.note,
        repeat: updates.repeat !== undefined
          ? (updates.repeat && updates.repeat !== "none" ? updates.repeat : undefined)
          : t.repeat,
      };
    }),
  );
}

/**
 * Edit a recurring task for today only — writes a per-day exception
 * instead of mutating the template. For one-off tasks, falls back to editTask.
 */
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

/** "Edit all future occurrences" — mutates the template. Alias of editTask. */
export function editTaskFuture(
  id: string,
  updates: Partial<Omit<Task, "id" | "completed">>,
) {
  editTask(id, updates);
}

/** Skip a recurring task for today only. No-op for one-off tasks. */
export function skipTaskToday(id: string) {
  ensureInit();
  const t = cache.find((x) => x.id === id);
  if (!t || !isRecurring(t)) return;
  skipToday(id, todayDateKey());
}

/** Undo a previous "skip today" or "edit only today" change. */
export function clearTaskTodayOverride(id: string) {
  clearException(id, todayDateKey());
}

/**
 * Pure helper: derive today's completion stats from the rendered list
 * (i.e. the result of useTasks()). Counts both recurring and one-off
 * tasks because useTasks() has already overlaid per-day completion.
 */
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

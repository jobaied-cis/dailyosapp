import { useSyncExternalStore } from "react";

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

/** Does this task's repeat rule include the given weekday? */
export function taskShowsOnWeekday(t: Task, weekday: number): boolean {
  const r = t.repeat;
  if (!r || r === "none") return true;
  if (r === "daily") return true;
  if (r === "weekdays") return weekday >= 1 && weekday <= 5;
  if (typeof r === "object" && Array.isArray(r.days)) {
    return r.days.includes(weekday);
  }
  return true;
}

export function useTasks(): Task[] {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const today = new Date().getDay();
  return [...tasks]
    .filter((t) => taskShowsOnWeekday(t, today))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function toggleTask(id: string) {
  ensureInit();
  persist(cache.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
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

import { useSyncExternalStore } from "react";

export interface Task {
  id: string;
  time: string; // "HH:MM"
  endTime?: string; // "HH:MM" optional
  title: string;
  note?: string;
  completed: boolean;
}

const STORAGE_KEY = "dailyos.tasks.v1";
const SEED: Task[] = [
  { id: "s1", time: "07:00", title: "Morning hydration", note: "Big glass of water", completed: false },
  { id: "s2", time: "07:30", title: "Stretch & breathe", note: "10 minutes", completed: false },
  { id: "s3", time: "09:00", title: "Deep work block", completed: false },
  { id: "s4", time: "13:00", title: "Lunch & walk", completed: false },
  { id: "s5", time: "18:00", title: "Workout", note: "Push day", completed: false },
  { id: "s6", time: "21:30", title: "Read 20 pages", completed: false },
];

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

export function useTasks(): Task[] {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [...tasks].sort((a, b) => a.time.localeCompare(b.time));
}

export function toggleTask(id: string) {
  ensureInit();
  persist(cache.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
}

export function addTask(input: { time: string; endTime?: string; title: string; note?: string }) {
  ensureInit();
  const task: Task = {
    id: crypto.randomUUID(),
    time: input.time,
    endTime: input.endTime || undefined,
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    completed: false,
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
  persist(
    cache.map((t) => {
      if (t.id !== id) return t;
      return {
        ...t,
        time: updates.time ?? t.time,
        endTime: updates.endTime !== undefined ? (updates.endTime || undefined) : t.endTime,
        title: updates.title !== undefined ? updates.title.trim() : t.title,
        note: updates.note !== undefined ? (updates.note?.trim() || undefined) : t.note,
      };
    }),
  );
}

import { useEffect, useState, useSyncExternalStore } from "react";

export interface MissionTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

export interface Mission {
  id: string;
  title: string;
  createdAt: number;
  tasks: MissionTask[];
}

const STORAGE_KEY = "dailyos.missions.v2";

const listeners = new Set<() => void>();
let cache: Mission[] = [];
let initialized = false;

function load(): Mission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m: any) => ({
      id: String(m.id),
      title: String(m.title ?? ""),
      createdAt: Number(m.createdAt) || Date.now(),
      tasks: Array.isArray(m.tasks)
        ? m.tasks.map((t: any) => ({
            id: String(t.id),
            title: String(t.title ?? ""),
            completed: Boolean(t.completed),
            createdAt: Number(t.createdAt) || Date.now(),
          }))
        : [],
    }));
  } catch {
    return [];
  }
}

function persist(next: Mission[]) {
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

function getServerSnapshot(): Mission[] {
  return [];
}

export function useMissions(): Mission[] {
  const missions = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated ? missions : [];
}

export function useMission(id: string): Mission | undefined {
  return useMissions().find((m) => m.id === id);
}

export function addMission(title: string): string {
  ensureInit();
  const mission: Mission = {
    id: crypto.randomUUID(),
    title: title.trim(),
    createdAt: Date.now(),
    tasks: [],
  };
  persist([...cache, mission]);
  return mission.id;
}

export function deleteMission(id: string) {
  ensureInit();
  persist(cache.filter((m) => m.id !== id));
}

export function addTask(missionId: string, title: string) {
  ensureInit();
  const task: MissionTask = {
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false,
    createdAt: Date.now(),
  };
  persist(
    cache.map((m) =>
      m.id === missionId ? { ...m, tasks: [...m.tasks, task] } : m,
    ),
  );
}

export function toggleTask(missionId: string, taskId: string) {
  ensureInit();
  persist(
    cache.map((m) =>
      m.id === missionId
        ? {
            ...m,
            tasks: m.tasks.map((t) =>
              t.id === taskId ? { ...t, completed: !t.completed } : t,
            ),
          }
        : m,
    ),
  );
}

export function deleteTask(missionId: string, taskId: string) {
  ensureInit();
  persist(
    cache.map((m) =>
      m.id === missionId
        ? { ...m, tasks: m.tasks.filter((t) => t.id !== taskId) }
        : m,
    ),
  );
}

export function missionProgress(m: Mission) {
  const total = m.tasks.length;
  const done = m.tasks.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

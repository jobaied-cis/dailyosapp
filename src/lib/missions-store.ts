import { useEffect, useState, useSyncExternalStore } from "react";

export interface MissionTask {
  id: string;
  missionId: string;
  day: number;
  title: string;
  completed: boolean;
  createdAt: number;
}

export interface Mission {
  id: string;
  title: string;
  createdAt: number;
  days: number;
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
    return parsed.map((m: any) => {
      const id = String(m.id);
      const tasks: MissionTask[] = Array.isArray(m.tasks)
        ? m.tasks.map((t: any) => ({
            id: String(t.id),
            missionId: id,
            day: Number(t.day) > 0 ? Number(t.day) : 1,
            title: String(t.title ?? t.text ?? ""),
            completed: Boolean(t.completed),
            createdAt: Number(t.createdAt) || Date.now(),
          }))
        : [];
      const maxDay = tasks.reduce((a, t) => Math.max(a, t.day), 1);
      return {
        id,
        title: String(m.title ?? ""),
        createdAt: Number(m.createdAt) || Date.now(),
        days: Math.max(Number(m.days) || 1, maxDay),
        tasks,
      };
    });
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
    days: 1,
    tasks: [],
  };
  persist([...cache, mission]);
  return mission.id;
}

export function deleteMission(id: string) {
  ensureInit();
  persist(cache.filter((m) => m.id !== id));
}

export function addDay(missionId: string) {
  ensureInit();
  persist(
    cache.map((m) =>
      m.id === missionId ? { ...m, days: (m.days || 1) + 1 } : m,
    ),
  );
}

export function addTask(missionId: string, title: string, day: number = 1) {
  ensureInit();
  const task: MissionTask = {
    id: crypto.randomUUID(),
    missionId,
    day,
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

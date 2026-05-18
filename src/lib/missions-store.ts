import { useEffect, useState, useSyncExternalStore } from "react";

export interface MissionStep {
  id: string;
  title: string;
  completed: boolean;
}

export interface Mission {
  id: string;
  title: string;
  durationDays?: number;
  /** ISO date string YYYY-MM-DD for Day 1 */
  startDate?: string;
  createdAt: number;
  steps: MissionStep[];
}

const STORAGE_KEY = "dailyos.missions.v1";

const SEED: Mission[] = [
  {
    id: "m1",
    title: "Learn Java in 20 days",
    durationDays: 20,
    createdAt: Date.now(),
    steps: [
      { id: "m1s1", title: "Install JDK & IDE", completed: true },
      { id: "m1s2", title: "Variables & types", completed: true },
      { id: "m1s3", title: "Control flow", completed: false },
      { id: "m1s4", title: "OOP basics", completed: false },
      { id: "m1s5", title: "Build a small project", completed: false },
    ],
  },
];

const listeners = new Set<() => void>();
let cache: Mission[] = [];
let initialized = false;

function load(): Mission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return SEED;
    }
    return JSON.parse(raw) as Mission[];
  } catch {
    return SEED;
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

export function addMission(input: { title: string; durationDays?: number }) {
  ensureInit();
  const mission: Mission = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    durationDays: input.durationDays,
    createdAt: Date.now(),
    steps: [],
  };
  persist([...cache, mission]);
  return mission.id;
}

export function deleteMission(id: string) {
  ensureInit();
  persist(cache.filter((m) => m.id !== id));
}

export function addStep(missionId: string, title: string) {
  ensureInit();
  const step: MissionStep = {
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false,
  };
  persist(
    cache.map((m) =>
      m.id === missionId ? { ...m, steps: [...m.steps, step] } : m,
    ),
  );
}

export function toggleStep(missionId: string, stepId: string) {
  ensureInit();
  persist(
    cache.map((m) =>
      m.id === missionId
        ? {
            ...m,
            steps: m.steps.map((s) =>
              s.id === stepId ? { ...s, completed: !s.completed } : s,
            ),
          }
        : m,
    ),
  );
}

export function deleteStep(missionId: string, stepId: string) {
  ensureInit();
  persist(
    cache.map((m) =>
      m.id === missionId
        ? { ...m, steps: m.steps.filter((s) => s.id !== stepId) }
        : m,
    ),
  );
}

export function missionProgress(m: Mission) {
  const total = m.steps.length;
  const done = m.steps.filter((s) => s.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

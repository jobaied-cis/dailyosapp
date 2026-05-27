import { useEffect, useState, useSyncExternalStore } from "react";

export type EventType = "Exam" | "Meeting" | "Class" | "Personal" | "Other";
export type EventPriority = "High" | "Medium" | "Low";

export interface EventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: EventType;
  priority: EventPriority;
}

const STORAGE_KEY = "dailyos.events.v2";

const listeners = new Set<() => void>();
let cache: EventItem[] = [];
let initialized = false;

function load(): EventItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: any) => ({
      id: String(e.id),
      title: String(e.title ?? ""),
      date: String(e.date ?? ""),
      time: String(e.time ?? ""),
      type: (e.type as EventType) ?? "Other",
      priority: (e.priority as EventPriority) ?? "Medium",
    }));
  } catch {
    return [];
  }
}

function persist(next: EventItem[]) {
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

function getServerSnapshot(): EventItem[] {
  return [];
}

function toEventDateTime(item: EventItem): number {
  if (!item.date) return 0;
  const dt = item.time ? `${item.date}T${item.time}` : `${item.date}T00:00`;
  return new Date(dt).getTime();
}

const priorityWeight: Record<EventPriority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

export function useEvents(): EventItem[] {
  const events = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return [];
  return [...events].sort((a, b) => {
    const ta = toEventDateTime(a);
    const tb = toEventDateTime(b);
    const now = Date.now();
    const aPast = ta < now;
    const bPast = tb < now;
    if (aPast && !bPast) return 1;
    if (!aPast && bPast) return -1;
    if (aPast && bPast) return tb - ta; // newer past first
    const pa = priorityWeight[a.priority];
    const pb = priorityWeight[b.priority];
    if (pa !== pb) return pa - pb;
    return ta - tb;
  });
}

export function addEvent(input: {
  title: string;
  date: string;
  time: string;
  type: EventType;
  priority: EventPriority;
}) {
  ensureInit();
  const event: EventItem = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    type: input.type,
    priority: input.priority,
  };
  persist([...cache, event]);
}

export function deleteEvent(id: string) {
  ensureInit();
  persist(cache.filter((e) => e.id !== id));
}


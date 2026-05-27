import { useEffect, useState, useSyncExternalStore } from "react";

export type EventType = "Exam" | "Meeting" | "Class" | "Personal" | "Other";
export type EventPriority = "High" | "Medium" | "Low";
export type EventStatus = "upcoming" | "completed" | "missed";

export interface EventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: EventType;
  priority: EventPriority;
  completed: boolean;
  notes: string;
}

const STORAGE_KEY = "dailyos.events.v4";

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
      completed: Boolean(e.completed),
      notes: String(e.notes ?? ""),
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

export function getEventStatus(item: EventItem, now: number): EventStatus {
  if (item.completed) return "completed";
  const t = toEventDateTime(item);
  if (t < now) return "missed";
  return "upcoming";
}

const statusWeight: Record<EventStatus, number> = {
  upcoming: 0,
  completed: 1,
  missed: 2,
};

export function useEvents(): EventItem[] {
  const events = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return [];
  const now = Date.now();
  return [...events].sort((a, b) => {
    const sa = getEventStatus(a, now);
    const sb = getEventStatus(b, now);
    if (sa !== sb) return statusWeight[sa] - statusWeight[sb];
    // Same status
    const ta = toEventDateTime(a);
    const tb = toEventDateTime(b);
    if (sa === "upcoming") {
      const pa = priorityWeight[a.priority];
      const pb = priorityWeight[b.priority];
      if (pa !== pb) return pa - pb;
      return ta - tb; // nearest upcoming first
    }
    // completed or missed: newest first
    return tb - ta;
  });
}

export function addEvent(input: {
  title: string;
  date: string;
  time: string;
  type: EventType;
  priority: EventPriority;
  notes: string;
}) {
  ensureInit();
  const event: EventItem = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    type: input.type,
    priority: input.priority,
    completed: false,
    notes: input.notes.trim(),
  };
  persist([...cache, event]);
}

export function deleteEvent(id: string) {
  ensureInit();
  persist(cache.filter((e) => e.id !== id));
}

export function toggleEventCompletion(id: string) {
  ensureInit();
  persist(
    cache.map((e) =>
      e.id === id ? { ...e, completed: !e.completed } : e
    )
  );
}

export function updateEvent(id: string, input: {
  title: string;
  date: string;
  time: string;
  type: EventType;
  priority: EventPriority;
  notes: string;
}) {
  ensureInit();
  persist(
    cache.map((e) =>
      e.id === id
        ? {
            ...e,
            title: input.title.trim(),
            date: input.date,
            time: input.time,
            type: input.type,
            priority: input.priority,
            notes: input.notes.trim(),
          }
        : e
    )
  );
}

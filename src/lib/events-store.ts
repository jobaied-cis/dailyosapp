import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const listeners = new Set<() => void>();
let cache: EventItem[] = [];
let currentUserId: string | null = null;
let loadPromise: Promise<void> | null = null;

function fromRow(row: any): EventItem {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    date: String(row.date ?? ""),
    time: String(row.time ?? ""),
    type: (row.type as EventType) ?? "Other",
    priority: (row.priority as EventPriority) ?? "Medium",
    completed: Boolean(row.completed),
    notes: String(row.notes ?? ""),
  };
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return cache;
}

const EMPTY: EventItem[] = [];
function getServerSnapshot(): EventItem[] {
  return EMPTY;
}

async function loadFromCloud(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId);
  if (error) {
    console.error("[events] load failed:", error.message);
    return;
  }
  cache = (data ?? []).map(fromRow);
  emit();
}

/** Wire to current Supabase session — call from a top-level effect. */
export function useEventsSync(userId: string | null) {
  useEffect(() => {
    if (userId === currentUserId) return;
    currentUserId = userId;
    cache = [];
    emit();
    if (!userId) {
      loadPromise = null;
      return;
    }
    loadPromise = loadFromCloud(userId);
  }, [userId]);
}

function toEventDateTime(item: EventItem): number {
  if (!item.date) return 0;
  const dt = item.time ? `${item.date}T${item.time}` : `${item.date}T00:00`;
  return new Date(dt).getTime();
}

const priorityWeight: Record<EventPriority, number> = { High: 0, Medium: 1, Low: 2 };
const statusWeight: Record<EventStatus, number> = { upcoming: 0, completed: 1, missed: 2 };

export function getEventStatus(item: EventItem, now: number): EventStatus {
  if (item.completed) return "completed";
  return toEventDateTime(item) < now ? "missed" : "upcoming";
}

export function useEvents(): EventItem[] {
  const events = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (events.length === 0) return EMPTY;
  const now = Date.now();
  return [...events].sort((a, b) => {
    const sa = getEventStatus(a, now);
    const sb = getEventStatus(b, now);
    if (sa !== sb) return statusWeight[sa] - statusWeight[sb];
    const ta = toEventDateTime(a);
    const tb = toEventDateTime(b);
    if (sa === "upcoming") {
      const pa = priorityWeight[a.priority];
      const pb = priorityWeight[b.priority];
      if (pa !== pb) return pa - pb;
      return ta - tb;
    }
    return tb - ta;
  });
}

export async function addEvent(input: {
  title: string;
  date: string;
  time: string;
  type: EventType;
  priority: EventPriority;
  notes: string;
}): Promise<void> {
  if (!currentUserId) return;
  const row = {
    user_id: currentUserId,
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    type: input.type,
    priority: input.priority,
    completed: false,
    notes: input.notes.trim(),
  };
  const { data, error } = await supabase.from("events").insert(row).select().single();
  if (error || !data) {
    console.error("[events] add failed:", error?.message);
    return;
  }
  cache = [...cache, fromRow(data)];
  emit();
}

export async function deleteEvent(id: string): Promise<void> {
  const prev = cache;
  cache = cache.filter((e) => e.id !== id);
  emit();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    console.error("[events] delete failed:", error.message);
    cache = prev;
    emit();
  }
}

export async function toggleEventCompletion(id: string): Promise<void> {
  const t = cache.find((e) => e.id === id);
  if (!t) return;
  const next = !t.completed;
  cache = cache.map((e) => (e.id === id ? { ...e, completed: next } : e));
  emit();
  const { error } = await supabase.from("events").update({ completed: next }).eq("id", id);
  if (error) {
    console.error("[events] toggle failed:", error.message);
    cache = cache.map((e) => (e.id === id ? { ...e, completed: t.completed } : e));
    emit();
  }
}

export async function updateEvent(
  id: string,
  input: {
    title: string;
    date: string;
    time: string;
    type: EventType;
    priority: EventPriority;
    notes: string;
  },
): Promise<void> {
  const patch = {
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    type: input.type,
    priority: input.priority,
    notes: input.notes.trim(),
  };
  const prev = cache;
  cache = cache.map((e) => (e.id === id ? { ...e, ...patch } : e));
  emit();
  const { error } = await supabase.from("events").update(patch).eq("id", id);
  if (error) {
    console.error("[events] update failed:", error.message);
    cache = prev;
    emit();
  }
}

/** Used by cloud-migrate to seed from localStorage. */
export async function bulkInsertEvents(rows: Omit<EventItem, "id">[]): Promise<void> {
  if (!currentUserId || rows.length === 0) return;
  const payload = rows.map((r) => ({
    user_id: currentUserId!,
    title: r.title,
    date: r.date,
    time: r.time,
    type: r.type,
    priority: r.priority,
    completed: r.completed,
    notes: r.notes,
  }));
  const { data, error } = await supabase.from("events").insert(payload).select();
  if (error) {
    console.error("[events] bulk insert failed:", error.message);
    return;
  }
  cache = [...cache, ...(data ?? []).map(fromRow)];
  emit();
}

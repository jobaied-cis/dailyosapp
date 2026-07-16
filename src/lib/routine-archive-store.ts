import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/lib/tasks-store";

/**
 * Routine day archive. Cloud-backed via `routine_archives`.
 * LocalStorage kept as offline fallback under the legacy key.
 */

const LEGACY_KEY = "dailyos.routine.archive.v1";

export interface ArchivedRoutineDay {
  dateKey: string;
  archivedAt: string;
  tasks: Task[];
  done: number;
  total: number;
}

type ArchiveMap = Record<string, ArchivedRoutineDay[]>;

let cache: ArchiveMap = {};
let currentUserId: string | null = null;
let initialized = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function loadLocal(): ArchiveMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as ArchiveMap) : {};
  } catch {
    return {};
  }
}

function saveLocal(m: ArchiveMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(m));
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

function commit(next: ArchiveMap) {
  cache = next;
  saveLocal(next);
  emit();
}

export function subscribeArchives(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function fromRow(row: any): ArchivedRoutineDay {
  return {
    dateKey: String(row.date_key),
    archivedAt: String(row.archived_at ?? new Date().toISOString()),
    tasks: Array.isArray(row.tasks) ? (row.tasks as Task[]) : [],
    done: Number(row.done) || 0,
    total: Number(row.total) || 0,
  };
}

async function loadFromCloud(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("routine_archives")
    .select("date_key, archived_at, tasks, done, total")
    .eq("user_id", userId);
  if (error) {
    console.error("[routine-archives] load failed:", error.message);
    return;
  }
  const next: ArchiveMap = {};
  for (const row of data ?? []) {
    const entry = fromRow(row);
    if (!next[entry.dateKey]) next[entry.dateKey] = [];
    next[entry.dateKey].push(entry);
  }
  commit(next);
}

export function useArchiveSync(userId: string | null) {
  useEffect(() => {
    if (userId === currentUserId) return;
    currentUserId = userId;
    if (!userId) {
      commit({});
      return;
    }
    void loadFromCloud(userId);
  }, [userId]);
}

export function archiveRoutineDay(entry: ArchivedRoutineDay): void {
  ensureInit();
  const prev = cache;
  const list = cache[entry.dateKey] ?? [];
  const next = { ...cache, [entry.dateKey]: [...list, entry] };
  commit(next);

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("routine_archives").insert({
      user_id: currentUserId!,
      date_key: entry.dateKey,
      archived_at: entry.archivedAt,
      tasks: entry.tasks as any,
      done: entry.done,
      total: entry.total,
    });
    if (error) {
      console.error("[routine-archives] insert failed:", error.message);
      commit(prev);
    }
  })();
}

export function getArchivedDays(dateKey: string): ArchivedRoutineDay[] {
  ensureInit();
  return cache[dateKey] ?? [];
}

export function readAllArchives(): ArchiveMap {
  ensureInit();
  return cache;
}

export async function bulkInsertArchives(rows: ArchivedRoutineDay[]): Promise<void> {
  if (!currentUserId || rows.length === 0) return;
  const payload = rows.map((r) => ({
    user_id: currentUserId!,
    date_key: r.dateKey,
    archived_at: r.archivedAt,
    tasks: r.tasks as any,
    done: r.done,
    total: r.total,
  }));
  const { data, error } = await supabase.from("routine_archives").insert(payload).select();
  if (error) {
    console.error("[routine-archives] bulk insert failed:", error.message);
    return;
  }
  const next = { ...cache };
  for (const row of data ?? []) {
    const entry = fromRow(row);
    if (!next[entry.dateKey]) next[entry.dateKey] = [];
    next[entry.dateKey].push(entry);
  }
  commit(next);
}

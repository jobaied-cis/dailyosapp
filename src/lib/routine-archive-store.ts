/**
 * Routine day archive.
 *
 * When the user taps "Start New Day", we snapshot the finished routine
 * day's tasks (with completion status) into this store, keyed by routine
 * date. The active tasks-store is then reset to a fresh day.
 *
 * This store is display / history only — statistics, streaks, and the
 * daily-summary store continue to key off their own persisted data and
 * are unaffected. Archived tasks are never deleted implicitly.
 */

import type { Task } from "@/lib/tasks-store";

const KEY = "dailyos.routine.archive.v1";

export interface ArchivedRoutineDay {
  /** Routine day this archive belongs to (YYYY-MM-DD). */
  dateKey: string;
  /** When the user tapped "Start New Day". */
  archivedAt: string; // ISO timestamp
  /** Snapshot of tasks that were part of the archived day, with their final completion state. */
  tasks: Task[];
  /** Convenience stats snapshot. */
  done: number;
  total: number;
}

type ArchiveMap = Record<string, ArchivedRoutineDay[]>;

function read(): ArchiveMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ArchiveMap) : {};
  } catch {
    return {};
  }
}

function write(m: ArchiveMap) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(m));
}

export function archiveRoutineDay(entry: ArchivedRoutineDay): void {
  const m = read();
  const list = m[entry.dateKey] ?? [];
  list.push(entry);
  m[entry.dateKey] = list;
  write(m);
}

export function getArchivedDays(dateKey: string): ArchivedRoutineDay[] {
  return read()[dateKey] ?? [];
}

export function readAllArchives(): ArchiveMap {
  return read();
}

/**
 * Per-day exception/override store for recurring tasks.
 *
 * Used for:
 *   - "Edit only today"  → store a partial override for one date.
 *   - "Skip today"       → mark { skipped: true } for one date.
 *
 * Does NOT mutate the original Task template. The Routine selector
 * overlays today's exception onto the template before rendering.
 *
 * Shape: { [YYYY-MM-DD]: { [taskId]: TaskException } }
 */

import type { Task } from "@/lib/tasks-store";

const KEY = "dailyos.task-exceptions.v1";
const PRUNE_DAYS = 60;

export interface TaskException {
  skipped?: boolean;
  time?: string;
  endTime?: string;
  title?: string;
  note?: string;
}

type ExceptionMap = Record<string, Record<string, TaskException>>;

function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function read(): ExceptionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ExceptionMap) : {};
  } catch {
    return {};
  }
}

function write(m: ExceptionMap) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(m));
}

export function getException(taskId: string, date: Date | string = new Date()): TaskException | undefined {
  const key = typeof date === "string" ? date : dateKey(date);
  return read()[key]?.[taskId];
}

export function setException(
  taskId: string,
  patch: TaskException,
  date: Date | string = new Date(),
): void {
  const key = typeof date === "string" ? date : dateKey(date);
  const m = read();
  const day = { ...(m[key] ?? {}) };
  day[taskId] = { ...(day[taskId] ?? {}), ...patch };
  m[key] = day;
  write(m);
}

export function skipToday(taskId: string, date: Date | string = new Date()): void {
  setException(taskId, { skipped: true }, date);
}

export function clearException(taskId: string, date: Date | string = new Date()): void {
  const key = typeof date === "string" ? date : dateKey(date);
  const m = read();
  if (!m[key]) return;
  delete m[key][taskId];
  if (Object.keys(m[key]).length === 0) delete m[key];
  write(m);
}

/** Drop all exceptions for a deleted task (used when a series is removed). */
export function clearExceptionsForTask(taskId: string): void {
  const m = read();
  let changed = false;
  for (const k of Object.keys(m)) {
    if (m[k][taskId]) {
      delete m[k][taskId];
      changed = true;
      if (Object.keys(m[k]).length === 0) delete m[k];
    }
  }
  if (changed) write(m);
}

/** Apply an exception overlay to a Task (pure, returns a new object). */
export function applyException(task: Task, ex: TaskException | undefined): Task {
  if (!ex) return task;
  return {
    ...task,
    time: ex.time ?? task.time,
    endTime: ex.endTime !== undefined ? (ex.endTime || undefined) : task.endTime,
    title: ex.title ?? task.title,
    note: ex.note !== undefined ? (ex.note || undefined) : task.note,
  };
}

/** Drop exception entries older than PRUNE_DAYS. */
export function pruneOldExceptions(maxDays = PRUNE_DAYS): void {
  const m = read();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);
  const cutoffKey = dateKey(cutoff);
  let changed = false;
  for (const k of Object.keys(m)) {
    if (k < cutoffKey) {
      delete m[k];
      changed = true;
    }
  }
  if (changed) write(m);
}

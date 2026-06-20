/**
 * Per-day completion store for RECURRING tasks only.
 *
 * One-off tasks (no `repeat` rule) continue to use the existing
 * `Task.completed` boolean in tasks-store.ts. This store is additive
 * and does NOT touch that behavior.
 *
 * Shape: { [YYYY-MM-DD]: { [taskId]: true } }
 */

const KEY = "dailyos.task-completions.v1";
const PRUNE_DAYS = 60;

type CompletionMap = Record<string, Record<string, true>>;

function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function read(): CompletionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CompletionMap) : {};
  } catch {
    return {};
  }
}

function write(m: CompletionMap) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(m));
}

export function isCompletedOn(taskId: string, date: Date | string = new Date()): boolean {
  const key = typeof date === "string" ? date : dateKey(date);
  const m = read();
  return Boolean(m[key]?.[taskId]);
}

export function setCompletedOn(taskId: string, value: boolean, date: Date | string = new Date()): void {
  const key = typeof date === "string" ? date : dateKey(date);
  const m = read();
  const day = { ...(m[key] ?? {}) };
  if (value) {
    day[taskId] = true;
  } else {
    delete day[taskId];
  }
  if (Object.keys(day).length === 0) {
    delete m[key];
  } else {
    m[key] = day;
  }
  write(m);
}

export function toggleCompletedOn(taskId: string, date: Date | string = new Date()): boolean {
  const current = isCompletedOn(taskId, date);
  setCompletedOn(taskId, !current, date);
  return !current;
}

/** Remove all completion entries for the given task (used when a series is deleted). */
export function clearCompletionsForTask(taskId: string): void {
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

/** Drop entries older than PRUNE_DAYS. Safe to call on app open. */
export function pruneOldCompletions(maxDays = PRUNE_DAYS): void {
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

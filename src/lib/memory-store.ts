/**
 * DailyOS — lightweight Memory store (localStorage only).
 * Tracks last 14 days of user activity for the Memory AI.
 * In-memory cache avoids repeated JSON.parse on every read.
 */

export type MemoryType = "task" | "expense" | "event";

export interface MemoryEntry {
  type: MemoryType;
  time: number; // ms since epoch
  meta?: string;
}

export interface MemoryShape {
  taskHistory: MemoryEntry[];
  expenseHistory: MemoryEntry[];
  activityLog: MemoryEntry[];
}

const STORAGE_KEY = "dailyos.memory";
const MAX_DAYS = 14;
const MAX_ENTRIES_PER_LIST = 300;

let _cache: MemoryShape | null = null;
let _cacheAt = 0;
const CACHE_TTL = 30_000;

function hasWindow() {
  return typeof window !== "undefined";
}

function emptyShape(): MemoryShape {
  return { taskHistory: [], expenseHistory: [], activityLog: [] };
}

function pruneList(list: MemoryEntry[], cutoff: number): MemoryEntry[] {
  const recent = list.filter((e) => e.time >= cutoff);
  if (recent.length > MAX_ENTRIES_PER_LIST) {
    return recent.slice(-MAX_ENTRIES_PER_LIST);
  }
  return recent;
}

function loadFromStorage(): MemoryShape {
  if (!hasWindow()) return emptyShape();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyShape();
    const parsed = JSON.parse(raw) as Partial<MemoryShape>;
    const cutoff = Date.now() - MAX_DAYS * 86400000;
    return {
      taskHistory: pruneList(parsed.taskHistory ?? [], cutoff),
      expenseHistory: pruneList(parsed.expenseHistory ?? [], cutoff),
      activityLog: pruneList(parsed.activityLog ?? [], cutoff),
    };
  } catch {
    return emptyShape();
  }
}

export function readMemory(): MemoryShape {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL) return _cache;
  _cache = loadFromStorage();
  _cacheAt = now;
  return _cache;
}

export function invalidateMemoryCache() {
  _cache = null;
  _cacheAt = 0;
}

function writeMemory(mem: MemoryShape) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
    _cache = mem;
    _cacheAt = Date.now();
  } catch {
    /* noop */
  }
}

export function logMemory(entry: Omit<MemoryEntry, "time"> & { time?: number }) {
  if (!hasWindow()) return;
  const mem = readMemory();
  const full: MemoryEntry = {
    type: entry.type,
    time: entry.time ?? Date.now(),
    meta: entry.meta?.slice(0, 80),
  };
  if (entry.type === "task") mem.taskHistory.push(full);
  else if (entry.type === "expense") mem.expenseHistory.push(full);
  mem.activityLog.push(full);
  writeMemory(mem);
}

/**
 * Notification delivery log — dedupes by
 * `category:id:YYYYMMDDHHmm`. Keeps last 7 days.
 * LocalStorage only. Never syncs to cloud.
 */

const KEY = "dailyos.notification.log.v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type LogMap = Record<string, number>; // key → firedAt ms

let cache: LogMap | null = null;

function load(): LogMap {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = {};
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as LogMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist(m: LogMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* noop */
  }
}

function prune(m: LogMap): LogMap {
  const cutoff = Date.now() - MAX_AGE_MS;
  let changed = false;
  const out: LogMap = {};
  for (const k of Object.keys(m)) {
    if (m[k] >= cutoff) out[k] = m[k];
    else changed = true;
  }
  return changed ? out : m;
}

export function hasDelivered(key: string): boolean {
  return load()[key] !== undefined;
}

export function markDelivered(key: string): void {
  const m = { ...load(), [key]: Date.now() };
  const pruned = prune(m);
  cache = pruned;
  persist(pruned);
}

/** Format a Date + minute-precision timestamp into the dedupe suffix. */
export function fireStamp(fireAtMs: number): string {
  const d = new Date(fireAtMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}

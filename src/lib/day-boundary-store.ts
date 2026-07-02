import { useEffect, useState } from "react";

/**
 * "Day Ends At" — the wall-clock time (in minutes past 00:00) that marks
 * the end of a routine day. Tasks scheduled between 00:00 and this cutoff
 * belong to the PREVIOUS routine day (they are late-night tasks of the
 * evening before), not the next calendar day.
 *
 * This ONLY affects how the routine timeline groups/orders tasks for
 * display. It does not touch the task store, streak logic, statistics,
 * completions, or notifications — those all continue to key off the raw
 * store and calendar dates.
 */

const STORAGE_KEY = "dailyos.routine.dayEndsAt";
const DEFAULT_MIN = 180; // 03:00 AM
const MIN_ALLOWED = 0;
const MAX_ALLOWED = 6 * 60; // up to 06:00 AM

function clamp(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_MIN;
  if (v < MIN_ALLOWED) return MIN_ALLOWED;
  if (v > MAX_ALLOWED) return MAX_ALLOWED;
  return Math.round(v);
}

function read(): number {
  if (typeof window === "undefined") return DEFAULT_MIN;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_MIN;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return DEFAULT_MIN;
    return clamp(n);
  } catch {
    return DEFAULT_MIN;
  }
}

const EVENT = "dailyos:day-ends-at-changed";

export function getDayEndsAtMin(): number {
  return read();
}

export function useDayEndsAt() {
  const [value, setValue] = useState<number>(DEFAULT_MIN);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setValue(read());
    const handler = () => setValue(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const set = (next: number) => {
    const v = clamp(next);
    setValue(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* noop */
    }
  };

  return { dayEndsAtMin: value, setDayEndsAtMin: set, mounted };
}

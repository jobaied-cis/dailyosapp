import { useEffect, useState } from "react";

const KEY = "dailyos.daily-summary.v1";

export interface DaySummary {
  date: string; // YYYY-MM-DD
  done: number;
  total: number;
  pct: number;
}

type Map = Record<string, DaySummary>;

function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

function read(): Map {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Map) : {};
  } catch {
    return {};
  }
}

function write(m: Map) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(m));
}

/** Persist today's stats; returns today + yesterday summaries. */
export function useDailySummary(done: number, total: number): { today: DaySummary; yesterday: DaySummary | null } {
  const [data, setData] = useState<Map>({});

  useEffect(() => {
    setData(read());
  }, []);

  const today = dateKey();
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const map = read();
    const existing = map[today];
    if (!existing || existing.done !== done || existing.total !== total) {
      map[today] = { date: today, done, total, pct };
      // Keep last 30 days only
      const keys = Object.keys(map).sort();
      while (keys.length > 30) {
        delete map[keys.shift()!];
      }
      write(map);
      setData(map);
    }
  }, [done, total, pct, today]);

  return {
    today: data[today] ?? { date: today, done, total, pct },
    yesterday: data[yesterdayKey()] ?? null,
  };
}

import { useEffect, useState, useSyncExternalStore } from "react";

// Bengali Taka sign U+09F3
export const TAKA = "\u09F3";
export const DOLLAR = "$";

export type CurrencyCode = "BDT" | "USD";

const STORAGE_KEY = "dailyos.currency.v1";

const listeners = new Set<() => void>();
let currentCurrency: CurrencyCode = "BDT";
let initialized = false;

function loadCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "BDT";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "USD" ? "USD" : "BDT";
  } catch {
    return "BDT";
  }
}

function ensureInit() {
  if (!initialized && typeof window !== "undefined") {
    currentCurrency = loadCurrency();
    initialized = true;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): CurrencyCode {
  ensureInit();
  return currentCurrency;
}

function getServerSnapshot(): CurrencyCode {
  return "BDT";
}

export function useCurrency(): CurrencyCode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setCurrency(code: CurrencyCode) {
  ensureInit();
  currentCurrency = code;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }
  listeners.forEach((l) => l());
}

let cachedTakaSupport: boolean | null = null;

function detectTakaSupport(): boolean {
  if (cachedTakaSupport !== null) return cachedTakaSupport;
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    ctx.font = "16px sans-serif";
    const taka = ctx.measureText(TAKA).width;
    const tofu = ctx.measureText("\uFFFF").width;
    cachedTakaSupport = taka > 0 && Math.abs(taka - tofu) > 0.5;
    return cachedTakaSupport;
  } catch {
    return true;
  }
}

// Returns the active currency symbol to render in the UI.
// Kept named useTakaSymbol for backwards compatibility with existing call sites.
export function useTakaSymbol(): string {
  const currency = useCurrency();
  const [symbol, setSymbol] = useState<string>(currency === "USD" ? DOLLAR : TAKA);
  useEffect(() => {
    if (currency === "USD") {
      setSymbol(DOLLAR);
    } else {
      setSymbol(detectTakaSupport() ? TAKA : "BDT");
    }
  }, [currency]);
  return symbol;
}

export function formatTaka(n: number, symbol: string): string {
  const value = Math.round(Math.abs(n)).toLocaleString("en-US");
  return symbol === "BDT" ? `${value} BDT` : `${symbol}${value}`;
}

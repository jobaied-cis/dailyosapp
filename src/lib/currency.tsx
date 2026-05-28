import { useEffect, useState } from "react";

// Bengali Taka sign U+09F3
export const TAKA = "\u09F3";

let cachedSupport: boolean | null = null;

function detectTakaSupport(): boolean {
  if (cachedSupport !== null) return cachedSupport;
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    ctx.font = "16px sans-serif";
    const taka = ctx.measureText(TAKA).width;
    const tofu = ctx.measureText("\uFFFF").width;
    cachedSupport = taka > 0 && Math.abs(taka - tofu) > 0.5;
    return cachedSupport;
  } catch {
    return true;
  }
}

export function useTakaSymbol(): string {
  const [symbol, setSymbol] = useState<string>(TAKA);
  useEffect(() => {
    setSymbol(detectTakaSupport() ? TAKA : "BDT");
  }, []);
  return symbol;
}

export function formatTaka(n: number, symbol: string): string {
  const value = Math.round(Math.abs(n)).toLocaleString("en-US");
  return symbol === "BDT" ? `${value} BDT` : `${value}${symbol}`;
}

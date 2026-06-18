import { useEffect, useState, useSyncExternalStore } from "react";

export type EntryType = "income" | "expense";
export type ExpenseCategory = "Food" | "Transport" | "Study" | "Others";

export interface Expense {
  id: string;
  title: string;
  amount: number;
  type: EntryType;
  category: ExpenseCategory;
  createdAt: number;
}

const STORAGE_KEY = "dailyos.expenses.v1";

const listeners = new Set<() => void>();
let cache: Expense[] = [];
let initialized = false;

function load(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: any) => ({
      id: String(e.id),
      title: String(e.title ?? ""),
      amount: Number(e.amount) || 0,
      type: e.type === "income" ? "income" : "expense",
      category: (["Food", "Transport", "Study", "Others"].includes(e.category) ? e.category : "Others") as ExpenseCategory,
      createdAt: Number(e.createdAt) || Date.now(),
    }));
  } catch {
    return [];
  }
}

function persist(next: Expense[]) {
  cache = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function ensureInit() {
  if (!initialized && typeof window !== "undefined") {
    cache = load();
    initialized = true;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  ensureInit();
  return cache;
}

const EMPTY_EXPENSES: Expense[] = [];
function getServerSnapshot(): Expense[] {
  return EMPTY_EXPENSES;
}

export function useExpenses(): Expense[] {
  const expenses = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [...expenses].sort((a, b) => b.createdAt - a.createdAt);
}

export function addExpense(input: { title: string; amount: number; type?: EntryType; category?: ExpenseCategory }) {
  ensureInit();
  const expense: Expense = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    amount: input.amount,
    type: input.type ?? "expense",
    category: input.category ?? "Others",
    createdAt: Date.now(),
  };
  persist([expense, ...cache]);
}

export function addIncome(input: { amount: number; title?: string }) {
  ensureInit();
  const entry: Expense = {
    id: crypto.randomUUID(),
    title: (input.title ?? "Added money").trim() || "Added money",
    amount: input.amount,
    type: "income",
    category: "Others",
    createdAt: Date.now(),
  };
  persist([entry, ...cache]);
}

export function updateExpense(id: string, input: { title: string; amount: number; category?: ExpenseCategory }) {
  ensureInit();
  persist(
    cache.map((e) =>
      e.id === id
        ? { ...e, title: input.title.trim(), amount: input.amount, category: input.category ?? e.category }
        : e
    )
  );
}

export function deleteExpense(id: string) {
  ensureInit();
  persist(cache.filter((e) => e.id !== id));
}

const DAILY_LIMIT_KEY = "dailyos.daily-limit.v1";

export function getDailyLimit(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(DAILY_LIMIT_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setDailyLimit(value: number) {
  if (typeof window !== "undefined") {
    localStorage.setItem(DAILY_LIMIT_KEY, String(value));
  }
}

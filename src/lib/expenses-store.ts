import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const listeners = new Set<() => void>();
let cache: Expense[] = [];
let currentUserId: string | null = null;

function fromRow(row: any): Expense {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    amount: Number(row.amount) || 0,
    type: row.type === "income" ? "income" : "expense",
    category: (["Food", "Transport", "Study", "Others"].includes(row.category)
      ? row.category
      : "Others") as ExpenseCategory,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return cache;
}

const EMPTY: Expense[] = [];
function getServerSnapshot(): Expense[] {
  return EMPTY;
}

async function loadFromCloud(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[expenses] load failed:", error.message);
    return;
  }
  cache = (data ?? []).map(fromRow);
  emit();
}

export function useExpensesSync(userId: string | null) {
  useEffect(() => {
    if (userId === currentUserId) return;
    currentUserId = userId;
    cache = [];
    emit();
    if (!userId) return;
    void loadFromCloud(userId);
  }, [userId]);
}

export function useExpenses(): Expense[] {
  const expenses = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [...expenses].sort((a, b) => b.createdAt - a.createdAt);
}

export async function addExpense(input: {
  title: string;
  amount: number;
  type?: EntryType;
  category?: ExpenseCategory;
}): Promise<void> {
  if (!currentUserId) return;
  const row = {
    user_id: currentUserId,
    title: input.title.trim(),
    amount: input.amount,
    type: input.type ?? "expense",
    category: input.category ?? "Others",
  };
  const { data, error } = await supabase
    .from("expenses")
    .insert(row)
    .select()
    .single();
  if (error || !data) {
    console.error("[expenses] add failed:", error?.message);
    return;
  }
  const created = fromRow(data);
  cache = [created, ...cache];
  emit();
  if (created.type === "expense") {
    void import("@/lib/memory-store").then(({ logMemory }) =>
      logMemory({ type: "expense", meta: `${created.category}:${created.amount}` }),
    );
  }
}

export async function addIncome(input: { amount: number; title?: string }): Promise<void> {
  if (!currentUserId) return;
  const row = {
    user_id: currentUserId,
    title: (input.title ?? "Added money").trim() || "Added money",
    amount: input.amount,
    type: "income" as EntryType,
    category: "Others" as ExpenseCategory,
  };
  const { data, error } = await supabase
    .from("expenses")
    .insert(row)
    .select()
    .single();
  if (error || !data) {
    console.error("[expenses] addIncome failed:", error?.message);
    return;
  }
  cache = [fromRow(data), ...cache];
  emit();
}

export async function updateExpense(
  id: string,
  input: { title: string; amount: number; category?: ExpenseCategory },
): Promise<void> {
  const patch = {
    title: input.title.trim(),
    amount: input.amount,
    ...(input.category !== undefined ? { category: input.category } : {}),
  };
  const prev = cache;
  cache = cache.map((e) => (e.id === id ? { ...e, ...patch } : e));
  emit();
  const { error } = await supabase.from("expenses").update(patch).eq("id", id);
  if (error) {
    console.error("[expenses] update failed:", error.message);
    cache = prev;
    emit();
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const prev = cache;
  cache = cache.filter((e) => e.id !== id);
  emit();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) {
    console.error("[expenses] delete failed:", error.message);
    cache = prev;
    emit();
  }
}

/** Used by cloud-migrate to seed from localStorage. */
export async function bulkInsertExpenses(rows: Omit<Expense, "id">[]): Promise<void> {
  if (!currentUserId || rows.length === 0) return;
  const payload = rows.map((r) => ({
    user_id: currentUserId!,
    title: r.title,
    amount: r.amount,
    type: r.type,
    category: r.category,
    created_at: new Date(r.createdAt).toISOString(),
  }));
  const { data, error } = await supabase.from("expenses").insert(payload).select();
  if (error) {
    console.error("[expenses] bulk insert failed:", error.message);
    return;
  }
  cache = [...(data ?? []).map(fromRow), ...cache];
  emit();
}

/* ---------- daily limit (kept as user preference in localStorage) ---------- */

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

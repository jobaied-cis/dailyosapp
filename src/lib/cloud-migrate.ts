import { bulkInsertEvents, type EventItem } from "@/lib/events-store";
import { bulkInsertExpenses, type Expense } from "@/lib/expenses-store";

/**
 * One-shot migration: push any pre-cloud localStorage data up to Supabase
 * the first time a given user signs in. Guarded by per-user flag.
 */

const LEGACY_EVENTS_KEY = "dailyos.events.v4";
const LEGACY_EXPENSES_KEY = "dailyos.expenses.v1";

function migratedKey(userId: string): string {
  return `dailyos.migrated.${userId}`;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function runCloudMigrationOnce(userId: string): Promise<void> {
  if (typeof window === "undefined" || !userId) return;
  const flagKey = migratedKey(userId);
  try {
    if (window.localStorage.getItem(flagKey) === "true") return;
  } catch {
    return;
  }

  try {
    const legacyEvents = readJSON<any[]>(LEGACY_EVENTS_KEY, []);
    if (Array.isArray(legacyEvents) && legacyEvents.length > 0) {
      const rows: Omit<EventItem, "id">[] = legacyEvents.map((e) => ({
        title: String(e.title ?? ""),
        date: String(e.date ?? ""),
        time: String(e.time ?? ""),
        type: e.type ?? "Other",
        priority: e.priority ?? "Medium",
        completed: Boolean(e.completed),
        notes: String(e.notes ?? ""),
      }));
      await bulkInsertEvents(rows);
    }

    const legacyExpenses = readJSON<any[]>(LEGACY_EXPENSES_KEY, []);
    if (Array.isArray(legacyExpenses) && legacyExpenses.length > 0) {
      const rows: Omit<Expense, "id">[] = legacyExpenses.map((e) => ({
        title: String(e.title ?? ""),
        amount: Number(e.amount) || 0,
        type: e.type === "income" ? "income" : "expense",
        category: ["Food", "Transport", "Study", "Others"].includes(e.category)
          ? e.category
          : "Others",
        createdAt: Number(e.createdAt) || Date.now(),
      }));
      await bulkInsertExpenses(rows);
    }

    window.localStorage.setItem(flagKey, "true");
    // Keep legacy keys around as offline fallback; do NOT delete.
  } catch (err) {
    console.error("[cloud-migrate] failed:", err);
  }
}

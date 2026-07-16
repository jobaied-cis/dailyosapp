import {
  bulkInsertEvents,
  type EventItem,
} from "@/lib/events-store";
import {
  bulkInsertExpenses,
  type Expense,
} from "@/lib/expenses-store";
import {
  bulkInsertTasks,
  type Task,
  type Repeat,
} from "@/lib/tasks-store";
import { bulkInsertCompletions } from "@/lib/task-completions-store";
import {
  bulkInsertExceptions,
  type TaskException,
} from "@/lib/task-exceptions-store";
import {
  bulkInsertArchives,
  type ArchivedRoutineDay,
} from "@/lib/routine-archive-store";
import {
  bulkInsertMissions,
  type Mission,
  type MissionTask,
} from "@/lib/missions-store";
import { bulkInsertStreak } from "@/lib/streak-store";

/**
 * One-shot migration: push any pre-cloud localStorage data up to Supabase
 * the first time a given user signs in. Guarded by per-user flag.
 * LocalStorage is left intact as an offline fallback.
 */

const LEGACY_EVENTS_KEY = "dailyos.events.v4";
const LEGACY_EXPENSES_KEY = "dailyos.expenses.v1";
const LEGACY_TASKS_KEY = "dailyos.tasks.v1";
const LEGACY_COMPLETIONS_KEY = "dailyos.task-completions.v1";
const LEGACY_EXCEPTIONS_KEY = "dailyos.task-exceptions.v1";
const LEGACY_ARCHIVE_KEY = "dailyos.routine.archive.v1";
const LEGACY_MISSIONS_KEY = "dailyos.missions.v2";
const LEGACY_STREAK_KEY = "dailyos.streak.v2";

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

function coerceRepeat(v: unknown): Repeat | undefined {
  if (v === "daily" || v === "weekdays" || v === "weekends") return v;
  if (v && typeof v === "object" && Array.isArray((v as any).days)) {
    return { days: ((v as any).days as unknown[]).map(Number).filter((n) => Number.isFinite(n)) };
  }
  return undefined;
}

export async function runCloudMigrationOnce(userId: string): Promise<void> {
  if (typeof window === "undefined" || !userId) return;
  const flagKey = migratedKey(userId);
  try {
    if (window.localStorage.getItem(flagKey) === "true") return;
  } catch {
    return;
  }

  // Set the guard FIRST so a partial failure can never cause a duplicate
  // re-import on the next sign-in.
  try {
    window.localStorage.setItem(flagKey, "true");
  } catch {
    /* noop */
  }

  try {
    // -------- events --------
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

    // -------- expenses --------
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

    // -------- tasks --------
    const legacyTasks = readJSON<any[]>(LEGACY_TASKS_KEY, []);
    const completionRowsFromOneOff: { taskId: string; date: string }[] = [];
    if (Array.isArray(legacyTasks) && legacyTasks.length > 0) {
      const tasks: Task[] = legacyTasks
        .filter((t) => t && typeof t.id === "string" && typeof t.title === "string")
        .map((t) => {
          const repeat = coerceRepeat(t.repeat);
          const isRecurring = !!repeat;
          const date = !isRecurring
            ? typeof t.date === "string" && t.date
              ? t.date
              : undefined
            : undefined;
          const task: Task = {
            id: t.id,
            time: String(t.time ?? ""),
            endTime: t.endTime || undefined,
            title: String(t.title),
            note: t.note || undefined,
            completed: false,
            repeat,
            date,
            priority: t.priority || undefined,
            category: t.category || undefined,
          };
          // Legacy one-off completion → task_completions.
          if (!isRecurring && t.completed && date) {
            completionRowsFromOneOff.push({ taskId: t.id, date });
          }
          return task;
        });
      await bulkInsertTasks(tasks);
    }

    // -------- completions --------
    const legacyCompletions = readJSON<Record<string, Record<string, true>>>(
      LEGACY_COMPLETIONS_KEY,
      {},
    );
    const completionRows: { taskId: string; date: string }[] = [];
    for (const date of Object.keys(legacyCompletions || {})) {
      for (const taskId of Object.keys(legacyCompletions[date] || {})) {
        completionRows.push({ taskId, date });
      }
    }
    const allCompletionRows = [...completionRows, ...completionRowsFromOneOff];
    if (allCompletionRows.length > 0) {
      await bulkInsertCompletions(allCompletionRows);
    }

    // -------- exceptions --------
    const legacyExceptions = readJSON<Record<string, Record<string, TaskException>>>(
      LEGACY_EXCEPTIONS_KEY,
      {},
    );
    const exceptionRows: { taskId: string; date: string; patch: TaskException }[] = [];
    for (const date of Object.keys(legacyExceptions || {})) {
      for (const taskId of Object.keys(legacyExceptions[date] || {})) {
        exceptionRows.push({ taskId, date, patch: legacyExceptions[date][taskId] });
      }
    }
    if (exceptionRows.length > 0) {
      await bulkInsertExceptions(exceptionRows);
    }

    // -------- archives --------
    const legacyArchive = readJSON<Record<string, ArchivedRoutineDay[]>>(LEGACY_ARCHIVE_KEY, {});
    const archiveRows: ArchivedRoutineDay[] = [];
    for (const key of Object.keys(legacyArchive || {})) {
      for (const entry of legacyArchive[key] || []) {
        archiveRows.push({
          dateKey: String(entry.dateKey || key),
          archivedAt: String(entry.archivedAt || new Date().toISOString()),
          tasks: Array.isArray(entry.tasks) ? entry.tasks : [],
          done: Number(entry.done) || 0,
          total: Number(entry.total) || 0,
        });
      }
    }
    if (archiveRows.length > 0) {
      await bulkInsertArchives(archiveRows);
    }

    // -------- missions --------
    const legacyMissions = readJSON<any[]>(LEGACY_MISSIONS_KEY, []);
    if (Array.isArray(legacyMissions) && legacyMissions.length > 0) {
      const missions: Mission[] = legacyMissions
        .filter((m) => m && typeof m.id === "string" && typeof m.title === "string")
        .map((m) => {
          const tasks: MissionTask[] = Array.isArray(m.tasks)
            ? m.tasks
                .filter((t: any) => t && typeof t.id === "string")
                .map((t: any) => ({
                  id: String(t.id),
                  missionId: String(m.id),
                  day: Number(t.day) > 0 ? Number(t.day) : 1,
                  title: String(t.title ?? t.text ?? ""),
                  completed: Boolean(t.completed),
                  createdAt: Number(t.createdAt) || Date.now(),
                }))
            : [];
          const maxDay = tasks.reduce((a, t) => Math.max(a, t.day), 1);
          return {
            id: String(m.id),
            title: String(m.title),
            priority: Number(m.priority) || 2,
            createdAt: Number(m.createdAt) || Date.now(),
            startDate: Number(m.startDate) || Number(m.createdAt) || Date.now(),
            days: Math.max(Number(m.days) || 1, maxDay),
            tasks,
          };
        });
      await bulkInsertMissions(missions);
    }

    // -------- streak --------
    const legacyStreak = readJSON<any>(LEGACY_STREAK_KEY, null);
    if (legacyStreak && typeof legacyStreak === "object") {
      await bulkInsertStreak({
        streak: Number(legacyStreak.streak) || 0,
        lastCompletedDate: legacyStreak.lastCompletedDate ?? null,
        lastResetDate: legacyStreak.lastResetDate ?? null,
        lastBrokenAt: Number(legacyStreak.lastBrokenAt) || null,
        lastEvaluatedDate: legacyStreak.lastEvaluatedDate ?? null,
      });
    }
  } catch (err) {
    console.error("[cloud-migrate] failed:", err);
  }
}

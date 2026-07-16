import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recordMissionCompletion } from "./mission-streak-store";

/**
 * Cloud-backed missions store. Missions + their tasks live in Supabase
 * (`missions`, `mission_tasks`). LocalStorage mirrors state as an offline
 * cache under the legacy key.
 */

export interface MissionTask {
  id: string;
  missionId: string;
  day: number;
  title: string;
  completed: boolean;
  createdAt: number;
}

export interface Mission {
  id: string;
  title: string;
  priority: number; // 1=High, 2=Medium, 3=Low
  createdAt: number;
  startDate: number;
  days: number;
  tasks: MissionTask[];
}

const LEGACY_KEY = "dailyos.missions.v2";

const listeners = new Set<() => void>();
let cache: Mission[] = [];
let currentUserId: string | null = null;
let initialized = false;

function emit() {
  listeners.forEach((l) => l());
}

function loadLocal(): Mission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Mission[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(next: Mission[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

function ensureInit() {
  if (!initialized) {
    cache = loadLocal();
    initialized = true;
  }
}

function commit(next: Mission[]) {
  cache = next;
  saveLocal(next);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  ensureInit();
  return cache;
}

const EMPTY: Mission[] = [];
function getServerSnapshot(): Mission[] {
  return EMPTY;
}

function missionFromRow(row: any, tasks: MissionTask[]): Mission {
  const created = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  const start = row.start_date ? new Date(row.start_date).getTime() : created;
  const maxDay = tasks.reduce((a, t) => Math.max(a, t.day), 1);
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    priority: Number(row.priority) || 2,
    createdAt: created,
    startDate: start,
    days: Math.max(Number(row.days) || 1, maxDay),
    tasks,
  };
}

function missionTaskFromRow(row: any): MissionTask {
  return {
    id: String(row.id),
    missionId: String(row.mission_id),
    day: Number(row.day) || 1,
    title: String(row.title ?? ""),
    completed: Boolean(row.completed),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

async function loadFromCloud(userId: string): Promise<void> {
  const [missionsRes, tasksRes] = await Promise.all([
    supabase.from("missions").select("*").eq("user_id", userId),
    supabase.from("mission_tasks").select("*").eq("user_id", userId),
  ]);
  if (missionsRes.error) {
    console.error("[missions] load failed:", missionsRes.error.message);
    return;
  }
  if (tasksRes.error) {
    console.error("[mission_tasks] load failed:", tasksRes.error.message);
    return;
  }
  const tasksByMission = new Map<string, MissionTask[]>();
  for (const row of tasksRes.data ?? []) {
    const t = missionTaskFromRow(row);
    if (!tasksByMission.has(t.missionId)) tasksByMission.set(t.missionId, []);
    tasksByMission.get(t.missionId)!.push(t);
  }
  const missions: Mission[] = (missionsRes.data ?? []).map((row: any) =>
    missionFromRow(row, tasksByMission.get(String(row.id)) ?? []),
  );
  commit(missions);
}

export function useMissionSync(userId: string | null) {
  useEffect(() => {
    if (userId === currentUserId) return;
    currentUserId = userId;
    if (!userId) {
      commit([]);
      return;
    }
    void loadFromCloud(userId);
  }, [userId]);
}

export function useMissions(): Mission[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useMission(id: string): Mission | undefined {
  return useMissions().find((m) => m.id === id);
}

export function uniqueMissionTitle(title: string): string {
  ensureInit();
  const base = title.trim();
  if (!base) return base;
  const existing = new Set(cache.map((m) => m.title.toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;
  let n = 2;
  while (existing.has(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
}

export function addMission(title: string, priority: number = 2, days: number = 1): string {
  ensureInit();
  const now = Date.now();
  const mission: Mission = {
    id: crypto.randomUUID(),
    title: title.trim(),
    priority,
    createdAt: now,
    startDate: now,
    days: Math.max(1, Math.floor(days)),
    tasks: [],
  };
  const prev = cache;
  commit([...cache, mission]);

  if (!currentUserId) return mission.id;
  void (async () => {
    const { error } = await supabase.from("missions").insert({
      id: mission.id,
      user_id: currentUserId!,
      title: mission.title,
      priority: mission.priority,
      days: mission.days,
      start_date: new Date(mission.startDate).toISOString(),
      created_at: new Date(mission.createdAt).toISOString(),
    });
    if (error) {
      console.error("[missions] insert failed:", error.message);
      commit(prev);
    }
  })();
  return mission.id;
}

export function updateMission(id: string, title: string) {
  ensureInit();
  const t = title.trim();
  if (!t) return;
  const prev = cache;
  commit(cache.map((m) => (m.id === id ? { ...m, title: t } : m)));

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("missions").update({ title: t }).eq("id", id);
    if (error) {
      console.error("[missions] update failed:", error.message);
      commit(prev);
    }
  })();
}

export function deleteMission(id: string) {
  ensureInit();
  const prev = cache;
  commit(cache.filter((m) => m.id !== id));

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("missions").delete().eq("id", id);
    if (error) {
      console.error("[missions] delete failed:", error.message);
      commit(prev);
    }
  })();
}

export function addDay(missionId: string) {
  ensureInit();
  const prev = cache;
  let newDays = 1;
  const next = cache.map((m) => {
    if (m.id !== missionId) return m;
    newDays = (m.days || 1) + 1;
    return { ...m, days: newDays };
  });
  commit(next);

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("missions").update({ days: newDays }).eq("id", missionId);
    if (error) {
      console.error("[missions] addDay failed:", error.message);
      commit(prev);
    }
  })();
}

export function addTask(missionId: string, title: string, day: number = 1) {
  ensureInit();
  const task: MissionTask = {
    id: crypto.randomUUID(),
    missionId,
    day,
    title: title.trim(),
    completed: false,
    createdAt: Date.now(),
  };
  const prev = cache;
  commit(
    cache.map((m) => (m.id === missionId ? { ...m, tasks: [...m.tasks, task] } : m)),
  );

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("mission_tasks").insert({
      id: task.id,
      user_id: currentUserId!,
      mission_id: missionId,
      day: task.day,
      title: task.title,
      completed: false,
      created_at: new Date(task.createdAt).toISOString(),
    });
    if (error) {
      console.error("[mission_tasks] insert failed:", error.message);
      commit(prev);
    }
  })();
}

export function updateTask(missionId: string, taskId: string, title: string) {
  ensureInit();
  const t = title.trim();
  if (!t) return;
  const prev = cache;
  commit(
    cache.map((m) =>
      m.id === missionId
        ? {
            ...m,
            tasks: m.tasks.map((task) => (task.id === taskId ? { ...task, title: t } : task)),
          }
        : m,
    ),
  );

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("mission_tasks").update({ title: t }).eq("id", taskId);
    if (error) {
      console.error("[mission_tasks] update failed:", error.message);
      commit(prev);
    }
  })();
}

export function toggleTask(missionId: string, taskId: string): boolean {
  ensureInit();
  let toggledToCompleted = false;
  let newCompleted = false;
  const prev = cache;
  const next = cache.map((m) => {
    if (m.id !== missionId) return m;
    const nextTasks = m.tasks.map((t) => {
      if (t.id === taskId) {
        toggledToCompleted = !t.completed;
        newCompleted = !t.completed;
        return { ...t, completed: !t.completed };
      }
      return t;
    });
    return { ...m, tasks: nextTasks };
  });
  commit(next);

  if (currentUserId) {
    void (async () => {
      const { error } = await supabase
        .from("mission_tasks")
        .update({ completed: newCompleted })
        .eq("id", taskId);
      if (error) {
        console.error("[mission_tasks] toggle failed:", error.message);
        commit(prev);
      }
    })();
  }

  if (toggledToCompleted) {
    const result = recordMissionCompletion(missionId);
    return result.increased;
  }
  return false;
}

export function deleteTask(missionId: string, taskId: string) {
  ensureInit();
  const prev = cache;
  commit(
    cache.map((m) =>
      m.id === missionId ? { ...m, tasks: m.tasks.filter((t) => t.id !== taskId) } : m,
    ),
  );

  if (!currentUserId) return;
  void (async () => {
    const { error } = await supabase.from("mission_tasks").delete().eq("id", taskId);
    if (error) {
      console.error("[mission_tasks] delete failed:", error.message);
      commit(prev);
    }
  })();
}

export function missionProgress(m: Mission) {
  const total = m.tasks.length;
  const done = m.tasks.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

export function missionEndTs(m: Mission): number {
  const start = new Date(m.startDate);
  start.setHours(0, 0, 0, 0);
  return start.getTime() + Math.max(1, m.days) * 86400000;
}

export function isMissionEnded(m: Mission): boolean {
  return Date.now() >= missionEndTs(m);
}

/** Used by cloud-migrate to seed from localStorage. */
export async function bulkInsertMissions(missions: Mission[]): Promise<void> {
  if (!currentUserId || missions.length === 0) return;
  const missionsPayload = missions.map((m) => ({
    id: m.id,
    user_id: currentUserId!,
    title: m.title,
    priority: m.priority,
    days: m.days,
    start_date: new Date(m.startDate).toISOString(),
    created_at: new Date(m.createdAt).toISOString(),
  }));
  const tasksPayload = missions.flatMap((m) =>
    m.tasks.map((t) => ({
      id: t.id,
      user_id: currentUserId!,
      mission_id: m.id,
      day: t.day,
      title: t.title,
      completed: t.completed,
      created_at: new Date(t.createdAt).toISOString(),
    })),
  );

  const missionsRes = await supabase.from("missions").insert(missionsPayload);
  if (missionsRes.error) {
    console.error("[missions] bulk insert failed:", missionsRes.error.message);
    return;
  }
  if (tasksPayload.length > 0) {
    const tasksRes = await supabase.from("mission_tasks").insert(tasksPayload);
    if (tasksRes.error) {
      console.error("[mission_tasks] bulk insert failed:", tasksRes.error.message);
    }
  }
  commit([...cache, ...missions]);
}

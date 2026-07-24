/**
 * Persistent notification settings.
 * Stored under `dailyos.notification.settings.<uid>` (or `.anon` when
 * no user id is available). Additive layer — never touches other stores.
 */

const KEY_PREFIX = "dailyos.notification.settings.";

export interface NotificationSettings {
  masterEnabled: boolean;
  routineEnabled: boolean;
  missionEnabled: boolean;
  eventEnabled: boolean;
  expenseEnabled: boolean;
  summaryEnabled: boolean;
  streakEnabled: boolean;
  /** HH:MM 24h */
  morningReminderTime: string;
  nightReminderTime: string;
  expenseReminderTime: string;
  dailySummaryTime: string;
  eventLeadMinutes: number;
  permissionDismissed: boolean;
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  masterEnabled: false,
  routineEnabled: true,
  missionEnabled: true,
  eventEnabled: true,
  expenseEnabled: true,
  summaryEnabled: true,
  streakEnabled: true,
  morningReminderTime: "08:00",
  nightReminderTime: "22:00",
  expenseReminderTime: "21:00",
  dailySummaryTime: "22:00",
  eventLeadMinutes: 30,
  permissionDismissed: false,
};

let currentUid = "anon";
let cache: NotificationSettings = { ...DEFAULT_SETTINGS };
let initialized = false;

const listeners = new Set<() => void>();

function storageKey(uid: string): string {
  return KEY_PREFIX + uid;
}

function read(uid: string): NotificationSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function write(uid: string, s: NotificationSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(s));
  } catch {
    /* noop */
  }
}

function emit() {
  listeners.forEach((cb) => cb());
}

export function subscribeSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSettings(): NotificationSettings {
  if (!initialized) {
    cache = read(currentUid);
    initialized = true;
  }
  return cache;
}

export function setSettingsUser(uid: string | null) {
  const next = uid || "anon";
  if (next === currentUid && initialized) return;
  currentUid = next;
  cache = read(currentUid);
  initialized = true;
  emit();
}

export function updateSettings(patch: Partial<NotificationSettings>) {
  const next: NotificationSettings = { ...getSettings(), ...patch };
  cache = next;
  write(currentUid, next);
  emit();
}

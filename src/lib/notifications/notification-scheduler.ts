/**
 * Single-tab, single-timeout notification scheduler.
 *
 * - One rolling setTimeout at a time (no setInterval, no polling loop).
 * - Rebuilds the queue from a pure planner whenever data changes.
 * - Cross-tab leader election via localStorage heartbeat +
 *   BroadcastChannel so only one open tab actually fires.
 * - Delivery is deduped by the notification-log-store.
 *
 * The scheduler is a module-level singleton because the browser has
 * one timer queue per tab; multiple instances would fight each other.
 */

import { notify } from "./notify";
import { hasDelivered, markDelivered } from "./notification-log-store";
import { planNotifications, type PlannedItem, type PlannerContext } from "./planner";
import { MinHeap } from "./queue";

const LEADER_KEY = "dailyos.notification.leader";
const LEADER_TTL_MS = 120_000;
const HEARTBEAT_CAP_MS = 60_000;
const CHANNEL_NAME = "dailyos.notifications";

interface LeaderRecord {
  id: string;
  expires: number;
}

interface ChannelMessage {
  type: "settings-changed" | "leader-changed" | "wake";
}

const instanceId = (() => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Math.random().toString(36).slice(2)}-${Date.now()}`;
})();

let timer: ReturnType<typeof setTimeout> | null = null;
let heap = new MinHeap<PlannedItem>((a, b) => a.fireAt - b.fireAt);
let contextProvider: (() => PlannerContext | null) | null = null;
let started = false;
let channel: BroadcastChannel | null = null;
let unloadBound = false;

function readLeader(): LeaderRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEADER_KEY);
    return raw ? (JSON.parse(raw) as LeaderRecord) : null;
  } catch {
    return null;
  }
}

function writeLeader(rec: LeaderRecord | null): void {
  if (typeof window === "undefined") return;
  try {
    if (rec) window.localStorage.setItem(LEADER_KEY, JSON.stringify(rec));
    else window.localStorage.removeItem(LEADER_KEY);
  } catch {
    /* noop */
  }
}

function claimLeadership(): boolean {
  const now = Date.now();
  const cur = readLeader();
  if (!cur || cur.expires < now || cur.id === instanceId) {
    writeLeader({ id: instanceId, expires: now + LEADER_TTL_MS });
    return true;
  }
  return false;
}

function isLeader(): boolean {
  const cur = readLeader();
  return !!cur && cur.id === instanceId && cur.expires >= Date.now();
}

function releaseLeadership(): void {
  const cur = readLeader();
  if (cur && cur.id === instanceId) writeLeader(null);
}

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function rebuildHeap(): void {
  heap.clear();
  const ctx = contextProvider?.();
  if (!ctx) return;
  const items = planNotifications(ctx);
  for (const item of items) {
    if (hasDelivered(item.key)) continue;
    heap.push(item);
  }
}

function fireDueAndArm(): void {
  timer = null;
  const now = Date.now();

  // Fire everything already due.
  while (heap.size() > 0) {
    const top = heap.peek()!;
    if (top.fireAt > now) break;
    heap.pop();
    if (!hasDelivered(top.key)) {
      markDelivered(top.key);
      // Only the leader delivers, but we still pop non-leader queues
      // so they stay in sync.
      if (isLeader()) {
        notify({ title: top.title, body: top.body, tag: top.key, url: top.url });
      }
    }
  }

  arm();
}

function arm(): void {
  clearTimer();
  if (typeof window === "undefined") return;

  // Renew leadership TTL every tick so we never expire while active.
  if (isLeader()) claimLeadership();

  const now = Date.now();
  const nextItem = heap.peek();
  let delay = HEARTBEAT_CAP_MS;
  if (nextItem) {
    delay = Math.max(0, Math.min(nextItem.fireAt - now, HEARTBEAT_CAP_MS));
  }
  timer = setTimeout(fireDueAndArm, delay);
}

/** Public: refresh the plan and re-arm the single timeout. */
export function refreshSchedule(): void {
  if (!started) return;
  rebuildHeap();
  arm();
}

function handleVisibility(): void {
  if (document.visibilityState === "visible") {
    claimLeadership();
    refreshSchedule();
  }
}

function handleOnline(): void {
  refreshSchedule();
}

function handleBeforeUnload(): void {
  releaseLeadership();
}

function bindWindowEvents(): void {
  if (unloadBound || typeof window === "undefined") return;
  unloadBound = true;
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("online", handleOnline);
  window.addEventListener("focus", refreshSchedule);
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("storage", (e) => {
    if (e.key === LEADER_KEY) {
      // Leadership changed elsewhere — re-evaluate.
      arm();
    }
  });
}

function openChannel(): void {
  if (channel || typeof window === "undefined") return;
  if (typeof BroadcastChannel === "undefined") return;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (ev: MessageEvent<ChannelMessage>) => {
      const msg = ev.data;
      if (!msg) return;
      if (msg.type === "settings-changed" || msg.type === "wake") {
        refreshSchedule();
      }
    };
  } catch {
    channel = null;
  }
}

export function broadcastSettingsChanged(): void {
  if (channel) {
    try {
      channel.postMessage({ type: "settings-changed" } as ChannelMessage);
    } catch {
      /* noop */
    }
  }
}

export function startScheduler(provider: () => PlannerContext | null): void {
  if (typeof window === "undefined") return;
  contextProvider = provider;
  if (started) {
    refreshSchedule();
    return;
  }
  started = true;
  claimLeadership();
  bindWindowEvents();
  openChannel();
  refreshSchedule();
}

export function stopScheduler(): void {
  clearTimer();
  heap.clear();
  contextProvider = null;
  started = false;
  releaseLeadership();
  if (channel) {
    try {
      channel.close();
    } catch {
      /* noop */
    }
    channel = null;
  }
}

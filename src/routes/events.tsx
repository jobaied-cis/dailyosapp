import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useEvents, addEvent, deleteEvent, toggleEventCompletion, updateEvent, getEventStatus } from "@/lib/events-store";
import type { EventType, EventPriority, EventItem } from "@/lib/events-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CalendarDays, Clock, Plus, Trash2, Calendar, Pencil, Flame, Zap, AlertTriangle, Check, X, MoveRight } from "lucide-react";
import { SwipeableRow } from "@/components/SwipeableRow";
import { parseQuickAdd, validateEvent, prettyDate, prettyTime, type QuickAddParsed, type ValidationErrors } from "@/lib/event-validation";

function pad(n: number) { return String(n).padStart(2, "0"); }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function getTodayStr(): string { return toDateStr(new Date()); }

function typeEmoji(type: EventType): string {
  switch (type) {
    case "Exam": return "📝";
    case "Meeting": return "🤝";
    case "Class": return "📚";
    case "Personal": return "🎯";
    default: return "📌";
  }
}

function formatStartsIn(diffMs: number): string {
  if (diffMs <= 0) return "Starts now";
  if (diffMs < 60_000) return "Starts in <1m";
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (days >= 1) {
    const remH = Math.floor((diffMs % 86400000) / 3600000);
    return remH > 0 ? `Starts in ${days}d ${remH}h` : `Starts in ${days}d`;
  }
  if (hours >= 1) {
    const remMin = Math.floor((diffMs % 3600000) / 60000);
    return remMin > 0 ? `Starts in ${hours}h ${remMin}m` : `Starts in ${hours}h`;
  }
  return `Starts in ${minutes}m`;
}

function TodayFocusCard({ events, now }: { events: EventItem[]; now: number }) {
  const today = getTodayStr();
  const upcomingAll = events
    .filter((e) => !e.completed)
    .map((e) => ({ ...e, timeMs: new Date(`${e.date}T${e.time}`).getTime() }))
    .filter((e) => e.timeMs > now)
    .sort((a, b) => a.timeMs - b.timeMs);

  const nextEvent = upcomingAll[0];
  const todayUpcoming = upcomingAll.filter((e) => e.date === today);
  const within60 = nextEvent ? nextEvent.timeMs - now < 60 * 60_000 : false;

  return (
    <div className={`bg-card border border-primary/30 rounded-[1.25rem] p-4 shadow-[0_2px_16px_-4px_rgba(37,99,235,0.18)] space-y-2 animate-events-entrance ${within60 ? "animate-glow-pulse" : ""}`}>
      <div className="flex items-center gap-2">
        <Flame className="size-4 text-primary" />
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Next Event</p>
      </div>

      {nextEvent ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeEmoji(nextEvent.type)}</span>
            <p className="font-semibold text-foreground text-sm truncate">{nextEvent.title}</p>
          </div>
          <p className={`text-xs text-primary font-medium ${within60 ? "animate-countdown-pulse" : ""}`}>
            ⏳ {formatStartsIn(nextEvent.timeMs - now)}
          </p>
          {todayUpcoming.length > 1 ? (
            <p className="text-[11px] text-muted-foreground">{todayUpcoming.length} events remaining today</p>
          ) : nextEvent.date !== today ? (
            <p className="text-[11px] text-muted-foreground">No more events today</p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="font-semibold text-foreground text-sm">All caught up</p>
            <p className="text-xs text-muted-foreground">No upcoming events.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function WeekStrip({
  events,
  onDayTap,
}: {
  events: EventItem[];
  onDayTap: (dateStr: string, hasEvent: boolean, cellEl: HTMLButtonElement) => void;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.date, (counts.get(e.date) ?? 0) + 1);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
      {days.map((d, i) => {
        const dateStr = toDateStr(d);
        const has = (counts.get(dateStr) ?? 0) > 0;
        const isToday = i === 0;
        return (
          <button
            key={dateStr}
            onClick={(e) => onDayTap(dateStr, has, e.currentTarget)}
            className={`press shrink-0 w-[44px] py-2 rounded-2xl border flex flex-col items-center gap-1 ${
              isToday
                ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_14px_-4px_rgba(37,99,235,0.5)]"
                : "bg-card text-foreground border-border/60"
            }`}
            aria-label={d.toDateString()}
          >
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
            </span>
            <span className="text-sm font-bold leading-none tabular-nums">{d.getDate()}</span>
            <span
              className={`size-1.5 rounded-full ${
                has ? (isToday ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function focusLineText(n: number): string {
  if (n === 0) return "Light day today, plan ahead? ✨";
  if (n === 1) return "You have 1 event today — you've got this 💪";
  if (n >= 4) return "Busy day ahead — stay focused 🔥";
  return `You have ${n} events today — stay sharp`;
}

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — DailyOS" },
      { name: "description", content: "Track your upcoming events and schedule." },
    ],
  }),
  component: EventsPage,
});

const eventTypes: EventType[] = ["Exam", "Meeting", "Class", "Personal", "Other"];
const eventPriorities: EventPriority[] = ["High", "Medium", "Low"];

function priorityColor(priority: EventPriority) {
  switch (priority) {
    case "High": return "bg-destructive/15 text-destructive border-destructive/20";
    case "Medium": return "bg-amber-500/15 text-amber-600 border-amber-500/20";
    case "Low": return "bg-muted text-muted-foreground border-border";
  }
}

function findConflict(events: EventItem[], date: string, time: string, excludeId?: string): EventItem | null {
  return events.find((e) => e.date === date && e.time === time && e.id !== excludeId) || null;
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return "Starts now";
  if (diffMs < 60_000) return "Starts in <1m";
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (days >= 1) return `Starts in ${days} day${days > 1 ? "s" : ""}`;
  if (hours >= 1) {
    const remMin = Math.floor((diffMs % 3600000) / 60000);
    return remMin > 0 ? `Starts in ${hours}h ${remMin}m` : `Starts in ${hours}h`;
  }
  return `Starts in ${minutes}m`;
}

const QUICK_SUGGESTIONS = ["Tomorrow 2pm", "Next Monday", "In 3 days"];

function EventsPage() {
  const events = useEvents();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState<EventType>("Other");
  const [priority, setPriority] = useState<EventPriority>("Medium");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quick, setQuick] = useState("");
  const [, setTick] = useState(0);
  const [conflict, setConflict] = useState<EventItem | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [shakeField, setShakeField] = useState<string | null>(null);
  const [quickShake, setQuickShake] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<QuickAddParsed | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [actionSheetEvt, setActionSheetEvt] = useState<EventItem | null>(null);
  const [fabBounce, setFabBounce] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const sectionRefs = {
    today: useRef<HTMLDivElement>(null),
    tomorrow: useRef<HTMLDivElement>(null),
    week: useRef<HTMLDivElement>(null),
  };

  // Live parse preview
  const livePreview = useMemo(() => parseQuickAdd(quick), [quick]);

  // Recent titles autocomplete
  const recentTitles = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of events) {
      const t = e.title.trim();
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      out.push(t);
      if (out.length >= 5) break;
    }
    return out;
  }, [events]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Clear last-added highlight after animation
  useEffect(() => {
    if (!lastAddedId) return;
    const id = setTimeout(() => setLastAddedId(null), 800);
    return () => clearTimeout(id);
  }, [lastAddedId]);

  // FAB bounce: when no events, or after ~8s of user inactivity
  useEffect(() => {
    let idleTimer: number | undefined;
    let loopTimer: number | undefined;
    const trigger = () => { setFabBounce(true); window.setTimeout(() => setFabBounce(false), 750); };
    const scheduleIdle = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(trigger, 8000);
    };
    const onActivity = () => scheduleIdle();
    if (events.length === 0) {
      trigger();
      loopTimer = window.setInterval(trigger, 3200) as unknown as number;
    } else {
      scheduleIdle();
      window.addEventListener("pointerdown", onActivity, { passive: true });
      window.addEventListener("keydown", onActivity);
      window.addEventListener("scroll", onActivity, { passive: true });
    }
    return () => {
      window.clearTimeout(idleTimer);
      if (loopTimer) window.clearInterval(loopTimer);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
    };
  }, [events.length]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleComplete = (evt: EventItem) => {
    if (!evt.completed) {
      setJustCompletedId(evt.id);
      window.setTimeout(() => setJustCompletedId((c) => (c === evt.id ? null : c)), 700);
      toast.success("Done ✓");
    }
    toggleEventCompletion(evt.id);
  };

  

  const triggerShake = (field: string) => {
    setShakeField(field);
    setTimeout(() => setShakeField(null), 200);
  };

  const sectionForDate = (d: string): "today" | "tomorrow" | "week" | "upcoming" => {
    const todayStr = getTodayStr();
    const t = new Date(); t.setDate(t.getDate() + 1);
    const tomorrowStr = toDateStr(t);
    if (d === todayStr) return "today";
    if (d === tomorrowStr) return "tomorrow";
    const target = new Date(`${d}T00:00`).getTime();
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);
    if (target <= weekEnd.getTime()) return "week";
    return "upcoming";
  };

  const sectionLabel = (s: "today" | "tomorrow" | "week" | "upcoming") =>
    s === "today" ? "Today" : s === "tomorrow" ? "Tomorrow" : s === "week" ? "This Week" : "Upcoming";

  const afterSave = (id: string | undefined, savedDate: string) => {
    if (id) setLastAddedId(id);
    const sec = sectionForDate(savedDate);
    toast.success(`Added to ${sectionLabel(sec)} ✓`);
    requestAnimationFrame(() => {
      const ref =
        sec === "today" ? sectionRefs.today.current :
        sec === "tomorrow" ? sectionRefs.tomorrow.current :
        sectionRefs.week.current;
      ref?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Quick Add: Enter triggers confirmation chip (no auto-save)
  const handleQuickKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const parsed = parseQuickAdd(quick);
    if (parsed.confidence !== "high") {
      setQuickShake(true);
      setTimeout(() => setQuickShake(false), 200);
      return;
    }
    setPendingConfirm(parsed);
  };

  const confirmQuickAdd = () => {
    if (!pendingConfirm || pendingConfirm.confidence !== "high") return;
    const result = validateEvent({
      title: pendingConfirm.title,
      date: pendingConfirm.date,
      time: pendingConfirm.time,
      type: "Other",
      priority: "Medium",
      notes: "",
    });
    if (!result.ok) {
      setQuickShake(true);
      setTimeout(() => setQuickShake(false), 200);
      return;
    }
    const c = findConflict(events, result.data.date, result.data.time);
    if (c) toast.warning(`⚠️ Conflict with: ${c.title} (${c.time})`);
    const beforeIds = new Set(events.map((e) => e.id));
    addEvent(result.data);
    setQuick("");
    setPendingConfirm(null);
    // Find newly added id on next tick
    requestAnimationFrame(() => {
      const fresh = (typeof window !== "undefined") ? JSON.parse(localStorage.getItem("dailyos.events.v4") || "[]") : [];
      const newOne = fresh.find((e: EventItem) => !beforeIds.has(e.id));
      afterSave(newOne?.id, result.data.date);
    });
  };

  const editFromQuick = () => {
    if (!pendingConfirm) return;
    setTitle(pendingConfirm.title);
    setDate(pendingConfirm.date);
    setTime(pendingConfirm.time);
    setType("Other");
    setPriority("Medium");
    setNotes("");
    setEditingId(null);
    setErrors({});
    setConflict(null);
    setPendingConfirm(null);
    setQuick("");
    setSheetOpen(true);
  };

  const applySuggestion = (s: string) => {
    setQuick((prev) => (prev.trim() ? `${prev.trim()} ${s}` : s));
  };

  const resetForm = () => {
    setTitle(""); setDate(""); setTime("");
    setType("Other"); setPriority("Medium");
    setNotes(""); setEditingId(null);
    setConflict(null);
    setErrors({});
  };

  const openAdd = () => { resetForm(); setSheetOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateEvent({ title, date, time, type, priority, notes });
    if (!result.ok) {
      setErrors(result.errors);
      const firstBad = result.errors.title ? "title" : result.errors.date ? "date" : "time";
      triggerShake(firstBad);
      (firstBad === "title" ? titleRef : firstBad === "date" ? dateRef : timeRef).current?.focus();
      return;
    }
    setErrors({});
    if (!conflict) {
      const c = findConflict(events, result.data.date, result.data.time, editingId ?? undefined);
      if (c) { setConflict(c); return; }
    }
    if (editingId) {
      updateEvent(editingId, result.data);
      toast.success("Event updated");
      setConflict(null);
      resetForm();
      setSheetOpen(false);
    } else {
      const beforeIds = new Set(events.map((ev) => ev.id));
      addEvent(result.data);
      setConflict(null);
      resetForm();
      setSheetOpen(false);
      requestAnimationFrame(() => {
        const fresh = (typeof window !== "undefined") ? JSON.parse(localStorage.getItem("dailyos.events.v4") || "[]") : [];
        const newOne = fresh.find((ev: EventItem) => !beforeIds.has(ev.id));
        afterSave(newOne?.id, result.data.date);
      });
    }
  };

  const handleEdit = (evt: EventItem) => {
    setTitle(evt.title); setDate(evt.date); setTime(evt.time);
    setType(evt.type); setPriority(evt.priority);
    setNotes(evt.notes); setEditingId(evt.id);
    setErrors({});
    setSheetOpen(true);
  };

  const snoozeToTomorrow = (evt: EventItem) => {
    const d = new Date(`${evt.date}T00:00`);
    d.setDate(d.getDate() + 1);
    // If event is in the past, snooze to actual tomorrow
    const today = new Date(); today.setHours(0,0,0,0);
    if (d.getTime() <= today.getTime()) {
      d.setTime(today.getTime());
      d.setDate(d.getDate() + 1);
    }
    updateEvent(evt.id, {
      title: evt.title, date: toDateStr(d), time: evt.time,
      type: evt.type, priority: evt.priority, notes: evt.notes,
    });
    toast.success("Moved to tomorrow");
  };

  const now = Date.now();

  // Grouping
  const todayStr = getTodayStr();
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrowStr = toDateStr(tomorrowD);
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);
  const weekEndMs = weekEnd.getTime();

  const sectionToday: EventItem[] = [];
  const sectionTomorrow: EventItem[] = [];
  const sectionWeek: EventItem[] = [];
  const sectionMissed: EventItem[] = [];

  for (const evt of events) {
    const status = getEventStatus(evt, now);
    if (status === "missed") { sectionMissed.push(evt); continue; }
    if (evt.date === todayStr) { sectionToday.push(evt); continue; }
    if (evt.date === tomorrowStr) { sectionTomorrow.push(evt); continue; }
    const ts = new Date(`${evt.date}T${evt.time || "00:00"}`).getTime();
    if (ts > now && ts <= weekEndMs) { sectionWeek.push(evt); continue; }
    if (ts > now) sectionWeek.push(evt);
  }

  const byTime = (a: EventItem, b: EventItem) =>
    new Date(`${a.date}T${a.time || "00:00"}`).getTime() -
    new Date(`${b.date}T${b.time || "00:00"}`).getTime();
  sectionToday.sort(byTime);
  sectionTomorrow.sort(byTime);
  sectionWeek.sort(byTime);
  sectionMissed.sort((a, b) => -byTime(a, b));

  const todayCount = events.filter((e) => e.date === todayStr).length;
  const dashboard = [
    { label: "Today", count: todayCount, accent: "text-primary", bg: "bg-primary/5 border-primary/15" },
    { label: "Tomorrow", count: sectionTomorrow.length, accent: "text-foreground", bg: "bg-secondary/60 border-border/40" },
    { label: "Week", count: sectionWeek.length, accent: "text-foreground", bg: "bg-secondary/60 border-border/40" },
    { label: "Catch up", count: sectionMissed.length, accent: "text-amber-600", bg: "bg-amber-500/5 border-amber-500/20" },
  ];

  const renderEventCard = (evt: EventItem, i: number, opts?: { missed?: boolean }) => {
    const status = getEventStatus(evt, now);
    const evtDate = new Date(`${evt.date}T${evt.time}`);
    const isPast = evtDate.getTime() < now;
    const formattedDate = evtDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const formattedTime = evtDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const fullDate = evtDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const fullTime = evtDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const isCompleted = status === "completed";
    const isMissed = status === "missed";
    const isJustAdded = lastAddedId === evt.id;
    const isJustCompleted = justCompletedId === evt.id;
    const isExpanded = expandedIds.has(evt.id);

    return (
      <SwipeableRow
        key={evt.id}
        onSwipeRight={() => handleComplete(evt)}
        onSwipeLeft={() => setActionSheetEvt(evt)}
      >
        <div
          style={isJustAdded ? undefined : { animationDelay: `${Math.min(i * 50, 240)}ms` }}
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("button,input,[role=checkbox],a")) return;
            toggleExpanded(evt.id);
          }}
          className={`event-card-press bg-card border rounded-[1.25rem] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] p-4 cursor-pointer ${isJustAdded ? "animate-fly-down border-primary/40" : "animate-list-item-in border-border/60"} ${isCompleted ? "opacity-60" : ""} ${isMissed ? "opacity-80" : ""}`}
        >

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className={isJustCompleted ? "animate-check-pop inline-block" : "inline-block"}>
                <Checkbox
                  checked={evt.completed}
                  onCheckedChange={() => handleComplete(evt)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={isCompleted ? "Mark as incomplete" : "Mark as completed"}
                  className="shrink-0"
                />
              </span>
              <div className={`size-10 rounded-2xl flex items-center justify-center shrink-0 ${isMissed ? "bg-amber-500/10" : isPast ? "bg-muted" : "bg-primary/10"}`}>
                <CalendarDays className={`size-5 ${isMissed ? "text-amber-600" : isPast ? "text-muted-foreground" : "text-primary"}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className={`font-semibold text-foreground text-[0.95rem] truncate ${isCompleted ? "line-through" : ""} ${isJustCompleted ? "strike-anim" : ""}`}>
                    {evt.title}
                  </h4>
                  <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold bg-secondary text-muted-foreground border-border/60">
                    {evt.type}
                  </span>
                  <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${priorityColor(evt.priority)}`}>
                    {evt.priority}
                  </span>
                  {isMissed && (
                    <span className="inline-flex items-center rounded-md border px-1 py-0.5 text-[9px] font-semibold bg-amber-500/10 text-amber-600 border-amber-500/20">
                      Catch up
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{formattedDate} · {formattedTime}</p>
                {!isCompleted && !isMissed && (
                  <p className={`text-[11px] text-primary/80 mt-0.5 font-medium ${evtDate.getTime() - now < 60 * 60_000 && evtDate.getTime() > now ? "animate-countdown-pulse" : ""}`}>
                    {formatCountdown(evtDate.getTime() - now)}
                  </p>
                )}
                {!isExpanded && evt.notes && (
                  <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2">{evt.notes}</p>
                )}
                {opts?.missed && (
                  <button
                    onClick={(e) => { e.stopPropagation(); snoozeToTomorrow(evt); }}
                    className="press mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg px-2 py-1"
                  >
                    <MoveRight className="size-3" />
                    Move to tomorrow
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={(e) => { e.stopPropagation(); handleEdit(evt); }} aria-label="Edit event" className="press p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10">
                <Pencil className="size-4" />
              </button>
              <button onClick={(e) => {
                e.stopPropagation();
                const snapshot = evt;
                deleteEvent(evt.id);
                toast("Event deleted", {
                  action: {
                    label: "Undo",
                    onClick: () => addEvent({
                      title: snapshot.title, date: snapshot.date, time: snapshot.time,
                      type: snapshot.type, priority: snapshot.priority, notes: snapshot.notes,
                    }),
                  },
                });
              }} aria-label="Delete event" className="press p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <div className={`event-expand ${isExpanded ? "is-open" : ""}`}>
            <div className="pt-3 border-t border-border/50 space-y-1.5">
              <p className="text-sm font-semibold text-foreground break-words">{evt.title}</p>
              <p className="text-xs text-muted-foreground">{fullDate} · {fullTime}</p>
              {evt.notes ? (
                <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">{evt.notes}</p>
              ) : (
                <p className="text-xs text-muted-foreground/70 italic">No notes</p>
              )}
            </div>
          </div>
        </div>
      </SwipeableRow>
    );
  };

  const fieldErrCls = (field: "title" | "date" | "time") =>
    `${errors[field] ? "ring-2 ring-destructive/60 border-destructive/60" : ""} ${shakeField === field ? "animate-shake" : ""}`;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Events</h2>
            <p className="text-xs text-muted-foreground">{focusLineText(todayCount)}</p>
          </div>
        </div>
      </div>

      {/* Week strip */}
      <WeekStrip
        events={events}
        onDayTap={(dateStr, has, cell) => {
          const sec = sectionForDate(dateStr);
          const ref =
            sec === "today" ? sectionRefs.today.current :
            sec === "tomorrow" ? sectionRefs.tomorrow.current :
            sec === "week" ? sectionRefs.week.current : null;
          if (has && ref) {
            ref.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            cell.classList.remove("animate-shake");
            void cell.offsetWidth;
            cell.classList.add("animate-shake");
            window.setTimeout(() => cell.classList.remove("animate-shake"), 220);
          }
        }}
      />

      {/* Dashboard */}
      <div className="grid grid-cols-4 gap-2">
        {dashboard.map((d) => (
          <div key={d.label} className={`${d.bg} border rounded-xl px-2 py-1.5 text-center`}>
            <p className={`text-base font-bold leading-none ${d.accent}`}>{d.count}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">
              {d.label}
            </p>
          </div>
        ))}
      </div>

      {/* Today Focus */}
      <div className="rounded-[1.35rem] p-[1.5px] bg-gradient-to-br from-primary/60 via-primary/25 to-transparent shadow-[0_10px_30px_-12px_rgba(37,99,235,0.5)]">
        <TodayFocusCard events={events} now={now} />
      </div>

      {/* Quick Add */}
      <div className="space-y-2">
        <div className={`relative ${quickShake ? "animate-shake" : ""}`}>
          <Zap className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary pointer-events-none" />
          <input
            type="text"
            value={quick}
            onChange={(e) => { setQuick(e.target.value); setPendingConfirm(null); }}
            onKeyDown={handleQuickKey}
            placeholder="⚡ Quick add: exam tomorrow 2pm"
            list="recent-event-titles"
            className="w-full bg-card border border-border/60 rounded-2xl pl-9 pr-3 py-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 placeholder:text-muted-foreground/70 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]"
          />
          {recentTitles.length > 0 && (
            <datalist id="recent-event-titles">
              {recentTitles.map((t) => <option key={t} value={t} />)}
            </datalist>
          )}
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applySuggestion(s)}
              className="press text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-foreground/80 border border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Live preview / confirm chip */}
        {quick.trim() && !pendingConfirm && (
          <p className={`text-[12px] px-1 ${livePreview.confidence === "high" ? "text-primary" : livePreview.confidence === "low" ? "text-amber-600" : "text-muted-foreground"}`}>
            {livePreview.confidence === "high" ? "✨ " : livePreview.confidence === "low" ? "⚠️ " : "💡 "}
            {livePreview.hint}
            {livePreview.confidence === "high" && <span className="text-muted-foreground"> · Press Enter to confirm</span>}
          </p>
        )}

        {pendingConfirm && (
          <div className="animate-fly-down bg-primary/5 border border-primary/30 rounded-2xl p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-0.5">Confirm</p>
              <p className="text-sm font-semibold text-foreground truncate">
                📅 {prettyDate(pendingConfirm.date)} • {prettyTime(pendingConfirm.time)} — {pendingConfirm.title}
              </p>
            </div>
            <button
              type="button"
              onClick={editFromQuick}
              aria-label="Edit before saving"
              className="press p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirm(null)}
              aria-label="Cancel"
              className="press p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <X className="size-4" />
            </button>
            <button
              type="button"
              onClick={confirmQuickAdd}
              aria-label="Confirm and save"
              className="press p-2 rounded-xl bg-primary text-primary-foreground"
            >
              <Check className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Event List */}
      <div className="space-y-6">
        {events.length === 0 ? (
          <div className="text-center py-14">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-primary/10 mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <p className="text-base font-semibold text-foreground">Free day 🎉</p>
            <p className="text-sm text-muted-foreground mt-1">Plan something ahead 📅</p>
            <button
              onClick={openAdd}
              className="press mt-4 inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-2xl px-4 py-2 text-sm font-semibold shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)]"
            >
              <Plus className="size-4" />
              Add event
            </button>
          </div>
        ) : (
          <>
            <div ref={sectionRefs.today} className="space-y-2.5 scroll-mt-4">
              <div className="flex items-center gap-3 px-1">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-foreground/80">
                  📌 Today ({sectionToday.length})
                </p>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              {sectionToday.length === 0 ? (
                <div className="bg-secondary/40 border border-border/40 border-dashed rounded-2xl p-5 text-center">
                  <p className="text-2xl mb-1">🎉</p>
                  <p className="text-sm font-semibold text-foreground">Free day</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Plan something new</p>
                  <button
                    onClick={openAdd}
                    className="press mt-3 inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-3 py-1.5 text-xs font-semibold"
                  >
                    <Plus className="size-3.5" />
                    Add event
                  </button>
                </div>
              ) : (
                <div className="space-y-3">{sectionToday.map((evt, i) => renderEventCard(evt, i))}</div>
              )}
            </div>

            {sectionTomorrow.length > 0 && (
              <div ref={sectionRefs.tomorrow} className="space-y-2.5 scroll-mt-4">
                <div className="flex items-center gap-3 px-1">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-foreground/80">
                    📅 Tomorrow ({sectionTomorrow.length})
                  </p>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
                <div className="space-y-3">{sectionTomorrow.map((evt, i) => renderEventCard(evt, i))}</div>
              </div>
            )}

            {sectionWeek.length > 0 && (
              <div ref={sectionRefs.week} className="space-y-2.5 scroll-mt-4">
                <div className="flex items-center gap-3 px-1">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-foreground/80">
                    📆 This Week ({sectionWeek.length})
                  </p>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
                <div className="space-y-3">{sectionWeek.map((evt, i) => renderEventCard(evt, i))}</div>
              </div>
            )}

            {sectionMissed.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 px-1">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-amber-700">
                    Catch up ({sectionMissed.length})
                  </p>
                  <div className="flex-1 h-px bg-amber-500/30" />
                </div>
                <p className="text-[11px] text-muted-foreground px-1 -mt-1">Tap “Move to tomorrow” to reschedule.</p>
                <div className="space-y-3">{sectionMissed.map((evt, i) => renderEventCard(evt, i, { missed: true }))}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={openAdd}
        aria-label="Add event"
        className={`fab-press fixed bottom-24 right-5 z-40 size-14 rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-6px_rgba(37,99,235,0.55)] flex items-center justify-center transition-transform fab-glow ${fabBounce ? "animate-fab-bounce" : ""}`}
      >
        <Plus className="size-6" />
      </button>

      {/* Swipe-left action sheet */}
      <Sheet open={!!actionSheetEvt} onOpenChange={(o) => { if (!o) setActionSheetEvt(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl p-5">
          <SheetTitle className="text-base font-bold text-foreground mb-1">
            {actionSheetEvt?.title || "Event"}
          </SheetTitle>
          <p className="text-xs text-muted-foreground mb-4">Choose an action</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                if (!actionSheetEvt) return;
                snoozeToTomorrow(actionSheetEvt);
                setActionSheetEvt(null);
              }}
              className="press w-full flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 font-semibold text-sm"
            >
              <MoveRight className="size-4" />
              Snooze to tomorrow
            </button>
            <button
              onClick={() => {
                if (!actionSheetEvt) return;
                const snapshot = actionSheetEvt;
                deleteEvent(snapshot.id);
                setActionSheetEvt(null);
                toast("Event deleted", {
                  action: {
                    label: "Undo",
                    onClick: () => addEvent({
                      title: snapshot.title, date: snapshot.date, time: snapshot.time,
                      type: snapshot.type, priority: snapshot.priority, notes: snapshot.notes,
                    }),
                  },
                });
              }}
              className="press w-full flex items-center gap-3 p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-sm"
            >
              <Trash2 className="size-4" />
              Delete event
            </button>
            <button
              onClick={() => setActionSheetEvt(null)}
              className="press w-full p-3 rounded-2xl bg-secondary text-foreground font-semibold text-sm"
            >
              Cancel
            </button>
          </div>
        </SheetContent>
      </Sheet>


      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto p-5">
          <SheetTitle className="text-base font-bold text-foreground mb-3">
            {editingId ? "Edit Event" : "Add Event"}
          </SheetTitle>
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: undefined })); }}
                placeholder="Event title (e.g. Java Exam)"
                className={`w-full bg-secondary rounded-xl px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-semibold text-sm border border-transparent ${fieldErrCls("title")}`}
              />
              {errors.title && <p className="text-[11px] text-destructive mt-1 px-1">{errors.title}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    ref={dateRef}
                    type="date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setConflict(null); if (errors.date) setErrors((p) => ({ ...p, date: undefined })); }}
                    className={`w-full bg-secondary rounded-xl pl-9 pr-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none border border-transparent ${fieldErrCls("date")}`}
                  />
                </div>
                {errors.date && <p className="text-[11px] text-destructive mt-1 px-1">{errors.date}</p>}
              </div>
              <div>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    ref={timeRef}
                    type="time"
                    value={time}
                    onChange={(e) => { setTime(e.target.value); setConflict(null); if (errors.time) setErrors((p) => ({ ...p, time: undefined })); }}
                    className={`w-full bg-secondary rounded-xl pl-9 pr-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none border border-transparent ${fieldErrCls("time")}`}
                  />
                </div>
                {errors.time && <p className="text-[11px] text-destructive mt-1 px-1">{errors.time}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={type} onChange={(e) => setType(e.target.value as EventType)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none">
                {eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value as EventPriority)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none">
                {eventPriorities.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes (optional)"
              rows={2}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium text-sm resize-none"
            />
            {conflict && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 space-y-1.5 animate-list-item-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive shrink-0" />
                  <p className="text-sm font-semibold text-destructive">⚠️ Conflict with: {conflict.title}</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">You already have an event at this time ({conflict.time}).</p>
              </div>
            )}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className={`press flex-1 rounded-2xl py-3 font-semibold shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)] ${conflict ? "bg-destructive text-destructive-foreground shadow-[0_4px_16px_-4px_rgba(220,38,38,0.35)]" : "bg-primary text-primary-foreground"}`}
              >
                {conflict ? "Add anyway" : (editingId ? "Update Event" : "Add Event")}
              </button>
              <button
                type="button"
                onClick={() => { setSheetOpen(false); resetForm(); }}
                className="press px-5 py-3 rounded-2xl font-semibold text-muted-foreground bg-secondary hover:bg-secondary/80"
              >
                Cancel
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

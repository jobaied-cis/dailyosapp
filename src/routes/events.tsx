import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useEvents, addEvent, deleteEvent, toggleEventCompletion, updateEvent, getEventStatus } from "@/lib/events-store";
import type { EventType, EventPriority, EventItem } from "@/lib/events-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CalendarDays, Clock, Plus, Trash2, Calendar, Pencil, Flame, Zap, AlertTriangle } from "lucide-react";

function pad(n: number) { return String(n).padStart(2, "0"); }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseQuickAdd(input: string): { title: string; date: string; time: string } {
  let text = " " + input.trim() + " ";
  const today = new Date();
  let date = toDateStr(today);
  let time = "09:00";
  let dateFound = false;
  let timeFound = false;

  // time: 2pm, 10am, 5:30pm, 14:30
  const timeRe = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i;
  const tm = text.match(timeRe);
  if (tm) {
    let h: number, m: number;
    if (tm[3]) {
      h = parseInt(tm[1], 10) % 12;
      if (tm[3].toLowerCase() === "pm") h += 12;
      m = tm[2] ? parseInt(tm[2], 10) : 0;
    } else {
      h = parseInt(tm[4], 10);
      m = parseInt(tm[5], 10);
    }
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      time = `${pad(h)}:${pad(m)}`;
      timeFound = true;
      text = text.replace(tm[0], " ");
    }
  }

  // today / tomorrow
  if (/\btoday\b/i.test(text)) {
    date = toDateStr(today); dateFound = true;
    text = text.replace(/\btoday\b/i, " ");
  } else if (/\btomorrow\b/i.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    date = toDateStr(d); dateFound = true;
    text = text.replace(/\btomorrow\b/i, " ");
  } else {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      const re = new RegExp(`\\b${WEEKDAYS[i]}\\b`, "i");
      if (re.test(text)) {
        const cur = today.getDay();
        let diff = (i - cur + 7) % 7;
        if (diff === 0) diff = 7;
        const d = new Date(today); d.setDate(d.getDate() + diff);
        date = toDateStr(d); dateFound = true;
        text = text.replace(re, " ");
        break;
      }
    }
  }

  const title = text.replace(/\s+/g, " ").trim();
  return { title: title || input.trim(), date: dateFound ? date : toDateStr(today), time: timeFound ? time : "09:00" };
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

  return (
    <div className="bg-card border border-primary/30 rounded-[1.25rem] p-4 shadow-[0_2px_16px_-4px_rgba(37,99,235,0.18)] space-y-2">
      <div className="flex items-center gap-2">
        <Flame className="size-4 text-primary" />
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Today Focus</p>
      </div>

      {nextEvent ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeEmoji(nextEvent.type)}</span>
            <p className="font-semibold text-foreground text-sm truncate">{nextEvent.title}</p>
          </div>
          <p className="text-xs text-primary font-medium">⏳ {formatStartsIn(nextEvent.timeMs - now)}</p>
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

  const handleQuickAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const raw = quick.trim();
    if (!raw) return;
    const { title: t, date: d, time: tm } = parseQuickAdd(raw);
    const c = findConflict(events, d, tm);
    if (c) {
      toast.warning(`⚠️ Conflict with: ${c.title} (${c.time})`);
    }
    addEvent({ title: t, date: d, time: tm, type: "Other", priority: "Medium", notes: "" });
    setQuick("");
    toast.success("Event added ⚡");
  };


  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const resetForm = () => {
    setTitle(""); setDate(""); setTime("");
    setType("Other"); setPriority("Medium");
    setNotes(""); setEditingId(null);
    setConflict(null);
  };

  const openAdd = () => { resetForm(); setSheetOpen(true); };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !time) return;
    if (!conflict) {
      const c = findConflict(events, date, time);
      if (c) { setConflict(c); return; }
    }
    addEvent({ title: title.trim(), date, time, type, priority, notes });
    setConflict(null);
    resetForm();
    setSheetOpen(false);
  };

  const handleEdit = (evt: EventItem) => {
    setTitle(evt.title); setDate(evt.date); setTime(evt.time);
    setType(evt.type); setPriority(evt.priority);
    setNotes(evt.notes); setEditingId(evt.id);
    setSheetOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !title.trim() || !date || !time) return;
    if (!conflict) {
      const c = findConflict(events, date, time, editingId);
      if (c) { setConflict(c); return; }
    }
    updateEvent(editingId, { title: title.trim(), date, time, type, priority, notes });
    setConflict(null);
    resetForm();
    setSheetOpen(false);
  };

  const now = Date.now();

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CalendarDays className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Events</h2>
          <p className="text-xs text-muted-foreground">Upcoming schedule</p>
        </div>
      </div>

      {/* Today Focus */}
      <TodayFocusCard events={events} now={now} />

      {/* Quick Add */}
      <div className="relative">
        <Zap className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary pointer-events-none" />
        <input
          type="text"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={handleQuickAdd}
          placeholder="⚡ Quick add: exam tomorrow 2pm"
          className="w-full bg-card border border-border/60 rounded-2xl pl-9 pr-3 py-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 placeholder:text-muted-foreground/70 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]"
        />
      </div>

      {/* Event List */}

      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-secondary mb-5">
              <CalendarDays className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No events yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">Tap + to add your first event.</p>
          </div>
        ) : (
          events.map((evt, i) => {
            const status = getEventStatus(evt, now);
            const evtDate = new Date(`${evt.date}T${evt.time}`);
            const isPast = evtDate.getTime() < now;
            const formattedDate = evtDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
            const formattedTime = evtDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            const isCompleted = status === "completed";
            const isMissed = status === "missed";

            return (
              <div
                key={evt.id}
                style={{ animationDelay: `${Math.min(i * 50, 240)}ms` }}
                className={`bg-card border border-border/60 rounded-[1.25rem] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] p-4 flex items-center justify-between animate-list-item-in ${isCompleted || isMissed ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={evt.completed}
                    onCheckedChange={() => toggleEventCompletion(evt.id)}
                    aria-label={isCompleted ? "Mark as incomplete" : "Mark as completed"}
                    className="shrink-0"
                  />
                  <div className={`size-10 rounded-2xl flex items-center justify-center shrink-0 ${isPast ? "bg-muted" : "bg-primary/10"}`}>
                    <CalendarDays className={`size-5 ${isPast ? "text-muted-foreground" : "text-primary"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className={`font-semibold text-foreground text-[0.95rem] truncate ${isCompleted ? "line-through" : ""}`}>
                        {evt.title}
                      </h4>
                      <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold bg-secondary text-muted-foreground border-border/60">
                        {evt.type}
                      </span>
                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${priorityColor(evt.priority)}`}>
                        {evt.priority}
                      </span>
                      {isMissed && (
                        <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold bg-destructive/15 text-destructive border-destructive/20">
                          Missed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formattedDate} · {formattedTime}</p>
                    {!isCompleted && !isMissed && (
                      <p className="text-[11px] text-primary/80 mt-0.5 font-medium">
                        {formatCountdown(evtDate.getTime() - now)}
                      </p>
                    )}
                    {evt.notes && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2">{evt.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleEdit(evt)} aria-label="Edit event" className="press p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => deleteEvent(evt.id)} aria-label="Delete event" className="press p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={openAdd}
        aria-label="Add event"
        className="press fixed bottom-24 right-5 z-40 size-14 rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-6px_rgba(37,99,235,0.55)] flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="size-6" />
      </button>

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto p-5">
          <SheetTitle className="text-base font-bold text-foreground mb-3">
            {editingId ? "Edit Event" : "Add Event"}
          </SheetTitle>
          <form onSubmit={editingId ? handleUpdate : handleAdd} className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title (e.g. Java Exam)"
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-semibold text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setConflict(null); }} className="w-full bg-secondary rounded-xl pl-9 pr-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none" />
              </div>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setConflict(null); }} className="w-full bg-secondary rounded-xl pl-9 pr-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none" />
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
                disabled={!title.trim() || !date || !time}
                className={`press flex-1 rounded-2xl py-3 font-semibold shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)] disabled:opacity-40 disabled:shadow-none ${conflict ? "bg-destructive text-destructive-foreground shadow-[0_4px_16px_-4px_rgba(220,38,38,0.35)]" : "bg-primary text-primary-foreground"}`}
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

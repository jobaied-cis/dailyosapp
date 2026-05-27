import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useEvents, addEvent, deleteEvent, toggleEventCompletion, getEventStatus } from "@/lib/events-store";
import type { EventType, EventPriority } from "@/lib/events-store";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, Clock, Plus, Trash2, Calendar } from "lucide-react";

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
    case "High":
      return "bg-destructive/15 text-destructive border-destructive/20";
    case "Medium":
      return "bg-amber-500/15 text-amber-600 border-amber-500/20";
    case "Low":
      return "bg-muted text-muted-foreground border-border";
  }
}

function typeLabel(type: EventType) {
  return type;
}

function EventsPage() {
  const events = useEvents();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState<EventType>("Other");
  const [priority, setPriority] = useState<EventPriority>("Medium");
  const [notes, setNotes] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !time) return;
    addEvent({ title: title.trim(), date, time, type, priority, notes });
    setTitle("");
    setDate("");
    setTime("");
    setType("Other");
    setPriority("Medium");
    setNotes("");
  };

  const now = Date.now();

  return (
    <div className="space-y-6 pb-8">
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

      {/* Add Event Form */}
      <form
        onSubmit={handleAdd}
        className="bg-card border border-border/60 rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-3"
      >
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-muted-foreground" />
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Add Event
          </p>
        </div>

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
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-secondary rounded-xl pl-9 pr-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none"
            />
          </div>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-secondary rounded-xl pl-9 pr-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventType)}
            className="w-full bg-secondary rounded-xl px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none"
          >
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as EventPriority)}
            className="w-full bg-secondary rounded-xl px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-semibold text-sm appearance-none"
          >
            {eventPriorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!title.trim() || !date || !time}
          className="press w-full bg-primary text-primary-foreground rounded-2xl py-3 font-semibold shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)] disabled:opacity-40 disabled:shadow-none"
        >
          Add Event
        </button>
      </form>

      {/* Event List */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-secondary mb-5">
              <CalendarDays className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No events yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              Add an event to get started.
            </p>
          </div>
        ) : (
          events.map((evt, i) => {
            const status = getEventStatus(evt, now);
            const evtDate = new Date(`${evt.date}T${evt.time}`);
            const isPast = evtDate.getTime() < now;
            const formattedDate = evtDate.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const formattedTime = evtDate.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            });
            const isCompleted = status === "completed";
            const isMissed = status === "missed";

            return (
              <div
                key={evt.id}
                style={{ animationDelay: `${Math.min(i * 50, 240)}ms` }}
                className={`bg-card border border-border/60 rounded-[1.25rem] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] p-4 flex items-center justify-between animate-list-item-in ${
                  isCompleted || isMissed ? "opacity-60" : ""
                }`}
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
                        {typeLabel(evt.type)}
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formattedDate} · {formattedTime}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteEvent(evt.id)}
                  aria-label="Delete event"
                  className="press p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

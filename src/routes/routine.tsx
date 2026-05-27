import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, Fragment } from "react";
import { addTask, deleteTask, toggleTask, useTasks, type Task } from "@/lib/tasks-store";
import { Check, ClipboardList, Plus, Trash2, X } from "lucide-react";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getTaskEndMinutes(t: Task): number {
  if (t.endTime) return toMinutes(t.endTime);
  return toMinutes(t.time) + 30;
}

function formatGap(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m free`;
  if (h > 0) return `${h}h free`;
  return `${m} min free`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}



export const Route = createFileRoute("/routine")({
  head: () => ({
    meta: [
      { title: "Routine — DailyOS" },
      { name: "description", content: "Your chronological daily routine checklist." },
    ],
  }),
  component: RoutinePage,
});

function RoutinePage() {
  const tasks = useTasks();
  const [open, setOpen] = useState(false);
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pct = total ? (done / total) * 100 : 0;

  // Real-time clock — client-only to avoid SSR hydration mismatch
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : -1;

  // Compute per-task time intelligence based on start/end block
  const taskMeta = tasks.map((t) => {
    const start = toMinutes(t.time);
    const end = getTaskEndMinutes(t);
    const isActive = now !== null && !t.completed && nowMin >= start && nowMin < end;
    const isMissed = now !== null && !t.completed && nowMin >= end;
    return { start, end, isActive, isMissed };
  });

  // Index where "You are here" divider should appear (only after clock is set)
  let hereIndex = now === null ? -2 : tasks.findIndex((t) => toMinutes(t.time) > nowMin);
  if (now !== null && hereIndex === -1 && tasks.length > 0 && nowMin < toMinutes(tasks[0].time)) hereIndex = 0;


  // Group sorted tasks into time sections
  type SectionItem = { label: string; icon: string; tasks: Task[]; originalIndices: number[] };
  const sections: SectionItem[] = [];
  let current: SectionItem | null = null;

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const m = toMinutes(t.time);
    let label: string;
    let icon: string;
    if (m >= 300 && m < 720) { label = "Morning"; icon = "\u{1F305}"; }
    else if (m >= 720 && m < 1020) { label = "Afternoon"; icon = "\u2600\uFE0F"; }
    else if (m >= 1020 && m < 1260) { label = "Evening"; icon = "\u{1F306}"; }
    else { label = "Night"; icon = "\u{1F319}"; }

    if (!current || current.label !== label) {
      current = { label, icon, tasks: [], originalIndices: [] };
      sections.push(current);
    }
    current.tasks.push(t);
    current.originalIndices.push(i);
  }

  return (
    <div className="space-y-6">

      <section className="bg-card border border-border/60 rounded-[1.75rem] p-5 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)]">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-bold text-foreground text-lg tracking-tight">Today's routine</h2>
          <span className="text-sm font-mono font-medium text-muted-foreground">{done}/{total}</span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs font-semibold text-primary mt-3 animate-fade-in-up">
          {encouragement(pct)}
        </p>
      </section>

      <ul className="space-y-3">
        {sections.map((section) => (
          <Fragment key={section.label}>
            <li className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80 px-1 select-none pt-1">
              <span className="flex-1 h-px bg-border/60" />
              {section.label} {section.icon}
              <span className="flex-1 h-px bg-border/60" />
            </li>
            {section.tasks.map((t, si) => {
              const i = section.originalIndices[si];
              const { isActive, isMissed } = taskMeta[i];
              return (
                <Fragment key={t.id}>
                  {hereIndex === i && (
                    <li className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70 px-1 select-none">
                      <span className="flex-1 h-px bg-primary/25" />
                      You are here
                      <span className="flex-1 h-px bg-primary/25" />
                    </li>
                  )}
                  <li
                    style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
                    className={`group flex items-start gap-3.5 bg-card border rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] animate-list-item-in transition-all duration-300 hover:shadow-[0_4px_20px_-6px_rgba(15,23,42,0.1)] ${
                      t.completed ? "opacity-55 scale-[0.99] border-border/60" :
                      isActive ? "border-primary/60 shadow-[0_0_0_3px_rgba(37,99,235,0.12),0_4px_20px_-4px_rgba(37,99,235,0.25)]" :
                      isMissed ? "border-destructive/40 opacity-75" :
                      "border-border/60"
                    }`}
                  >
                    <button
                      onClick={() => toggleTask(t.id)}
                      aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                      className={`press mt-0.5 size-7 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        t.completed
                          ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/25"
                          : "border-border hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      {t.completed && <Check className="size-3.5 animate-check-pop" strokeWidth={3} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3
                          key={t.completed ? "done" : "todo"}
                          className={`font-semibold text-foreground truncate text-[0.95rem] transition-colors duration-300 ${
                            t.completed ? "strike-anim text-muted-foreground" : ""
                          }`}
                        >
                          {t.title}
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isActive && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                              Now 🔥
                            </span>
                          )}
                          {isMissed && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
                              Missed
                            </span>
                          )}
                          {!t.completed && !isActive && !isMissed && now !== null && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                              Upcoming
                            </span>
                          )}
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs font-mono font-medium text-muted-foreground">
                              {t.endTime ? `${t.time} – ${t.endTime}` : t.time}
                            </span>
                            {t.endTime && (
                              <span className="text-[10px] font-medium text-muted-foreground/60">
                                {formatDuration(getTaskEndMinutes(t) - toMinutes(t.time))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {t.note && (
                        <p className={`text-sm text-muted-foreground mt-1 leading-relaxed transition-opacity duration-300 ${t.completed ? "line-through opacity-70" : ""}`}>
                          {t.note}
                        </p>
                      )}

                    </div>
                    <button
                      onClick={() => deleteTask(t.id)}
                      aria-label="Delete task"
                      className="press text-muted-foreground/40 hover:text-destructive p-1.5 rounded-full hover:bg-destructive/5"
                    >
                    <Trash2 className="size-4" />
                  </button>
                </li>
                {i < tasks.length - 1 && (() => {
                  const currentEnd = getTaskEndMinutes(t);
                  const nextStart = toMinutes(tasks[i + 1].time);
                  const gapMin = nextStart - currentEnd;
                  if (gapMin <= 15) return null;
                  return (
                    <li className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/50 px-1 select-none py-1">
                      <span className="flex-1 h-px bg-border/30" />
                      {formatGap(gapMin)}
                      <span className="flex-1 h-px bg-border/30" />
                    </li>
                  );
                })()}
              </Fragment>
              );
            })}
          </Fragment>
        ))}
        {hereIndex === -1 && tasks.length > 0 && (
          <li className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70 px-1 select-none">
            <span className="flex-1 h-px bg-primary/25" />
            You are here
            <span className="flex-1 h-px bg-primary/25" />
          </li>
        )}

        {tasks.length === 0 && (
          <li className="text-center text-muted-foreground py-16">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-secondary mb-5">
              <ClipboardList className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No tasks yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">Add your first routine</p>
          </li>
        )}
      </ul>

      <button
        onClick={() => setOpen(true)}
        aria-label="Add task"
        className="press fixed bottom-24 right-1/2 translate-x-[calc(50%+7.5rem)] size-14 rounded-full bg-primary text-primary-foreground shadow-[0_8px_28px_-6px_rgba(37,99,235,0.45)] flex items-center justify-center hover:shadow-[0_12px_36px_-6px_rgba(37,99,235,0.55)]"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      {open && <AddTaskSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

function encouragement(pct: number): string {
  if (pct === 0) return "Let's get started";
  if (pct === 100) return "All done. Great job!";
  if (pct < 30) return "Let's get started";
  if (pct < 50) return "Keep it up";
  if (pct < 75) return "Good progress";
  return "Almost there";
}

function AddTaskSheet({ onClose }: { onClose: () => void }) {
  const [time, setTime] = useState("08:00");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({ time, endTime: endTime || undefined, title, note });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-md">
      <div className="w-full max-w-md bg-card rounded-t-[1.75rem] p-6 shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.15)] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground tracking-tight">New task</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Time">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-medium"
            />
          </Field>
          <Field label="End time (optional)">
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-medium"
            />
          </Field>
          <Field label="Title">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning run"
              className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium"
            />
          </Field>
          <Field label="Note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything to remember…"
              className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 resize-none font-medium"
            />
          </Field>
          <button
            type="submit"
            disabled={!title.trim()}
            className="press w-full bg-primary text-primary-foreground rounded-[1.25rem] py-4 font-semibold shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)] disabled:opacity-45 disabled:shadow-none mt-2"
          >
            Add task
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

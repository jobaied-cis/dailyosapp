import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, Fragment } from "react";
import { addTask, deleteTask, editTask, toggleTask, useTasks, type Task } from "@/lib/tasks-store";
import { useStreak } from "@/lib/streak-store";
import { Check, ClipboardList, Pencil, Play, Pause, Plus, Trash2, X } from "lucide-react";

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
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
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

  // Daily summary
  const missedCount = taskMeta.filter((m) => m.isMissed).length;
  const plannedMin = tasks.reduce((sum, t) => sum + Math.max(0, getTaskEndMinutes(t) - toMinutes(t.time)), 0);
  const lastEnd = tasks.length ? Math.max(...tasks.map((t) => getTaskEndMinutes(t))) : 0;
  const endOfDay = now !== null && tasks.length > 0 && nowMin >= lastEnd;
  const allDone = total > 0 && done === total;
  const streak = useStreak(allDone, endOfDay && !allDone);

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

  const progressLabel =
    allDone
      ? "All done 🎉"
      : missedCount > 0
      ? "Behind schedule ⚠️"
      : pct === 0
      ? "Starting..."
      : pct >= 75
      ? "Almost there 🔥"
      : "On track ✅";

  return (
    <div className="space-y-5">

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center justify-center">
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
            🔥 {streak} day streak
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border/60 rounded-2xl p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">Done</p>
          <p className="text-2xl font-bold text-foreground">{done}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-2xl p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">Left</p>
          <p className="text-2xl font-bold text-foreground">{total - done}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-2xl p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">Planned</p>
          <p className="text-2xl font-bold text-foreground">{formatDuration(plannedMin) || "0m"}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card border border-border/60 rounded-[1.25rem] p-5 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-foreground">Today&apos;s progress</span>
          <span className="text-sm font-bold text-foreground">{Math.round(pct)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={`text-xs font-medium text-center mt-3.5 ${
          allDone ? "text-primary" : missedCount > 0 ? "text-destructive" : "text-muted-foreground"
        }`}>
          {progressLabel}
        </p>
      </div>

      {/* Current Task */}
      {now !== null && (() => {
        const activeIndex = taskMeta.findIndex((m) => m.isActive);
        const activeTask = activeIndex >= 0 ? tasks[activeIndex] : null;
        if (activeTask) {
          const end = getTaskEndMinutes(activeTask);
          const remaining = Math.max(0, end - nowMin);
          return (
            <div className="bg-card border border-primary/40 rounded-[1.25rem] p-5 shadow-[0_0_0_3px_rgba(37,99,235,0.08),0_8px_32px_-8px_rgba(37,99,235,0.2)] relative">
              <button
                onClick={() => { setEditingTask(activeTask); setEditOpen(true); }}
                className="absolute top-4 right-4 text-muted-foreground/50 hover:text-primary p-1.5 rounded-full hover:bg-primary/5 transition-colors"
                aria-label="Edit task"
              >
                <Pencil className="size-4" />
              </button>
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary px-2 py-1 rounded-full bg-primary/10">
                  Now 🔥
                </span>
                <h3 className="text-lg font-bold text-foreground mt-3">{activeTask.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTask.endTime ? `${activeTask.time} – ${activeTask.endTime}` : activeTask.time}
                </p>
                <p className="text-2xl font-bold text-primary mt-3">
                  ⏳ {formatDuration(remaining)} left
                </p>
                <button
                  onClick={() => setFocusTask(activeTask)}
                  className="press mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-full text-sm shadow-[0_4px_16px_-4px_rgba(37,99,235,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(37,99,235,0.5)]"
                >
                  <Play className="size-4" strokeWidth={2.5} /> Start Focus
                </button>
              </div>
            </div>
          );
        }
        return (
          <div className="bg-card/60 border border-border/40 rounded-[1.25rem] p-5 text-center">
            <p className="text-sm text-muted-foreground">No active task right now 😌</p>
          </div>
        );
      })()}

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
      {editOpen && editingTask && (
        <EditTaskSheet task={editingTask} onClose={() => { setEditOpen(false); setEditingTask(null); }} />
      )}
      {focusTask && (
        <FocusMode
          task={focusTask}
          onClose={() => setFocusTask(null)}
          onComplete={() => {
            if (!focusTask.completed) toggleTask(focusTask.id);
            setFocusTask(null);
          }}
        />
      )}
    </div>
  );
}




function AddTaskSheet({ onClose }: { onClose: () => void }) {
  const [time, setTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:30");
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-medium"
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-medium"
              />
            </Field>
          </div>

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

function EditTaskSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const [time, setTime] = useState(task.time);
  const [endTime, setEndTime] = useState(task.endTime || "");
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note || "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    editTask(task.id, { time, endTime: endTime || undefined, title, note });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-md">
      <div className="w-full max-w-md bg-card rounded-t-[1.75rem] p-6 shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.15)] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground tracking-tight">Edit task</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-medium"
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 font-medium"
              />
            </Field>
          </div>

          <Field label="Title">
            <input
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
            Save changes
          </button>
        </form>
      </div>
    </div>
  );
}

function FocusMode({ task, onClose, onComplete }: { task: Task; onClose: () => void; onComplete: () => void }) {
  const initial = (() => {
    const end = task.endTime ? toMinutes(task.endTime) : toMinutes(task.time) + 30;
    const now = new Date();
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    return Math.max(0, end * 60 - nowSec);
  })();
  const [remaining, setRemaining] = useState(initial);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const hh = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const mm = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const timesUp = remaining === 0;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-6 animate-in fade-in duration-300">
      <button
        onClick={onClose}
        aria-label="Exit focus"
        className="absolute top-5 right-5 text-slate-400 hover:text-slate-100 p-2 rounded-full hover:bg-white/5"
      >
        <X className="size-6" />
      </button>

      <h2 className="text-xl md:text-2xl font-semibold text-slate-300 text-center mb-12 max-w-md">
        {task.title}
      </h2>

      <div className="text-6xl md:text-8xl font-mono font-bold tabular-nums tracking-tight text-white">
        {hh}:{mm}:{ss}
      </div>

      {timesUp && (
        <p className="mt-6 text-lg font-semibold text-orange-400">Time's up ⏰</p>
      )}

      <div className="flex items-center gap-3 mt-14">
        {!paused ? (
          <button
            onClick={() => setPaused(true)}
            disabled={timesUp}
            className="press inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-5 py-3 rounded-full disabled:opacity-40"
          >
            <Pause className="size-4" /> Pause
          </button>
        ) : (
          <button
            onClick={() => setPaused(false)}
            disabled={timesUp}
            className="press inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-5 py-3 rounded-full disabled:opacity-40"
          >
            <Play className="size-4" /> Resume
          </button>
        )}
        <button
          onClick={onComplete}
          className="press inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-full shadow-[0_8px_28px_-6px_rgba(37,99,235,0.5)]"
        >
          <Check className="size-4" strokeWidth={3} /> Complete
        </button>
      </div>
    </div>
  );
}

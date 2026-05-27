import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, Fragment } from "react";
import { addTask, deleteTask, toggleTask, useTasks } from "@/lib/tasks-store";
import { Check, ClipboardList, Plus, Trash2, X } from "lucide-react";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
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

  // Real-time clock — re-render every 30s
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Compute per-task time intelligence
  const taskMeta = tasks.map((t, i) => {
    const start = toMinutes(t.time);
    const end = i < tasks.length - 1 ? toMinutes(tasks[i + 1].time) : 24 * 60;
    const isActive = !t.completed && nowMin >= start && nowMin < end;
    const isMissed = !t.completed && nowMin >= end;
    return { start, end, isActive, isMissed };
  });

  // Index where "You are here" divider should appear (before first task whose start > now)
  let hereIndex = tasks.findIndex((t) => toMinutes(t.time) > nowMin);
  if (hereIndex === -1 && tasks.length > 0 && nowMin < toMinutes(tasks[0].time)) hereIndex = 0;



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
        {tasks.map((t, i) => (
          <li
            key={t.id}
            style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
            className={`group flex items-start gap-3.5 bg-card border border-border/60 rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] animate-list-item-in transition-all duration-300 hover:shadow-[0_4px_20px_-6px_rgba(15,23,42,0.1)] ${
              t.completed ? "opacity-55 scale-[0.99]" : ""
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
                <span className="text-xs font-mono font-medium text-muted-foreground shrink-0">{t.time}</span>
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
        ))}
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
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({ time, title, note });
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

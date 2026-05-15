import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { addTask, deleteTask, toggleTask, useTasks } from "@/lib/tasks-store";
import { Check, Plus, Trash2, X } from "lucide-react";

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

  return (
    <div className="space-y-5">
      <section className="bg-card border border-border rounded-3xl p-5 shadow-sm">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold text-foreground">Today's routine</h2>
          <span className="text-sm font-mono text-muted-foreground">{done}/{total}</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <ul className="space-y-2.5">
        {tasks.map((t) => (
          <li
            key={t.id}
            className={`group flex items-start gap-3 bg-card border border-border rounded-2xl p-4 shadow-sm transition-all ${
              t.completed ? "opacity-60" : ""
            }`}
          >
            <button
              onClick={() => toggleTask(t.id)}
              aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
              className={`mt-0.5 size-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                t.completed
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border hover:border-primary"
              }`}
            >
              {t.completed && <Check className="size-3.5" strokeWidth={3} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <h3
                  className={`font-medium text-foreground truncate ${
                    t.completed ? "line-through" : ""
                  }`}
                >
                  {t.title}
                </h3>
                <span className="text-xs font-mono text-muted-foreground shrink-0">{t.time}</span>
              </div>
              {t.note && (
                <p className={`text-sm text-muted-foreground mt-0.5 ${t.completed ? "line-through" : ""}`}>
                  {t.note}
                </p>
              )}
            </div>
            <button
              onClick={() => deleteTask(t.id)}
              aria-label="Delete task"
              className="text-muted-foreground hover:text-destructive p-1"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="text-center text-muted-foreground py-12 text-sm">
            No tasks yet. Tap + to add one.
          </li>
        )}
      </ul>

      <button
        onClick={() => setOpen(true)}
        aria-label="Add task"
        className="fixed bottom-24 right-1/2 translate-x-[calc(50%+9rem)] size-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="size-6" />
      </button>

      {open && <AddTaskSheet onClose={() => setOpen(false)} />}
    </div>
  );
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">New task</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground p-1">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Time">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Title">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning run"
              className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
          </Field>
          <Field label="Note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything to remember…"
              className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground resize-none"
            />
          </Field>
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-medium shadow-sm shadow-primary/20 disabled:opacity-50 active:scale-[0.99] transition-transform mt-2"
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
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

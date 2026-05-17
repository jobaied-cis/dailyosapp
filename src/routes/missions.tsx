import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Target, Trash2, X } from "lucide-react";
import { addMission, deleteMission, missionProgress, useMissions } from "@/lib/missions-store";

export const Route = createFileRoute("/missions")({
  head: () => ({
    meta: [
      { title: "Missions — DailyOS" },
      { name: "description", content: "Track long-term missions and goals." },
    ],
  }),
  component: MissionsPage,
});

function MissionsPage() {
  const missions = useMissions();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border/60 rounded-[1.75rem] p-5 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)]">
        <h2 className="font-bold text-foreground text-lg tracking-tight">Missions</h2>
        <p className="text-sm text-muted-foreground mt-1">Track progress toward your goals.</p>
      </section>

      <ul className="space-y-3">
        {missions.map((m, i) => {
          const { total, done, pct } = missionProgress(m);
          return (
            <li
              key={m.id}
              style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
              className="animate-list-item-in"
            >
              <Link
                to="/missions/$missionId"
                params={{ missionId: m.id }}
                className="press block bg-card border border-border/60 rounded-[1.25rem] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] hover:shadow-[0_4px_20px_-6px_rgba(15,23,42,0.1)] transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-[0.95rem] truncate">{m.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {done}/{total} steps{m.durationDays ? ` · ${m.durationDays} days` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden mt-3">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
        {missions.length === 0 && (
          <li className="text-center text-muted-foreground py-16">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-secondary mb-5">
              <Target className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No missions yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">Create your first goal</p>
          </li>
        )}
      </ul>

      <button
        onClick={() => setOpen(true)}
        aria-label="Add mission"
        className="press fixed bottom-24 right-1/2 translate-x-[calc(50%+7.5rem)] size-14 rounded-full bg-primary text-primary-foreground shadow-[0_8px_28px_-6px_rgba(37,99,235,0.45)] flex items-center justify-center hover:shadow-[0_12px_36px_-6px_rgba(37,99,235,0.55)]"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      {open && <AddMissionSheet onClose={() => setOpen(false)} />}

      {missions.length > 0 && (
        <button
          onClick={() => {
            if (confirm("Delete all missions?")) missions.forEach((m) => deleteMission(m.id));
          }}
          className="sr-only"
          aria-hidden
        />
      )}
    </div>
  );
}

function AddMissionSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addMission({
      title,
      durationDays: duration ? Number(duration) : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-md">
      <div className="w-full max-w-md bg-card rounded-t-[1.75rem] p-6 shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.15)] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground tracking-tight">New mission</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Title">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Learn Java in 20 days"
              className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium"
            />
          </Field>
          <Field label="Duration in days (optional)">
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="20"
              className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium"
            />
          </Field>
          <button
            type="submit"
            disabled={!title.trim()}
            className="press w-full bg-primary text-primary-foreground rounded-[1.25rem] py-4 font-semibold shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)] disabled:opacity-45 disabled:shadow-none mt-2"
          >
            Create mission
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

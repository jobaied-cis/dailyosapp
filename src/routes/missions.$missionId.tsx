import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Plus, Trash2, X } from "lucide-react";
import type { FormEvent } from "react";
import {
  addStep,
  deleteMission,
  deleteStep,
  missionProgress,
  toggleStep,
  useMission,
  type MissionStep,
} from "@/lib/missions-store";

export const Route = createFileRoute("/missions/$missionId")({
  head: () => ({
    meta: [{ title: "Mission — DailyOS" }],
  }),
  component: MissionDetailPage,
});

function MissionDetailPage() {
  const { missionId } = Route.useParams();
  const navigate = useNavigate();
  const mission = useMission(missionId);

  if (!mission) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Mission not found.</p>
        <Link to="/missions" className="press inline-block mt-4 text-primary font-semibold">
          Back to missions
        </Link>
      </div>
    );
  }

  const { total, done, pct } = missionProgress(mission);
  const steps = [...mission.steps].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link
          to="/missions"
          className="press inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Missions
        </Link>
        <button
          onClick={() => {
            if (confirm("Delete this mission?")) {
              deleteMission(mission.id);
              navigate({ to: "/missions" });
            }
          }}
          aria-label="Delete mission"
          className="press text-muted-foreground/60 hover:text-destructive p-1.5 rounded-full hover:bg-destructive/5"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <section className="bg-card border border-border/60 rounded-[1.75rem] p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)]">
        <h2 className="font-bold text-foreground text-xl tracking-tight leading-tight">{mission.title}</h2>
        <div className="flex items-baseline justify-between mt-3">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            {done}/{total} topics
          </p>
          <span className="text-2xl font-extrabold text-primary tabular-nums">{pct}%</span>
        </div>
        <div className="h-4 rounded-full bg-secondary overflow-hidden mt-4">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <section className="space-y-3">
        {steps.length > 0 && (
          <ul className="space-y-2">
            {steps.map((s, i) => (
              <StepRow key={s.id} step={s} index={i} missionId={missionId} />
            ))}
          </ul>
        )}
        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No topics yet. Add your first one below.
          </p>
        )}
        <AddTopicForm missionId={missionId} hasSteps={steps.length > 0} />
      </section>
    </div>
  );
}

function AddTopicForm({ missionId, hasSteps }: { missionId: string; hasSteps: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    addStep(missionId, title);
    setValue("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-primary bg-primary/5 hover:bg-primary/10 border border-dashed border-primary/30 rounded-xl py-2.5 transition-colors"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        {hasSteps ? "Add topic" : "Add first topic"}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Topic title…"
        maxLength={200}
        className="flex-1 bg-background border border-border/60 rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium"
      />
      <button
        type="button"
        onClick={() => {
          setValue("");
          setOpen(false);
        }}
        className="press text-xs font-semibold text-muted-foreground px-3 py-2.5 rounded-lg hover:bg-secondary"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!value.trim()}
        className="press text-xs font-bold text-primary-foreground bg-primary px-4 py-2.5 rounded-lg disabled:opacity-45"
      >
        Add
      </button>
    </form>
  );
}

type StepRowProps = {
  step: MissionStep;
  index: number;
  missionId: string;
};

function StepRow({ step, index, missionId }: StepRowProps) {
  const liClass =
    "group flex items-center gap-3 bg-muted/40 border border-border/30 rounded-xl p-3 animate-list-item-in transition-all duration-300 " +
    (step.completed ? "opacity-55" : "");
  const checkClass =
    "press size-6 rounded-full border-2 flex items-center justify-center shrink-0 " +
    (step.completed
      ? "bg-primary border-primary text-primary-foreground"
      : "border-border hover:border-primary hover:bg-primary/5");
  const titleClass =
    "flex-1 font-medium text-foreground text-[0.92rem] transition-colors duration-300 leading-snug " +
    (step.completed ? "line-through text-muted-foreground" : "");

  return (
    <li style={{ animationDelay: `${Math.min(index * 30, 180)}ms` }} className={liClass}>
      <button
        onClick={() => toggleStep(missionId, step.id)}
        aria-label={step.completed ? "Mark incomplete" : "Mark complete"}
        className={checkClass}
      >
        {step.completed && <Check className="size-3 animate-check-pop" strokeWidth={3} />}
      </button>
      <span className={titleClass}>{step.title}</span>
      <button
        onClick={() => deleteStep(missionId, step.id)}
        aria-label="Delete step"
        className="press opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive p-1 rounded-full hover:bg-destructive/5 transition-opacity"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

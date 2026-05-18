import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Plus, Trash2, X } from "lucide-react";
import {
  addStep,
  deleteMission,
  deleteStep,
  missionProgress,
  stepDate,
  toggleStep,
  useMission,
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
  const [newStep, setNewStep] = useState("");

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStep.trim()) return;
    addStep(mission.id, newStep);
    setNewStep("");
  };

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
        {mission.startDate && (
          <p className="text-[11px] font-bold text-primary uppercase tracking-[0.14em] mt-2">
            Starts {stepDate(mission, 0)?.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
        <div className="flex items-baseline justify-between mt-3">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            {done}/{total} steps{mission.durationDays ? ` · ${mission.durationDays} days` : ""}
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

      <ul className="space-y-3">
        {mission.steps.map((s, i) => (
          <StepRow
            key={s.id}
            step={s}
            index={i}
            missionId={mission.id}
            date={stepDate(mission, i)}
          />
        ))}
        {mission.steps.length === 0 && (
          <li className="text-center text-muted-foreground py-10">
            <p className="text-sm">No steps yet. Add the first one below.</p>
          </li>
        )}
      </ul>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          placeholder="Add a step…"
          className="flex-1 bg-card border border-border/60 rounded-[1.25rem] px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 font-medium text-[0.95rem]"
        />
        <button
          type="submit"
          disabled={!newStep.trim()}
          aria-label="Add step"
          className="press size-12 rounded-full bg-primary text-primary-foreground shadow-[0_4px_16px_-4px_rgba(37,99,235,0.35)] flex items-center justify-center shrink-0 disabled:opacity-45 disabled:shadow-none"
        >
          <Plus className="size-5" strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}

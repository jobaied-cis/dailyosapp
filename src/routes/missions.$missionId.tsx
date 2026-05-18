import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, Trash2, X } from "lucide-react";
import {
  addStep,
  deleteMission,
  deleteStep,
  missionProgress,
  stepDate,
  stepDay,
  toggleStep,
  useMission,
  type Mission,
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
  const [newStep, setNewStep] = useState("");
  const [targetDay, setTargetDay] = useState(1);

  const grouped = useMemo(() => groupByDay(mission), [mission]);

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
  const maxDay = grouped.length
    ? Math.max(...grouped.map((g) => g.day))
    : 0;
  const dayOptions = Array.from(
    { length: Math.max(maxDay + 1, mission.durationDays ?? 1) },
    (_, i) => i + 1,
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStep.trim()) return;
    addStep(mission.id, newStep, targetDay);
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

      <div className="space-y-6">
        {grouped.map((group) => (
          <DaySection
            key={group.day}
            day={group.day}
            steps={group.steps}
            date={stepDate(mission, group.day - 1)}
            missionId={mission.id}
          />
        ))}
        {grouped.length === 0 && (
          <div className="text-center text-muted-foreground py-10">
            <p className="text-sm">No steps yet. Add the first one below.</p>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <select
          value={targetDay}
          onChange={(e) => setTargetDay(Number(e.target.value))}
          aria-label="Day"
          className="bg-card border border-border/60 rounded-[1.25rem] px-3 py-3.5 text-foreground font-semibold text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          {dayOptions.map((d) => (
            <option key={d} value={d}>
              Day {d}
            </option>
          ))}
        </select>
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

type DayGroup = { day: number; steps: MissionStep[] };

function groupByDay(mission: Mission | undefined): DayGroup[] {
  if (!mission) return [];
  const map = new Map<number, MissionStep[]>();
  mission.steps.forEach((s) => {
    const d = stepDay(mission, s);
    const arr = map.get(d) ?? [];
    arr.push(s);
    map.set(d, arr);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, steps]) => ({ day, steps }));
}

type DaySectionProps = {
  day: number;
  steps: MissionStep[];
  date: Date | null;
  missionId: string;
};

function DaySection({ day, steps, date, missionId }: DaySectionProps) {
  const dateLabel = date
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "long" })
    : null;
  const allDone = steps.length > 0 && steps.every((s) => s.completed);

  return (
    <section className="bg-card border border-border/60 rounded-[1.5rem] p-5 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
      <header className="flex items-baseline justify-between mb-4">
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-lg font-extrabold text-foreground tracking-tight">Day {day}</h3>
          {dateLabel && (
            <span className="text-xs font-semibold text-muted-foreground">{dateLabel}</span>
          )}
        </div>
        {allDone && (
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Done</span>
        )}
      </header>
      <ul className="space-y-2.5">
        {steps.map((s, i) => (
          <StepRow key={s.id} step={s} index={i} missionId={missionId} />
        ))}
      </ul>
    </section>
  );
}

type StepRowProps = {
  step: MissionStep;
  index: number;
  missionId: string;
};

function StepRow({ step, index, missionId }: StepRowProps) {
  const liClass =
    "group flex items-center gap-3 bg-secondary/40 border border-border/40 rounded-[1rem] p-3 animate-list-item-in transition-all duration-300 " +
    (step.completed ? "opacity-55" : "");
  const checkClass =
    "press size-6 rounded-full border-2 flex items-center justify-center shrink-0 " +
    (step.completed
      ? "bg-primary border-primary text-primary-foreground"
      : "border-border hover:border-primary hover:bg-primary/5");
  const titleClass =
    "flex-1 font-medium text-foreground text-[0.92rem] transition-colors duration-300 " +
    (step.completed ? "strike-anim text-muted-foreground" : "");

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
        className="press text-muted-foreground/40 hover:text-destructive p-1 rounded-full hover:bg-destructive/5"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

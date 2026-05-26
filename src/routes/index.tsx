import { createFileRoute, Link } from "@tanstack/react-router";
import { useTasks } from "@/lib/tasks-store";
import {
  useMissions,
  missionProgress,
  type Mission,
} from "@/lib/missions-store";
import {
  ClipboardList,
  Flame,
  ArrowRight,
  Sunrise,
  Target,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DailyOS — Your Life Operating System" },
      { name: "description", content: "A clean daily routine and life management dashboard." },
    ],
  }),
  component: Dashboard,
});

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function pickTodaysMission(missions: Mission[]): Mission | undefined {
  if (!missions.length) return undefined;
  const sorted = [...missions].sort((a, b) => a.priority - b.priority);
  const active = sorted.find((m) => {
    const { total, done } = missionProgress(m);
    return total === 0 || done < total;
  });
  return active ?? sorted[0];
}

function currentDayFor(m: Mission): number {
  const today = startOfDay(Date.now());
  const start = startOfDay(m.startDate);
  const diff = Math.floor((today - start) / 86400000) + 1;
  return Math.min(Math.max(diff, 1), Math.max(m.days || 1, 1));
}

function formatDayDate(startDate: number, day: number) {
  const d = new Date(startOfDay(startDate));
  d.setDate(d.getDate() + (day - 1));
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function Dashboard() {
  const tasks = useTasks();
  const missions = useMissions();
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const ratio = total ? done / total : 0;
  const next = tasks.find((t) => !t.completed);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const mission = pickTodaysMission(missions);
  const currentDay = mission ? currentDayFor(mission) : 0;

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-muted-foreground tracking-wide">{today}</p>


      {next && (
        <Link
          to="/routine"
          className="press block bg-card border border-border/60 rounded-[1.5rem] p-5 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_28px_-8px_rgba(15,23,42,0.1)]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary flex items-center gap-1.5">
              <Flame className="size-3.5" /> Up next
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-bold text-foreground text-[1.05rem]">{next.title}</h3>
            <span className="text-sm font-mono font-medium text-muted-foreground">{next.time}</span>
          </div>
          {next.note && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{next.note}</p>}
        </Link>
      )}

      {total === 0 && (
        <div className="bg-card border border-border/60 rounded-[1.5rem] p-8 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)] text-center">
          <ClipboardList className="size-10 text-primary/30 mx-auto mb-4" />
          <h3 className="font-bold text-foreground text-base">No tasks yet</h3>
          <p className="text-sm text-muted-foreground mt-1.5">Add your first routine to get started.</p>
        </div>
      )}

      {!next && total > 0 && (
        <div className="bg-card border border-border/60 rounded-[1.5rem] p-6 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)] text-center">
          <Sunrise className="size-8 text-primary/40 mx-auto mb-3" />
          <h3 className="font-bold text-foreground">All caught up</h3>
          <p className="text-sm text-muted-foreground mt-1">Every task is complete. Enjoy your day.</p>
        </div>
      )}

      <Link
        to="/routine"
        className="press flex items-center justify-center gap-2.5 w-full bg-primary text-primary-foreground rounded-[1.25rem] py-4 font-semibold shadow-[0_4px_20px_-4px_rgba(37,99,235,0.35)] hover:shadow-[0_6px_28px_-4px_rgba(37,99,235,0.45)]"
      >
        Open today's routine <ArrowRight className="size-4" />
      </Link>

      {/* Today's Mission (below Routine) */}
      <section className="bg-card border border-border/60 rounded-[1.5rem] p-5 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary flex items-center gap-1.5">
            <Target className="size-3.5" /> Today's Mission
          </span>
          <Link to="/missions" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            All
          </Link>
        </div>
        {mission ? (
          <Link to="/missions/$missionId" params={{ missionId: mission.id }} className="press block">
            <h3 className="font-bold text-foreground text-[1.05rem]">{mission.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Day {currentDay} — {formatDayDate(mission.startDate, currentDay)}
            </p>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">No active mission</p>
        )}
      </section>
    </div>
  );
}

function encouragement(ratio: number): string {
  if (ratio === 0) return "Let's get started";
  if (ratio === 1) return "All done. Great job!";
  if (ratio < 0.3) return "Let's get started";
  if (ratio < 0.5) return "Keep it up";
  if (ratio < 0.75) return "Good progress";
  if (ratio < 1) return "Almost there";
  return "All done. Great job!";
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-[1.25rem] p-5 border border-border/60 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)] bg-card">
      <div className={`inline-flex items-center justify-center size-8 rounded-full mb-3 ${color}`}>
        {icon}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[1.75rem] font-bold leading-none text-foreground">{value}</div>
    </div>
  );
}

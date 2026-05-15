import { createFileRoute, Link } from "@tanstack/react-router";
import { useTasks } from "@/lib/tasks-store";
import { ProgressRing } from "@/components/ProgressRing";
import { CheckCircle2, Circle, ClipboardList, Flame, ArrowRight, Sunrise } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DailyOS — Your Life Operating System" },
      { name: "description", content: "A clean daily routine and life management dashboard." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const tasks = useTasks();
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const ratio = total ? done / total : 0;
  const next = tasks.find((t) => !t.completed);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-muted-foreground tracking-wide">{today}</p>

      <section className="relative overflow-hidden bg-card border border-border/60 rounded-[1.75rem] p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)]">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/[0.04] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="flex items-center gap-6 relative">
          <ProgressRing value={ratio} size={112} stroke={10}>
            <div className="text-center">
              <div className="text-[1.75rem] font-bold text-foreground leading-none">
                {done}<span className="text-muted-foreground font-medium">/{total}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mt-1">done</div>
            </div>
          </ProgressRing>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground tracking-tight">Today's progress</h2>
            <p className="text-sm font-medium text-primary mt-1.5 leading-relaxed">
              {encouragement(ratio)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total" value={total} icon={<Circle className="size-4" />} color="bg-secondary text-secondary-foreground" />
        <StatCard label="Completed" value={done} icon={<CheckCircle2 className="size-4" />} color="bg-primary/10 text-primary" />
      </div>

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

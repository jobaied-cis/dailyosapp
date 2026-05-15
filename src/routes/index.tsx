import { createFileRoute, Link } from "@tanstack/react-router";
import { useTasks } from "@/lib/tasks-store";
import { ProgressRing } from "@/components/ProgressRing";
import { CheckCircle2, Circle, Flame, ArrowRight } from "lucide-react";

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
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{today}</p>

      <section className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-5">
          <ProgressRing value={ratio} size={120} stroke={11}>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {done}<span className="text-muted-foreground">/{total}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">done</div>
            </div>
          </ProgressRing>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Today's progress</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {total === 0
                ? "No tasks yet — add your first."
                : done === total
                  ? "All done. Beautiful day."
                  : `${total - done} ${total - done === 1 ? "task" : "tasks"} remaining`}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total" value={total} icon={<Circle className="size-4" />} />
        <StatCard label="Completed" value={done} icon={<CheckCircle2 className="size-4" />} accent />
      </div>

      {next && (
        <Link
          to="/routine"
          className="block bg-card border border-border rounded-2xl p-5 shadow-sm active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Flame className="size-3.5" /> Up next
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-foreground">{next.title}</h3>
            <span className="text-sm font-mono text-muted-foreground">{next.time}</span>
          </div>
          {next.note && <p className="text-sm text-muted-foreground mt-1">{next.note}</p>}
        </Link>
      )}

      <Link
        to="/routine"
        className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-2xl py-4 font-medium shadow-sm shadow-primary/20 active:scale-[0.99] transition-transform"
      >
        Open today's routine <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 border shadow-sm ${
        accent
          ? "bg-accent border-accent text-accent-foreground"
          : "bg-card border-border text-foreground"
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70">
        {icon} {label}
      </div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTasks } from "@/lib/tasks-store";
import { ProgressRing } from "@/components/ProgressRing";
import {
  useMissions,
  missionProgress,
  type Mission,
} from "@/lib/missions-store";
import { useEvents } from "@/lib/events-store";
import {
  ClipboardList,
  Flame,
  ArrowRight,
  Sunrise,
  Target,
  Wallet,
  TrendingDown,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";
import { useExpenses, getDailyLimit } from "@/lib/expenses-store";

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
  const events = useEvents();
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pct = total ? (done / total) * 100 : 0;
  const next = tasks.find((t) => !t.completed);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const nowLocal = new Date();
  const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
  const todaysEvents = events
    .filter((e) => e.date === todayStr)
    .sort((a, b) => a.time.localeCompare(b.time));
  const showEvents = todaysEvents.slice(0, 3);

  const eventCount = todaysEvents.length;
  const hasHighPriorityToday = todaysEvents.some((e) => e.priority === "High");


  const mission = pickTodaysMission(missions);
  const currentDay = mission ? currentDayFor(mission) : 0;

  const expenses = useExpenses();
  const todayStart = startOfDay(Date.now());
  const todayEnd = todayStart + 86400000;
  const monthStartDate = new Date();
  monthStartDate.setDate(1);
  monthStartDate.setHours(0, 0, 0, 0);
  const monthStart = monthStartDate.getTime();
  const nextMonthDate = new Date(monthStartDate);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const monthEnd = nextMonthDate.getTime();

  const totalIncome = expenses
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);
  const totalExpenseAll = expenses
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpenseAll;

  const todayExpense = expenses
    .filter((e) => e.type === "expense" && e.createdAt >= todayStart && e.createdAt < todayEnd)
    .reduce((s, e) => s + e.amount, 0);

  const monthExpense = expenses
    .filter((e) => e.type === "expense" && e.createdAt >= monthStart && e.createdAt < monthEnd)
    .reduce((s, e) => s + e.amount, 0);

  const dailyLimit = getDailyLimit();
  const limitExceeded = dailyLimit > 0 && todayExpense > dailyLimit;

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-muted-foreground tracking-wide">{today}</p>

      <section className="bg-card border border-border/60 rounded-[1.75rem] p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)] flex flex-col items-center">
        <h2 className="font-bold text-foreground text-lg tracking-tight mb-4">Today's Routine Progress</h2>
        <ProgressRing value={total ? done / total : 0}>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{Math.round(pct)}%</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">{done}/{total}</div>
          </div>
        </ProgressRing>
      </section>




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


      <section className="bg-card border border-border/60 rounded-[1.5rem] p-5 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> TODAY'S EVENTS ({eventCount})
          </span>
          <Link to="/events" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            All
          </Link>
        </div>
        {showEvents.length > 0 ? (
          <div className="space-y-3">
            {showEvents.map((evt) => {
              const [h, m] = evt.time.split(":");
              const hour = parseInt(h, 10);
              const ampm = hour >= 12 ? "PM" : "AM";
              const displayHour = hour % 12 || 12;
              const timeStr = `${displayHour}:${m} ${ampm}`;
              return (
                <div key={evt.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-mono font-medium text-muted-foreground shrink-0">
                      {timeStr}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate">
                      {evt.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold bg-secondary text-muted-foreground border-border/60">
                      {evt.type}
                    </span>
                    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                      evt.priority === "High"
                        ? "bg-destructive/15 text-destructive border-destructive/20"
                        : evt.priority === "Medium"
                        ? "bg-amber-500/15 text-amber-600 border-amber-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {evt.priority}
                    </span>
                  </div>
                </div>
              );
            })}
            {todaysEvents.length > 3 && (
              <Link
                to="/events"
                className="press block text-center text-xs font-semibold text-primary mt-2"
              >
                View All
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No events today</p>
        )}
      </section>

      {/* Expense Summary */}
      <section className="bg-card border border-border/60 rounded-[1.5rem] p-5 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary flex items-center gap-1.5">
            <Wallet className="size-3.5" /> Expense Summary
          </span>
          <Link to="/expenses" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Details
          </Link>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Wallet className="size-3.5 text-primary/70" /> Balance
            </span>
            <span className="text-sm font-bold text-foreground">{balance.toLocaleString()}৳</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="size-3.5 text-primary/70" /> Today
            </span>
            <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
              {todayExpense.toLocaleString()}৳
              {dailyLimit > 0 && (
                <span className="text-xs font-medium text-muted-foreground">/ {dailyLimit.toLocaleString()}৳</span>
              )}
              {limitExceeded && <AlertTriangle className="size-3.5 text-red-500" />}
            </span>
          </div>
          {limitExceeded && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
              <AlertTriangle className="size-3.5" /> Over limit
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-primary/70" /> Month
            </span>
            <span className="text-sm font-bold text-foreground">{monthExpense.toLocaleString()}৳</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Target className="size-3.5 text-primary/70" /> Daily Target
            </span>
            <span className="text-sm font-bold text-foreground">
              {dailyLimit > 0 ? `${dailyLimit.toLocaleString()}৳` : "Not set"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="size-3.5 text-primary/70" /> Spent Today
            </span>
            <span className="text-sm font-bold text-foreground">{todayExpense.toLocaleString()}৳</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Wallet className="size-3.5 text-primary/70" /> Remaining
            </span>
            <span className={`text-sm font-bold ${dailyLimit > 0 && dailyLimit - todayExpense < 0 ? "text-destructive" : "text-foreground"}`}>
              {dailyLimit > 0 ? `${(dailyLimit - todayExpense).toLocaleString()}৳` : "—"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  GraduationCap,
  Briefcase,
  BookOpen,
  MapPin,
  User,
} from "lucide-react";
import { useExpenses, getDailyLimit } from "@/lib/expenses-store";
import { useStreak } from "@/lib/streak-store";
import { useTakaSymbol, formatTaka } from "@/lib/currency";

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning, Akash👋";
  if (hour < 18) return "Good afternoon, Akash👋";
  return "Good evening, Akash👋";
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

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowLocal = new Date();
  const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
  const todaysEvents = events
    .filter((e) => e.date === todayStr)
    .sort((a, b) => a.time.localeCompare(b.time));
  const showEvents = todaysEvents.slice(0, 3);

  const eventCount = todaysEvents.length;
  const nextUpcoming = todaysEvents.find((e) => {
    if (e.completed) return false;
    return new Date(`${e.date}T${e.time}`).getTime() > nowTick;
  });


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

  const allDone = total > 0 && done === total;
  const endOfDayMissed = !allDone && new Date().getHours() >= 23;
  const streak = useStreak(allDone, endOfDayMissed);
  const taka = useTakaSymbol();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[1.35rem] font-bold text-foreground tracking-tight">{getGreeting()}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Today: {done} tasks · {eventCount} events · {formatTaka(todayExpense, taka)} spent
          </p>
          <p className="text-sm font-medium text-muted-foreground tracking-wide mt-1">{today}</p>
        </div>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 px-2.5 py-1 text-[11px] font-bold border border-amber-500/20 shrink-0">
            <Flame className="size-3.5" /> {streak} day streak
          </span>
        )}
      </div>

      <section className="bg-card border border-border/60 rounded-[1.75rem] p-5 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-foreground text-base tracking-tight">Today's Routine</h2>
          <span className="text-xs font-mono font-semibold text-muted-foreground">
            {Math.round(pct)}% · {done}/{total} tasks
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="shrink-0">
            <ProgressRing value={total ? done / total : 0} size={88} stroke={8}>
              <div className="text-center">
                <div className="text-base font-bold text-foreground leading-none">{Math.round(pct)}%</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{done}/{total}</div>
              </div>
            </ProgressRing>
          </div>
          <ul className="flex-1 min-w-0 space-y-1.5">
            {total === 0 && (
              <li className="text-sm text-muted-foreground">No routine today 😌</li>
            )}
            {tasks.slice(0, 4).map((t) => {
              const isCurrent = next && t.id === next.id;
              return (
                <li key={t.id} className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-muted-foreground w-10 shrink-0">{t.time}</span>
                  <span
                    className={`text-sm truncate flex-1 ${
                      t.completed
                        ? "line-through text-muted-foreground/70"
                        : isCurrent
                        ? "font-semibold text-foreground"
                        : "text-foreground/80"
                    }`}
                  >
                    {t.title}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                      Now
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

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
            {(() => {
              const { total, done, pct } = missionProgress(mission);
              const daysLeft = Math.max(0, mission.days - currentDay);
              const motivation =
                pct === 100 ? "Completed 🎉" :
                pct >= 70 ? "Almost done 🔥" :
                pct >= 30 ? "Keep going 💪" :
                "Let's begin 🚀";
              return (
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{pct}% complete</span>
                    <span className="text-xs text-muted-foreground">{daysLeft} days left</span>
                  </div>
                  <p className="text-xs font-semibold text-primary">{motivation}</p>
                </div>
              );
            })()}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">No active mission 🎯</p>
        )}
      </section>


      <Link
        to="/events"
        className="block bg-card border border-border/60 rounded-[1.5rem] p-5 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)] cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> TODAY'S EVENTS ({eventCount})
          </span>
          <span className="text-xs font-semibold text-muted-foreground">All</span>
        </div>
        {showEvents.length > 0 ? (
          <div className="space-y-3">
            {showEvents.map((evt) => {
              const [h, m] = evt.time.split(":");
              const hour = parseInt(h, 10);
              const ampm = hour >= 12 ? "PM" : "AM";
              const displayHour = hour % 12 || 12;
              const timeStr = `${displayHour}:${m} ${ampm}`;
              const eventTs = new Date(`${evt.date}T${evt.time}`).getTime();
              const diffMs = eventTs - nowTick;
              let countdown = "";
              if (!evt.completed) {
                if (diffMs <= 0) {
                  countdown = "Now / Past";
                } else {
                  const totalMin = Math.floor(diffMs / 60000);
                  const hrs = Math.floor(totalMin / 60);
                  const mins = totalMin % 60;
                  countdown = hrs > 0 ? `Starts in ${hrs}h ${mins}m` : `Starts in ${mins}m`;
                }
              }
              const isNext = nextUpcoming?.id === evt.id;
              return (
                <div
                  key={evt.id}
                  className={`rounded-xl px-2.5 py-2 -mx-1 transition-colors ${
                    isNext
                      ? "border border-primary/40 bg-primary/5 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
                      : "border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {evt.type === "Exam" && <GraduationCap className="size-4 text-primary/70 shrink-0" />}
                      {evt.type === "Meeting" && <Briefcase className="size-4 text-primary/70 shrink-0" />}
                      {evt.type === "Class" && <BookOpen className="size-4 text-primary/70 shrink-0" />}
                      {evt.type === "Personal" && <User className="size-4 text-primary/70 shrink-0" />}
                      {evt.type === "Other" && <MapPin className="size-4 text-primary/70 shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {evt.title}
                          </span>
                          {isNext && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary bg-primary/20 border border-primary/30 px-2 py-0.5 rounded-full shrink-0 shadow-sm">
                              NEXT
                            </span>
                          )}
                        </div>
                        {countdown && (
                          <span className={`text-xs font-medium ${isNext ? "text-primary" : "text-muted-foreground"}`}>
                            {countdown}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold bg-secondary text-muted-foreground border-border/60">
                        {evt.type}
                      </span>
                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                        evt.priority === "High"
                          ? "bg-red-500/15 text-red-600 border-red-500/30"
                          : evt.priority === "Medium"
                          ? "bg-amber-500/20 text-amber-700 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                      }`}>
                        {evt.priority}
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}
            {todaysEvents.length > 3 && (
              <span className="block text-center text-xs font-semibold text-primary mt-2">
                +{todaysEvents.length - 3} more
              </span>
            )}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm font-semibold text-foreground">No events today 🎉</p>
            <p className="text-xs text-muted-foreground mt-1">Relax or plan ahead</p>
          </div>
        )}
      </Link>

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
        {expenses.length === 0 && (
          <p className="text-sm text-muted-foreground mb-3">No expense yet 💸</p>
        )}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Wallet className="size-3.5 text-primary/70" /> Balance
            </span>
            <span className="text-sm font-bold text-foreground">{formatTaka(balance, taka)}</span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <TrendingDown className="size-3.5 text-primary/70" /> Today
              </span>
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                {dailyLimit > 0 ? (
                  <span>{todayExpense.toLocaleString()} / {formatTaka(dailyLimit, taka)}</span>
                ) : (
                  <span>{formatTaka(todayExpense, taka)}</span>
                )}
                {limitExceeded && <AlertTriangle className="size-3.5 text-red-500" />}
              </span>
            </div>
            {dailyLimit > 0 && (
              <div className="space-y-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${limitExceeded ? "bg-red-500" : "bg-primary"}`}
                    style={{ width: `${Math.min((todayExpense / dailyLimit) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold ${limitExceeded ? "text-red-500" : "text-muted-foreground"}`}>
                    {Math.round((todayExpense / dailyLimit) * 100)}%
                  </span>
                  {limitExceeded && (
                    <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                      <AlertTriangle className="size-3" /> Over limit
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-primary/70" /> This Month
            </span>
            <span className="text-sm font-bold text-foreground">{formatTaka(monthExpense, taka)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Target className="size-3.5 text-primary/70" /> Remaining
            </span>
            <span className={`text-sm font-bold ${dailyLimit > 0 && dailyLimit - todayExpense < 0 ? "text-destructive" : "text-foreground"}`}>
              {dailyLimit > 0 ? formatTaka(dailyLimit - todayExpense, taka) : "—"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

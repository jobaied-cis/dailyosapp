import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTasks } from "@/lib/tasks-store";
import { ProgressRing } from "@/components/ProgressRing";
import {
  useMissions,
  missionProgress,
  isMissionEnded,
  type Mission,
} from "@/lib/missions-store";
import { useEvents } from "@/lib/events-store";
import {
  Flame,
  ArrowRight,
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
  Check,
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
    if (isMissionEnded(m)) return false;
    const { total, done } = missionProgress(m);
    return total === 0 || done < total;
  });
  return active;
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

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning, Akash👋";
  if (hour < 18) return "Good afternoon, Akash👋";
  return "Good evening, Akash👋";
}

const CARD = "rounded-2xl p-4 border border-border/60 bg-card shadow-sm";
const PRESS = "press will-change-transform";

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
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    setHour(new Date().getHours());
    const id = setInterval(() => {
      setNowTick(Date.now());
      setHour(new Date().getHours());
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const greeting = hour === null ? "Hello, Akash 👋" : getGreeting(hour);

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
  const reached80 = total > 0 && done / total >= 0.8;
  const { streak } = useStreak(reached80, endOfDayMissed);
  const taka = useTakaSymbol();

  return (
    <div className="space-y-4 stagger-sections">
      {/* Greeting */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card/80 p-4 shadow-lg ring-1 ring-inset ring-white/5">
        <div className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold text-foreground tracking-tight leading-[1.2]">
              {greeting}
            </h1>
            <p className="text-[13px] font-medium text-muted-foreground leading-[1.4] mt-1">
              {done} tasks · {eventCount} events · {formatTaka(todayExpense, taka)} spent
            </p>
            <p className="text-[11px] font-medium text-muted-foreground tracking-[0.5px] leading-[1.3] mt-1">{today}</p>
          </div>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 px-2.5 py-1 text-[11px] font-semibold border border-amber-500/20 shrink-0 leading-none">
              <Flame className="size-3.5" /> {streak}
            </span>
          )}
        </div>
      </div>

      {/* Today's Routine */}
      <Link to="/routine" className={`block ${CARD} shadow-md ${PRESS}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] leading-[1.3] text-muted-foreground flex items-center gap-1.5">
            Today's Routine
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 normal-case tracking-normal">
                · {streak}-day streak 🔥
              </span>
            )}
          </span>
          <span className="text-xs font-mono font-semibold text-muted-foreground leading-[1.3]">
            {Math.round(pct)}% · {done}/{total}
          </span>
        </div>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No routine today 😌</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <ProgressRing value={total ? done / total : 0} size={72} stroke={7}>
                <div className="text-center">
                  <div className="text-[16px] font-semibold text-foreground leading-[1.3]">{Math.round(pct)}%</div>
                </div>
              </ProgressRing>
            </div>
            <ul className="flex-1 min-w-0 space-y-1.5">
              {tasks.slice(0, 4).map((t) => {
                const isCurrent = next && t.id === next.id;
                return (
                  <li key={t.id} className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground w-10 shrink-0">{t.time}</span>
                    {t.completed ? (
                      <Check className="size-3 text-primary/60 shrink-0" />
                    ) : null}
                    <span
                      className={`text-[14px] truncate flex-1 leading-[1.5] ${
                        t.completed
                          ? "font-normal line-through text-[#9CA3AF]"
                          : isCurrent
                          ? "font-semibold text-[#1F2D50] dark:text-foreground"
                          : "font-medium text-[#6B7280] dark:text-foreground/75"
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
        )}
      </Link>

      <Link
        to="/routine"
        className="press flex items-center justify-center gap-2.5 w-full bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-xl py-3.5 text-[14px] font-semibold leading-[1.2] shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 active:scale-[0.97] transition-all duration-150"
      >
        Open today's routine <ArrowRight className="size-4" />
      </Link>

      {/* Today's Mission */}
      <section className={`${CARD} ${PRESS}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] leading-[1.3] text-muted-foreground flex items-center gap-1.5">
            <Target className="size-3.5" /> Today's Mission
          </span>
          <Link to="/missions" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            All
          </Link>
        </div>
        {mission ? (
          <Link to="/missions/$missionId" params={{ missionId: mission.id }} className="block">
            <h3 className="text-[16px] font-semibold text-foreground leading-[1.3]">{mission.title}</h3>
            <p className="text-[12px] font-medium text-muted-foreground leading-[1.4] mt-1">
              Day {currentDay} — {formatDayDate(mission.startDate, currentDay)}
            </p>
            {(() => {
              const { pct } = missionProgress(mission);
              const clamped = Math.min(100, Math.max(0, pct));
              const daysLeft = Math.max(0, mission.days - currentDay);
              return (
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${clamped}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-semibold text-foreground leading-[1.3]">{clamped}%</span>
                    <span className="text-[12px] font-medium text-muted-foreground leading-[1.4]">{daysLeft} days left</span>
                  </div>
                </div>
              );
            })()}
          </Link>
        ) : missions.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-foreground">Completed ✓</p>
            <p className="text-xs text-muted-foreground mt-1">
              All your missions are complete. Time for the next one.
            </p>
            <Link
              to="/missions"
              className="press mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
            >
              Start new mission <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active mission 🎯</p>
        )}
      </section>

      {/* Today's Events */}
      <Link to="/events" className={`block ${CARD} ${PRESS}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] leading-[1.3] text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> Today's Events
          </span>
          <span className="text-xs font-semibold text-muted-foreground">All</span>
        </div>
        {showEvents.length > 0 ? (
          <div className="space-y-2.5">
            {showEvents.map((evt) => {
              const [h, m] = evt.time.split(":");
              const hourNum = parseInt(h, 10);
              const ampm = hourNum >= 12 ? "PM" : "AM";
              const displayHour = hourNum % 12 || 12;
              const eventTs = new Date(`${evt.date}T${evt.time}`).getTime();
              const diffMs = eventTs - nowTick;
              let countdown = "";
              if (!evt.completed) {
                if (diffMs <= 0) {
                  countdown = "Now / Past";
                } else if (diffMs < 60_000) {
                  countdown = "Starts in <1m";
                } else {
                  const totalMin = Math.floor(diffMs / 60000);
                  const hrs = Math.floor(totalMin / 60);
                  const mins = totalMin % 60;
                  countdown = hrs > 0 ? `Starts in ${hrs}h ${mins}m` : `Starts in ${mins}m`;
                }
              }
              const isNext = nextUpcoming?.id === evt.id;
              const timeStr = `${displayHour}:${m} ${ampm}`;
              return (
                <div
                  key={evt.id}
                  className={`rounded-xl px-2.5 py-2 -mx-1 ${
                    isNext
                      ? "border border-primary/40 bg-primary/5"
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
                          <span className="text-[14px] font-semibold text-foreground leading-[1.5] truncate">
                            {evt.title}
                          </span>
                          {isNext && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/15 border border-primary/30 px-1.5 py-0.5 rounded-full shrink-0 leading-none">
                              Now
                            </span>
                          )}
                        </div>
                        <span className={`text-[12px] font-medium leading-[1.4] ${isNext ? "text-primary" : "text-muted-foreground"}`}>
                          {timeStr}{countdown ? ` · ${countdown}` : ""}
                        </span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${
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
              );
            })}
            {todaysEvents.length > 3 && (
              <span className="block text-center text-xs font-semibold text-primary mt-1">
                +{todaysEvents.length - 3} more
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-1">You're all clear today ✨</p>
        )}
      </Link>

      {/* Expense Summary */}
      <section className={CARD}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] leading-[1.3] text-muted-foreground flex items-center gap-1.5">
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
            <span className="text-[12px] font-medium text-muted-foreground leading-[1.4] flex items-center gap-1.5">
              <Wallet className="size-3.5 text-primary/70" /> Balance
            </span>
            <span className={`text-[16px] font-semibold leading-[1.3] ${balance < 0 ? "text-destructive" : "text-foreground"}`}>
              {formatTaka(balance, taka)}
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-muted-foreground leading-[1.4] flex items-center gap-1.5">
                <TrendingDown className="size-3.5 text-primary/70" /> Today
                {dailyLimit > 0 && (
                  <span aria-label="status" className="text-[12px] leading-none">
                    {(todayExpense / dailyLimit) * 100 > 100
                      ? "🔴"
                      : (todayExpense / dailyLimit) * 100 >= 80
                        ? "🟡"
                        : "🟢"}
                  </span>
                )}
              </span>
              <span className="text-[16px] font-semibold text-foreground leading-[1.3] flex items-center gap-1.5">
                {dailyLimit > 0 ? (
                  <span>{todayExpense.toLocaleString()} / {formatTaka(dailyLimit, taka)}</span>
                ) : (
                  <span>{formatTaka(todayExpense, taka)}</span>
                )}
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
                  <span className={`text-[11px] font-semibold leading-[1.3] ${limitExceeded ? "text-red-500" : "text-muted-foreground"}`}>
                    {Math.round((todayExpense / dailyLimit) * 100)}%
                  </span>
                  {limitExceeded && (
                    <span className="text-[11px] font-semibold text-red-500 leading-[1.3] flex items-center gap-1">
                      <AlertTriangle className="size-3" /> Over limit
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted-foreground leading-[1.4] flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-primary/70" /> This Month
            </span>
            <span className="text-[16px] font-semibold text-foreground leading-[1.3]">{formatTaka(monthExpense, taka)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted-foreground leading-[1.4] flex items-center gap-1.5">
              <Target className="size-3.5 text-primary/70" /> Remaining
            </span>
            <span className={`text-[16px] font-semibold leading-[1.3] ${dailyLimit > 0 && dailyLimit - todayExpense < 0 ? "text-destructive" : "text-foreground"}`}>
              {dailyLimit > 0 ? formatTaka(dailyLimit - todayExpense, taka) : "—"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

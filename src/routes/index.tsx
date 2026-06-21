import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Plus,
  ListChecks,
  CalendarPlus,
  Sparkles,
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
  if (hour < 12) return "Good morning, Akash 👋";
  if (hour < 18) return "Good afternoon, Akash 👋";
  return "Good evening, Akash 👋";
}

function formatTime12(hhmm: string) {
  const [h, m] = hhmm.split(":");
  const hourNum = parseInt(h, 10);
  const ampm = hourNum >= 12 ? "PM" : "AM";
  const displayHour = hourNum % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function hhmmToMin(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

const CARD = "rounded-2xl p-4 border border-border/60 bg-card shadow-sm";
const PRESS = "press will-change-transform";

function Dashboard() {
  const navigate = useNavigate();
  const tasks = useTasks();
  const missions = useMissions();
  const events = useEvents();
  const takaSym = useTakaSymbol();
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pct = total ? (done / total) * 100 : 0;
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

  const nowLocal = new Date(nowTick);
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

  // ===== Derived intelligence =====
  const nowMin = minutesSinceMidnight(nowLocal);
  const incompleteTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const routineRemaining = incompleteTasks.length;
  const nextTask = incompleteTasks[0];
  const currentTask = useMemo(() => {
    const inWindow = incompleteTasks.find((t) => {
      const start = hhmmToMin(t.time);
      const end = t.endTime ? hhmmToMin(t.endTime) : start + 30;
      return nowMin >= start && nowMin < end;
    });
    return inWindow ?? nextTask;
  }, [incompleteTasks, nextTask, nowMin]);

  const nextEvent = nextUpcoming;
  const minsToEvent = nextEvent
    ? Math.max(
        0,
        Math.round((new Date(`${nextEvent.date}T${nextEvent.time}`).getTime() - nowTick) / 60000),
      )
    : Infinity;

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
  const limitPct = dailyLimit > 0 ? todayExpense / dailyLimit : 0;
  const overLimit = dailyLimit > 0 && todayExpense > dailyLimit;
  const nearLimit = dailyLimit > 0 && limitPct >= 0.8 && limitPct <= 1;
  const safeToSpend = dailyLimit > 0 ? Math.max(0, dailyLimit - todayExpense) : 0;

  // Status chip
  const status: "red" | "yellow" | "green" =
    overLimit || minsToEvent <= 15
      ? "red"
      : routineRemaining >= 3 || eventCount >= 3 || nearLimit
        ? "yellow"
        : "green";
  const statusEmoji = status === "red" ? "🔴" : status === "yellow" ? "🟡" : "🟢";
  const statusLabel = status === "red" ? "Heads up" : status === "yellow" ? "Busy" : "On track";

  // Intel line
  let intel = "You're on track today — keep going 🚀";
  if (overLimit) intel = "Spending is high today — stay mindful ⚠️";
  else if (nextEvent && minsToEvent <= 30) intel = `Next event in ${minsToEvent}m — be ready ⏳`;
  else if (routineRemaining > 0) intel = `You have ${routineRemaining} task${routineRemaining > 1 ? "s" : ""} left — stay focused 💪`;

  // Priority card — strict order: overLimit → nextEvent(≤15) → currentTask → nextTask
  type Priority = { label: string; main: string; sub?: string; to: "/routine" | "/events" | "/expenses" } | null;
  let priority: Priority = null;
  const inCurrentWindow = currentTask && (() => {
    const start = hhmmToMin(currentTask.time);
    const end = currentTask.endTime ? hhmmToMin(currentTask.endTime) : start + 30;
    return nowMin >= start && nowMin < end;
  })();
  if (overLimit) {
    priority = {
      label: "PRIORITY",
      main: "You're over budget today ⚠️",
      sub: `Spent ${formatTaka(todayExpense, takaSym)} of ${formatTaka(dailyLimit, takaSym)}`,
      to: "/expenses",
    };
  } else if (nextEvent && minsToEvent <= 15) {
    priority = {
      label: "NOW",
      main: `${nextEvent.title} (in ${minsToEvent}m)`,
      sub: `Starts in ${minsToEvent}m`,
      to: "/events",
    };
  } else if (inCurrentWindow && currentTask) {
    priority = {
      label: "NOW",
      main: currentTask.title,
      sub: `${formatTime12(currentTask.time)}${currentTask.endTime ? ` – ${formatTime12(currentTask.endTime)}` : ""}`,
      to: "/routine",
    };
  } else if (nextTask) {
    priority = {
      label: "NEXT",
      main: nextTask.title,
      sub: `at ${formatTime12(nextTask.time)}`,
      to: "/routine",
    };
  }

  const allDone = total > 0 && done === total;
  const endOfDayMissed = !allDone && new Date().getHours() >= 23;
  const reached80 = total > 0 && done / total >= 0.8;
  const { streak } = useStreak(reached80, endOfDayMissed);

  const routineCtaLabel = done > 0 && !allDone ? "Continue routine" : "Open today's routine";

  return (
    <div className="space-y-4 stagger-sections">
      {/* Greeting / Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-[length:200%_200%] animate-[gradient-shift_8s_ease_infinite] p-4 shadow-lg ring-1 ring-inset ring-white/10 text-white">
        <div className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-white/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold text-white tracking-tight leading-[1.2]">
              {greeting}
            </h1>
            <p className="text-[13px] font-medium text-white/90 leading-[1.4] mt-1.5">
              {intel}
            </p>
            <p className="text-[12px] font-medium text-white/75 leading-[1.4] mt-1">
              {done} done · {eventCount} events · {formatTaka(todayExpense, takaSym)} spent
            </p>
            <p className="text-[11px] font-medium text-white/70 tracking-[0.5px] leading-[1.3] mt-1">{today}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 text-white px-2.5 py-1 text-[11px] font-semibold border border-white/20 leading-none">
                <Flame className="size-3.5" /> {streak}
              </span>
            )}
            <span
              aria-label={`Status: ${statusLabel}`}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider border leading-none ${
                status === "red"
                  ? "bg-amber-100 text-amber-700 border-amber-200"
                  : status === "yellow"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-emerald-100 text-emerald-700 border-emerald-200"
              }`}
            >
              <span className="text-[11px] leading-none">{statusEmoji}</span>
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Row */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => navigate({ to: "/routine" })}
          className="press flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card py-3 text-[13px] font-semibold text-foreground shadow-sm active:scale-95 transition-all duration-200"
        >
          <ListChecks className="size-4 text-primary" /> Task
        </button>
        <button
          onClick={() => navigate({ to: "/events" })}
          className="press flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card py-3 text-[13px] font-semibold text-foreground shadow-sm active:scale-95 transition-all duration-200"
        >
          <CalendarPlus className="size-4 text-primary" /> Event
        </button>
        <button
          onClick={() => navigate({ to: "/expenses" })}
          className="press flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card py-3 text-[13px] font-semibold text-foreground shadow-sm active:scale-95 transition-all duration-200"
        >
          <Plus className="size-4 text-primary" /> Expense
        </button>
      </div>

      {/* Priority Card */}
      {priority && (
        <button
          onClick={() => navigate({ to: priority!.to })}
          className="press animate-fade-in w-full text-left rounded-2xl p-4 border border-primary/30 bg-primary/10 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.45)] transition-all duration-200"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="size-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-primary leading-none">
                  {priority.label}
                </span>
              </div>
              <h3 className="text-[16px] font-semibold text-foreground leading-[1.3] truncate">
                {priority.main}
              </h3>
              {priority.sub && (
                <p className="text-[12px] font-medium text-muted-foreground leading-[1.4] mt-0.5 truncate">
                  {priority.sub}
                </p>
              )}
            </div>
            <ArrowRight className="size-4 text-primary shrink-0" />
          </div>
        </button>
      )}

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
            <div className="flex-1 min-w-0 space-y-1.5">
              {currentTask && (
                <div className="text-[12px] leading-[1.4]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-primary mr-1.5">NOW</span>
                  <span className="font-semibold text-foreground truncate">{currentTask.title}</span>
                </div>
              )}
              {nextTask && nextTask.id !== currentTask?.id && (
                <div className="text-[12px] leading-[1.4]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mr-1.5">NEXT</span>
                  <span className="font-medium text-foreground/80 truncate">
                    {nextTask.title} · {formatTime12(nextTask.time)}
                  </span>
                </div>
              )}
              {!currentTask && !nextTask && (
                <p className="text-[13px] font-medium text-emerald-600">All done — great work 👏</p>
              )}
            </div>
          </div>
        )}
      </Link>

      <Link
        to="/routine"
        className="press flex items-center justify-center gap-2.5 w-full bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-xl py-3.5 text-[14px] font-semibold leading-[1.2] shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 active:scale-[0.97] transition-all duration-150"
      >
        {routineCtaLabel} <ArrowRight className="size-4" />
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
                  <p className="text-[12px] font-semibold text-primary leading-[1.4] mt-1">
                    You're on Day {currentDay} — keep going 🔥
                  </p>
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
              {formatTaka(balance, takaSym)}
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-muted-foreground leading-[1.4] flex items-center gap-1.5">
                <TrendingDown className="size-3.5 text-primary/70" /> Today
                {dailyLimit > 0 && (
                  <span aria-label="status" className="text-[12px] leading-none">
                    {limitPct * 100 > 100 ? "🔴" : limitPct * 100 >= 80 ? "🟡" : "🟢"}
                  </span>
                )}
              </span>
              <span className="text-[16px] font-semibold text-foreground leading-[1.3] flex items-center gap-1.5">
                {dailyLimit > 0 ? (
                  <span>{todayExpense.toLocaleString()} / {formatTaka(dailyLimit, takaSym)}</span>
                ) : (
                  <span>{formatTaka(todayExpense, takaSym)}</span>
                )}
              </span>
            </div>
            {dailyLimit > 0 && (
              <div className="space-y-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${overLimit ? "bg-red-500" : "bg-primary"}`}
                    style={{ width: `${Math.min(limitPct * 100, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold leading-[1.3] ${overLimit ? "text-red-500" : "text-muted-foreground"}`}>
                    {Math.round(limitPct * 100)}%
                  </span>
                  {overLimit ? (
                    <span className="text-[11px] font-semibold text-red-500 leading-[1.3] flex items-center gap-1">
                      <AlertTriangle className="size-3" /> You're over today — adjust tomorrow 💡
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-600 leading-[1.3]">
                      Safe to spend: {formatTaka(safeToSpend, takaSym)}
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
            <span className="text-[16px] font-semibold text-foreground leading-[1.3]">{formatTaka(monthExpense, takaSym)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted-foreground leading-[1.4] flex items-center gap-1.5">
              <Target className="size-3.5 text-primary/70" /> Remaining
            </span>
            <span className={`text-[16px] font-semibold leading-[1.3] ${dailyLimit > 0 && dailyLimit - todayExpense < 0 ? "text-destructive" : "text-foreground"}`}>
              {dailyLimit > 0 ? formatTaka(dailyLimit - todayExpense, takaSym) : "—"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

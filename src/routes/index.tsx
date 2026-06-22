import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTasks, useAllRawTasks } from "@/lib/tasks-store";
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
  Settings as SettingsIcon,
} from "lucide-react";
import { useExpenses, getDailyLimit } from "@/lib/expenses-store";
import { useStreak } from "@/lib/streak-store";
import { useTakaSymbol, formatTaka } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";
import { X } from "lucide-react";
import { getDailyInsights, suggestionIcon } from "@/lib/ai-helper";
import { getBehaviorInsights, behaviorIcon } from "@/lib/behavior-ai";
import { getMemoryInsights, memoryIcon } from "@/lib/memory-ai";
import { getWeeklyReport } from "@/lib/weekly-report";
import { readMemory } from "@/lib/memory-store";
import { renderWeeklyShareCard, downloadBlob } from "@/lib/share-card";
import { AIAssistantSheet } from "@/components/AIAssistantSheet";
import { Bot, BarChart3, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

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

function getGreeting(hour: number, name: string): string {
  if (hour < 12) return `Good morning, ${name} 👋`;
  if (hour < 18) return `Good afternoon, ${name} 👋`;
  return `Good evening, ${name} 👋`;
}

function formatTime12(hhmm: string) {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return "";
  const [h, m] = hhmm.split(":");
  const hourNum = parseInt(h, 10);
  if (!Number.isFinite(hourNum)) return "";
  const ampm = hourNum >= 12 ? "PM" : "AM";
  const displayHour = hourNum % 12 || 12;
  return `${displayHour}:${m ?? "00"} ${ampm}`;
}

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function hhmmToMin(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

const CARD = "rounded-2xl p-4 border border-border/60 bg-card shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]";
const PRESS = "press will-change-transform";

function Dashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
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
  const displayName = userProfile?.name?.trim() || "there";
  const greeting = hour === null ? `Hello, ${displayName} 👋` : getGreeting(hour, displayName);

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

  const todayExpenseEntries = expenses.filter(
    (e) => e.type === "expense" && e.createdAt >= todayStart && e.createdAt < todayEnd,
  );
  const todayExpense = todayExpenseEntries.reduce((s, e) => s + e.amount, 0);
  const hasExpenseToday = todayExpenseEntries.length > 0;

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

  // Intel line is computed below after userProfile is read.


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
      label: "✨ Up next",
      main: nextTask.title,
      sub: `at ${formatTime12(nextTask.time)}`,
      to: "/routine",
    };
  }

  // Track if Priority card is already surfacing the current/next routine task
  // so the Routine card can avoid repeating the same line.
  const priorityShowsRoutineTask =
    priority?.to === "/routine" &&
    ((inCurrentWindow && !!currentTask) || (!inCurrentWindow && !!nextTask));

  const allDone = total > 0 && done === total;
  const endOfDayMissed = !allDone && new Date().getHours() >= 23;
  const reached80 = total > 0 && done / total >= 0.8;
  const { streak } = useStreak(reached80, endOfDayMissed);

  const routineCtaLabel = done > 0 && !allDone ? "Continue routine" : "Open today's routine";

  // ---- Personalization (from onboarding priorities) ----
  const priorities = userProfile?.priorities ?? [];
  const focusMission = priorities.includes("study");
  const focusRoutine = priorities.includes("productivity") || priorities.includes("fitness");
  const focusExpense = priorities.includes("finance");

  // ---- AI personalization engine (frontend-only, rule-based) ----
  const upcomingEventCount = todaysEvents.filter(
    (e) => !e.completed && new Date(`${e.date}T${e.time}`).getTime() > nowTick,
  ).length;
  const aiInsights = getDailyInsights({
    priorities,
    hasMission: !!mission,
    incompleteTaskCount: routineRemaining,
    totalTaskCount: total,
    todayExpense,
    dailyLimit,
    upcomingEventCount,
  });

  // ---- Behavior AI: passive pattern detection over last 7 days ----
  const rawTasks = useAllRawTasks();
  const behaviorInsights = useMemo(
    () => getBehaviorInsights({ tasks: rawTasks, expenses }),
    [rawTasks, expenses],
  );

  // ---- Memory AI: long-term pattern memory (last 14 days) ----
  const [memoryRefresh, setMemoryRefresh] = useState(0);
  useEffect(() => {
    const onFocus = () => setMemoryRefresh((n) => n + 1);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  const memoryInsights = useMemo(() => getMemoryInsights(), [memoryRefresh]);

  // ---- Unified hero insight feed (prioritized, de-duplicated, single emoji) ----
  type HeroInsight = { message: string; emoji: string; priority: number };
  const heroInsights = useMemo<HeroInsight[]>(() => {
    const stripEmoji = (s: string) =>
      s
        .replace(
          /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\uFE0F]/gu,
          "",
        )
        .replace(/\s+/g, " ")
        .trim();
    const items: HeroInsight[] = [];
    const seen = new Set<string>();
    const push = (raw: string, emoji: string, priority: number) => {
      const clean = stripEmoji(raw);
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ message: clean, emoji, priority });
    };

    // 1 — Urgent (time-sensitive, today)
    if (overLimit) push("Today: you're over budget", "⚠️", 1);
    if (nextEvent && minsToEvent <= 15)
      push(`Now: ${nextEvent.title} in ${minsToEvent}m`, "⏰", 1);
    if (nearLimit && !overLimit) push("Today: close to your budget", "⚠️", 1);

    // 2 — Today status
    aiInsights.forEach((ins) =>
      push(`Today: ${ins.message}`, suggestionIcon(ins.type), 2),
    );

    // 3 — Weekly patterns
    behaviorInsights.forEach((ins) =>
      push(`This week: ${ins.message}`, behaviorIcon(ins.type), 3),
    );
    memoryInsights.forEach((ins) =>
      push(`This week: ${ins.message}`, memoryIcon(ins.type), 3),
    );

    return items.sort((a, b) => a.priority - b.priority).slice(0, 6);
  }, [
    aiInsights,
    behaviorInsights,
    memoryInsights,
    overLimit,
    nearLimit,
    nextEvent,
    minsToEvent,
  ]);

  const [heroIdx, setHeroIdx] = useState(0);
  const [heroVisible, setHeroVisible] = useState(true);
  useEffect(() => {
    setHeroIdx(0);
  }, [heroInsights.length]);
  useEffect(() => {
    if (heroInsights.length <= 1) {
      setHeroVisible(true);
      return;
    }
    const id = setInterval(() => {
      setHeroVisible(false);
      const t = setTimeout(() => {
        setHeroIdx((i) => (i + 1) % heroInsights.length);
        setHeroVisible(true);
      }, 300);
      return () => clearTimeout(t);
    }, 3500);
    return () => clearInterval(id);
  }, [heroInsights.length]);
  const currentHero = heroInsights[heroIdx] ?? null;

  // ---- Weekly Report (last 7 days) ----
  const weekStart = Date.now() - 7 * 86400000;
  const eventsThisWeek = events.filter((e) => {
    const t = new Date(`${e.date}T${e.time || "00:00"}`).getTime();
    return t >= weekStart && t <= Date.now();
  }).length;
  const previousCompletedCount = useMemo(() => {
    const mem = readMemory();
    const prevStart = Date.now() - 14 * 86400000;
    return mem.taskHistory.filter((e) => e.time >= prevStart && e.time < weekStart).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick]);
  const weeklyReport = useMemo(
    () =>
      getWeeklyReport({
        expenses,
        dailyLimit,
        eventsThisWeek,
        currencySymbol: takaSym,
        previousCompletedCount,
      }),
    [expenses, dailyLimit, eventsThisWeek, takaSym, previousCompletedCount, nowTick],
  );

  // ---- Weekly Report collapse (auto-collapse after first 3 days of use) ----
  const FIRST_SEEN_KEY = "dailyos.weeklyReport.firstSeen";
  const [weeklyOpen, setWeeklyOpen] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      let first = Number(localStorage.getItem(FIRST_SEEN_KEY) || 0);
      if (!first) {
        first = Date.now();
        localStorage.setItem(FIRST_SEEN_KEY, String(first));
      }
      const days = (Date.now() - first) / 86400000;
      setWeeklyOpen(days < 3);
    } catch {
      setWeeklyOpen(true);
    }
  }, []);

  const buildShareText = () => {
    const lines = ["My Weekly Report 📊", ""];
    weeklyReport.insights.slice(0, 4).forEach((ins) => lines.push(ins.message));
    lines.push("", "Track your life with DailyOS 🚀");
    return lines.join("\n");
  };

  const handleShareReport = async () => {
    const text = buildShareText();
    const nav = typeof navigator !== "undefined" ? navigator : undefined;

    // Try image share first
    try {
      const blob = await renderWeeklyShareCard({
        name: userProfile?.name,
        tasksDone: weeklyReport.meta.completedCount,
        activeDays: weeklyReport.meta.activeDays,
        spentLabel:
          weeklyReport.meta.totalSpent > 0
            ? `${takaSym}${weeklyReport.meta.totalSpent.toLocaleString()}`
            : "—",
        bestDay: weeklyReport.meta.bestDay,
        bestDayCount: weeklyReport.meta.bestDayCount,
      });
      if (blob) {
        const file = new File([blob], "dailyos-weekly.png", { type: "image/png" });
        const anyNav = nav as Navigator & {
          canShare?: (d: { files?: File[] }) => boolean;
          share?: (d: ShareData & { files?: File[] }) => Promise<void>;
        };
        if (anyNav?.canShare?.({ files: [file] }) && anyNav.share) {
          try {
            await anyNav.share({
              files: [file],
              title: "My week with DailyOS 🚀",
              text,
            });
            return;
          } catch (err) {
            if ((err as DOMException)?.name === "AbortError") return;
          }
        }
        downloadBlob(blob, "dailyos-weekly.png");
        try {
          await nav?.clipboard?.writeText(text);
          toast.success("Card saved · text copied ✅");
        } catch {
          toast.success("Card saved ✅");
        }
        return;
      }
    } catch {
      /* fall through to text share */
    }

    if (nav?.share) {
      try {
        await nav.share({ title: "My Weekly Report", text });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await nav?.clipboard?.writeText(text);
      toast.success("Copied to clipboard ✅");
    } catch {
      toast.error("Couldn't share — try again");
    }
  };






  

  // ---- AI Assistant sheet ----
  const [aiOpen, setAiOpen] = useState(false);

  // ---- First-app-load welcome banner (set by ProfileSetup finish) ----
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("dailyos.welcomeBanner") === "1") {
        sessionStorage.removeItem("dailyos.welcomeBanner");
        setShowWelcome(true);
        const t = setTimeout(() => setShowWelcome(false), 6000);
        return () => clearTimeout(t);
      }
    } catch {
      /* noop */
    }
  }, []);

  return (
    <div className="space-y-4 stagger-sections">
      {showWelcome && (
        <div
          className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-emerald-500/15 p-3.5 pr-10 animate-fade-in"
        >
          <p className="text-[13px] font-semibold text-foreground leading-[1.3]">
            Welcome to your system 🚀
          </p>
          <p className="text-[12px] text-muted-foreground leading-[1.4] mt-0.5">
            Everything is set. Let's get started.
          </p>
          <button
            onClick={() => setShowWelcome(false)}
            aria-label="Dismiss welcome"
            className="absolute top-2.5 right-2.5 size-6 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Greeting / Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-[length:200%_200%] animate-[gradient-shift_8s_ease_infinite] p-4 shadow-lg ring-1 ring-inset ring-white/10 text-white">
        <div className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-white/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold text-white tracking-tight leading-[1.2]">
              {greeting}
            </h1>
            <div
              className="mt-1.5 min-h-[20px]"
              aria-live="polite"
              aria-atomic="true"
            >
              {currentHero && (
                <p
                  key={currentHero.message}
                  className={`text-[13px] font-medium text-white/90 leading-[1.4] flex items-start gap-1.5 transition-opacity duration-300 ${
                    heroVisible ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span aria-hidden className="text-[14px] leading-[1.4]">
                    {currentHero.emoji}
                  </span>
                  <span className="truncate">{currentHero.message}</span>
                </p>
              )}
            </div>

            <p className="text-[12px] font-medium text-white/75 leading-[1.4] mt-1">
              {done} done · {eventCount} events · {formatTaka(todayExpense, takaSym)} spent
            </p>
            <p className="text-[11px] font-medium text-white/70 tracking-[0.5px] leading-[1.3] mt-1">{today}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <button
              onClick={() => navigate({ to: "/settings" })}
              aria-label="Open settings"
              className="size-7 inline-flex items-center justify-center rounded-full bg-white/15 border border-white/20 text-white active:scale-95 transition-transform"
            >
              <SettingsIcon className="size-3.5" />
            </button>
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
          className="quick-add-btn group flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card py-3 text-[13px] font-semibold text-foreground shadow-sm transition-all duration-150 ease-out active:scale-[0.96] active:border-[#378ADD]/60"
        >
          <ListChecks className="size-4 text-[#378ADD] transition-transform duration-150 group-active:scale-110" /> Task
        </button>
        <button
          onClick={() => navigate({ to: "/events" })}
          className="quick-add-btn group flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card py-3 text-[13px] font-semibold text-foreground shadow-sm transition-all duration-150 ease-out active:scale-[0.96] active:border-[#7F77DD]/60"
        >
          <CalendarPlus className="size-4 text-[#7F77DD] transition-transform duration-150 group-active:scale-110" /> Event
        </button>
        <button
          onClick={() => navigate({ to: "/expenses" })}
          className="quick-add-btn group relative flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card py-3 text-[13px] font-semibold text-foreground shadow-sm transition-all duration-150 ease-out active:scale-[0.96] active:border-[#1D9E75]/60"
        >
          <Plus className="size-4 text-[#1D9E75] transition-transform duration-150 group-active:scale-110" /> Expense
          {!hasExpenseToday && (
            <span className="pointer-events-none absolute top-1.5 right-1.5 flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1D9E75] opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-[#1D9E75] ring-2 ring-card" />
            </span>
          )}
        </button>
      </div>

      {/* Priority Card */}
      {priority && (
        <button
          onClick={() => navigate({ to: priority!.to })}
          className="press animate-fade-in w-full text-left rounded-2xl p-5 border border-primary/30 bg-primary/10 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.45)] transition-all duration-200"
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
      <Link
        to="/routine"
        className={`block ${CARD} shadow-md ${PRESS} ${focusRoutine ? "border-primary/40 shadow-primary/10 ring-1 ring-primary/15" : ""}`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] leading-[1.3] text-muted-foreground flex items-center gap-1.5">
            Today's Routine
            {focusRoutine && <FocusBadge />}
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
              {currentTask && !priorityShowsRoutineTask && (
                <div className="text-[12px] leading-[1.4]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-primary mr-1.5">NOW</span>
                  <span className="font-semibold text-foreground truncate">{currentTask.title}</span>
                </div>
              )}
              {nextTask && nextTask.id !== currentTask?.id && (
                <div className="text-[12px] leading-[1.4]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mr-1.5">✨ Up next</span>
                  <span className="font-medium text-foreground/80 truncate">
                    {nextTask.title} · {formatTime12(nextTask.time)}
                  </span>
                </div>
              )}
              {priorityShowsRoutineTask && (!nextTask || nextTask.id === currentTask?.id) && (
                <p className="text-[12px] font-medium text-muted-foreground">{done}/{total} done today</p>
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
      <div className={`rounded-2xl p-[1px] bg-gradient-to-r from-blue-500/40 via-indigo-400/30 to-emerald-400/40 transition-all duration-200 hover:shadow-md active:scale-[0.98] ${focusMission ? "shadow-primary/15 ring-1 ring-primary/25" : ""}`}>
      <section className="rounded-[15px] p-4 bg-card shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] leading-[1.3] text-muted-foreground flex items-center gap-1.5">
            <Target className="size-3.5" /> Today's Mission
            {focusMission && <FocusBadge />}
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
                  <div className={`h-1.5 bg-muted rounded-full overflow-hidden ${clamped === 0 ? "animate-soft-pulse" : ""}`}>
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
                      style={{ width: `${clamped}%`, transition: "width 0.6s ease-out" }}
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
      </div>



      {/* Today's Events */}
      <Link to="/events" className={`block ${CARD} ${PRESS} ${showEvents.length > 0 ? "bg-green-50 dark:bg-emerald-500/10 border-emerald-500/20" : ""}`}>
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
          <p className="text-sm text-muted-foreground py-1">You're all clear today <span className="inline-block animate-float-y">✨</span></p>
        )}
      </Link>

      {/* Expense Summary */}
      <section className={`${CARD} ${focusExpense ? "border-primary/40 shadow-primary/10 ring-1 ring-primary/15" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] leading-[1.3] text-muted-foreground flex items-center gap-1.5">
            <Wallet className="size-3.5" /> Expense Summary
            {focusExpense && <FocusBadge />}
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
                  <span aria-label="status" className="relative inline-flex text-[12px] leading-none">
                    {limitPct * 100 > 100 ? "🔴" : limitPct * 100 >= 80 ? "🟡" : (
                      <>
                        <span className="absolute inset-0 inline-flex rounded-full bg-emerald-400/40 animate-ping opacity-50" aria-hidden />
                        <span className="relative">🟢</span>
                      </>
                    )}
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
            {dailyLimit > 0 && (() => {
              const pctNum = limitPct * 100;
              const barClass =
                pctNum >= 100
                  ? "bg-gradient-to-r from-amber-400 via-orange-400 to-red-400"
                  : pctNum >= 80
                    ? "bg-amber-400"
                    : "bg-blue-500";
              return (
                <div className="space-y-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${barClass}`}
                      style={{ width: `${Math.min(pctNum, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-semibold leading-[1.3] ${overLimit ? "text-amber-700" : "text-muted-foreground"}`}>
                      {Math.round(pctNum)}%
                    </span>
                    {overLimit ? (
                      <span className="text-[11px] font-semibold text-amber-700 leading-[1.3] flex items-center gap-1">
                        <AlertTriangle className="size-3" /> You're over today — adjust tomorrow 💡
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-600 leading-[1.3] animate-fade-in">
                        Safe to spend today: {formatTaka(safeToSpend, takaSym)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
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
      {/* Weekly Report */}
      <section className={`${CARD} bg-gradient-to-br from-indigo-500/5 to-blue-500/5 border-indigo-500/20`}>
        <button
          type="button"
          onClick={() => setWeeklyOpen((v) => !v)}
          aria-expanded={weeklyOpen}
          className="w-full flex items-center justify-between mb-3 active:scale-[0.99] transition-transform"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] leading-[1.3] text-muted-foreground flex items-center gap-1.5">
            <BarChart3 className="size-3.5" /> Weekly Report 📊
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground/80 inline-flex items-center gap-1">
            {weeklyOpen ? "Last 7 days" : "Tap to view"}
            {weeklyOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </span>
        </button>
        {!weeklyOpen ? (
          <p className="text-[12px] font-medium text-muted-foreground leading-[1.5]">
            Weekly report ready 📊 — tap to view
          </p>
        ) : (
          <>
            {(() => {
              const hasActivity = weeklyReport.stats.some(
                (s) => s.value && s.value !== "0" && s.value !== "0/7",
              );
              if (!hasActivity) {
                return (
                  <p className="text-[13px] font-medium text-muted-foreground leading-[1.5]">
                    Not much activity yet — start building your week 🚀
                  </p>
                );
              }
              const toneClass = (tone: "good" | "warn" | "neutral") =>
                tone === "good"
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : tone === "warn"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-border/60 bg-background/60";
              const valueClass = (tone: "good" | "warn" | "neutral") =>
                tone === "good"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : tone === "warn"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground";
              return (
                <>
                  <p className="text-[13px] font-semibold text-foreground leading-[1.4]">
                    {weeklyReport.summary}
                  </p>
                  {weeklyReport.stats.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {weeklyReport.stats.slice(0, 3).map((s) => (
                        <div
                          key={s.label}
                          className={`rounded-xl border px-2 py-2 text-center transition-colors ${toneClass(s.tone)}`}
                        >
                          <div className="text-[14px] leading-none">{s.icon}</div>
                          <div className={`text-[13px] font-bold leading-[1.2] mt-1 ${valueClass(s.tone)}`}>
                            {s.value}
                          </div>
                          <div className="text-[10px] font-medium text-muted-foreground leading-[1.2] mt-0.5 truncate">
                            {s.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            {weeklyReport.insights.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
                {weeklyReport.insights.slice(0, 3).map((ins, i) => (
                  <li
                    key={`w-${i}-${ins.message}`}
                    className={`text-[12px] leading-[1.4] flex items-start gap-1.5 ${
                      ins.tone === "warning"
                        ? "text-amber-600 dark:text-amber-400"
                        : ins.tone === "positive"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground/80"
                    }`}
                  >
                    <span aria-hidden>•</span>
                    <span>{ins.message}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="h-10 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary text-[12px] font-semibold active:scale-95 transition-all"
              >
                View full report →
              </button>
              <button
                type="button"
                onClick={handleShareReport}
                className="h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md active:scale-95 transition-all"
              >
                <Share2 className="size-3.5" /> Share Report 📤
              </button>
            </div>
          </>
        )}
      </section>


      <button
        onClick={() => setAiOpen(true)}
        aria-label="Open AI Assistant"
        className="fixed bottom-20 right-4 z-40 size-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Bot className="size-5" />
      </button>
      {aiOpen && <AIAssistantSheet onClose={() => setAiOpen(false)} />}
    </div>
  );
}

function FocusBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/25 rounded-full px-1.5 py-0.5 normal-case">
      <Sparkles className="size-2.5" /> Focus
    </span>
  );
}


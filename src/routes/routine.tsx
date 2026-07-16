import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, Fragment } from "react";
import { addTask, deleteTask, editTaskToday, startNewRoutineDay, toggleTask, useTasksForDate, type Task, type Repeat } from "@/lib/tasks-store";
import { useStreak } from "@/lib/streak-store";
import { useDailySummary, getSummaryFor, type DaySummary } from "@/lib/daily-summary-store";
import { getLastSeenSummaryDate, markSummarySeen } from "@/lib/summary-seen-store";
import { pruneOldCompletions } from "@/lib/task-completions-store";
import { pruneOldExceptions } from "@/lib/task-exceptions-store";
import { Check, ClipboardList, Play, Pause, Plus, Repeat as RepeatIcon, Sparkles, Trash2, X, BookOpen, Footprints, Coffee, Brain, Droplet, Wind } from "lucide-react";
import { AIRoutineSheet } from "@/components/AIRoutineSheet";
import { suggestNextTask } from "@/lib/ai-routine.functions";
import { haptic } from "@/lib/haptic";
import { useOnline } from "@/lib/use-online";
import { toast } from "sonner";
import { useDayEndsAt } from "@/lib/day-boundary-store";

/**
 * Parse a "HH:MM" 24-hour clock string into minutes since midnight.
 * Tolerates optional " AM"/" PM" suffixes on legacy strings so a task
 * accidentally stored as "1:30 PM" is interpreted as 13:30, not 01:30.
 * Never returns a value outside [0, 1440).
 */
function toMinutes(hhmm: string): number {
  if (!hhmm) return 0;
  const raw = String(hhmm).trim().toUpperCase();
  const ampm = raw.endsWith("AM") ? "AM" : raw.endsWith("PM") ? "PM" : null;
  const core = ampm ? raw.slice(0, -2).trim() : raw;
  const [hStr, mStr] = core.split(":");
  let h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  if (ampm === "AM") h = h % 12;
  else if (ampm === "PM") h = (h % 12) + 12;
  const total = h * 60 + m;
  return ((total % 1440) + 1440) % 1440;
}

function getTaskEndMinutes(t: Task): number {
  if (t.endTime) return toMinutes(t.endTime);
  return toMinutes(t.time) + 30;
}

/**
 * Task duration in minutes, computed ONLY from the task's own start and
 * end time. Independent of Day Ends At / routine-day normalization.
 *
 *   - Same-day block:      end - start  (e.g. 12:00 → 13:30 = 90)
 *   - Zero-length block:   0            (start === end)
 *   - Cross-midnight block: end - start + 1440   (e.g. 23:30 → 01:00 = 90)
 *
 * Tasks with no endTime fall back to a 30-min default so legacy one-off
 * items keep the same behavior they've always had on the card.
 */
function rawDurationMin(t: Task): number {
  if (!t.endTime) return 30;
  const start = toMinutes(t.time);
  const end = toMinutes(t.endTime);
  const diff = end - start;
  if (diff > 0) return diff;
  if (diff === 0) return 0;
  return diff + 1440;
}



/**
 * Shift a raw calendar minute into "routine-day" coordinates where the
 * day begins at `dayEndsAtMin`. All in-day comparisons (active window,
 * missed, next-up, remaining, end-of-day) MUST use this space so that
 * late-night tasks (before the cutoff) are treated as still belonging
 * to the same routine day.
 */
function routineMinFactory(dayEndsAtMin: number) {
  return (m: number) => ((m - dayEndsAtMin) + 1440) % 1440;
}

/**
 * Late-night ordering only. Tasks whose start time is before the user's
 * "Day Ends At" setting belong to the PREVIOUS routine day — they are
 * shown under the same "Today" heading, but sorted after the evening
 * blocks so the timeline reads chronologically past midnight.
 * Stats, streaks, completions and notifications all key off the raw
 * store and are unaffected by this ordering.
 */
function taskLateNightOffset(t: Task, dayEndsAtMin: number): 0 | 1 {
  return toMinutes(t.time) < dayEndsAtMin ? 1 : 0;
}

/** Convert "HH:MM" (24h) to "h:MM AM/PM" (12h). */
function formatTime12(hhmm: string): string {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm;
  const [hRaw, mRaw] = hhmm.split(":").map(Number);
  const h = ((hRaw % 24) + 24) % 24;
  const m = ((mRaw % 60) + 60) % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatGap(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m free`;
  if (h > 0) return `${h}h free`;
  return `${m} min free`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}



export const Route = createFileRoute("/routine")({
  head: () => ({
    meta: [
      { title: "Routine — DailyOS" },
      { name: "description", content: "Your chronological daily routine checklist." },
    ],
  }),
  component: RoutinePage,
});

function RoutinePage() {
  const todayKeyStr = useMemo(() => todayKey(), []);
  const [viewDate, setViewDate] = useState(todayKeyStr);
  const isTodayView = viewDate === todayKeyStr;
  const rawTasks = useTasksForDate(viewDate);
  const tomorrowTasks = useTasksForDate(tomorrowKey());
  const { dayEndsAtMin } = useDayEndsAt();
  // Re-order so any task starting before the "Day Ends At" cutoff lands
  // AFTER tonight's tasks — those late-night tasks still belong to the
  // SAME routine day (yesterday's plan continuing past midnight).
  // Stats/streaks/completions are unaffected — they key off the raw store,
  // not this rendering order.
  const tasks = useMemo(() => [...rawTasks].sort((a, b) => {
    const da = taskLateNightOffset(a, dayEndsAtMin);
    const db = taskLateNightOffset(b, dayEndsAtMin);
    if (da !== db) return da - db;
    return toMinutes(a.time) - toMinutes(b.time);
  }), [rawTasks, dayEndsAtMin]);
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  type Suggestion = { icon: "study" | "walk" | "break" | "focus" | "hydrate" | "breathe" | "ai"; title: string; time: string; duration: string; reason: string };
  const [nextSuggestions, setNextSuggestions] = useState<Suggestion[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pct = total ? (done / total) * 100 : 0;

  // Real-time clock — client-only to avoid SSR hydration mismatch
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : -1;

  // Milestone floating cue ("Halfway", "All done") — fires once per crossing
  const [milestone, setMilestone] = useState<string | null>(null);
  const [lastMilestone, setLastMilestone] = useState<number>(0);
  useEffect(() => {
    if (total === 0) return;
    const reached = pct >= 100 ? 100 : pct >= 50 ? 50 : 0;
    if (reached > lastMilestone) {
      setLastMilestone(reached);
      setMilestone(reached === 100 ? "All done 🎉" : "Halfway there 💪");
      haptic(reached === 100 ? [12, 40, 12] : 10);
      const id = setTimeout(() => setMilestone(null), 1800);
      return () => clearTimeout(id);
    }
    if (reached < lastMilestone) setLastMilestone(reached);
  }, [pct, total, lastMilestone]);

  // Compute per-task time intelligence based on start/end block.
  // Compare in "routine-day" coordinates that start at the configured
  // Day Ends At cutoff, so a late-night task (e.g. 01:30) is treated as
  // still upcoming during the daytime of the same routine day instead of
  // being flagged as missed the instant its calendar-time end passes.
  const toRoutineMin = routineMinFactory(dayEndsAtMin);
  const nowRoutineMin = now !== null ? toRoutineMin(nowMin) : -1;
  const taskMeta = tasks.map((t) => {
    const start = toMinutes(t.time);
    const end = getTaskEndMinutes(t);
    const rStart = toRoutineMin(start);
    // Wrap-safe length (cross-midnight tasks handled correctly).
    const rawLen = Math.max(1, rawDurationMin(t) || (end - start));
    const rEnd = rStart + rawLen;
    // Time-based status only makes sense for the current routine day.
    const isActive = isTodayView && now !== null && !t.completed && nowRoutineMin >= rStart && nowRoutineMin < rEnd;
    const isMissed = isTodayView && now !== null && !t.completed && nowRoutineMin >= rEnd;
    return { start, end, rStart, rEnd, isActive, isMissed };
  });


  // Daily summary — all comparisons happen in routine-day space so late-night
  // tasks (12 AM–3 AM) can't prematurely trigger end-of-day.
  const missedCount = taskMeta.filter((m) => m.isMissed).length;
  // Planned = sum of the duration of every task currently rendered in
  // today's routine list. `tasks` comes from useTasks(), which already
  // scopes to the current routine day (today's weekday, today's exception
  // overlay, no archived-day rows). No extra date filter is required.
  // Tasks without an endTime contribute nothing (the card shows no
  // duration either).
  const plannedBreakdown = tasks
    .filter((t) => !!t.endTime)
    .map((t) => ({
      id: t.id,
      title: t.title,
      time: t.time,
      endTime: t.endTime,
      dur: rawDurationMin(t),
    }));
  const plannedMin = plannedBreakdown.reduce((sum, b) => sum + b.dur, 0);
  if (typeof window !== "undefined") {
    const dateKey = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);
    const plannedIds = new Set(plannedBreakdown.map((b) => b.id));
    const audit = rawTasks.map((t) => ({
      id: t.id,
      title: t.title,
      routineDayKey: dateKey,
      calendarDate: dateKey,
      archived: false,
      recurring: !!t.repeat && t.repeat !== "none",
      inTodayList: tasks.some((x) => x.id === t.id),
      inPlanned: plannedIds.has(t.id),
    }));
    // eslint-disable-next-line no-console
    console.log(
      `[Planned] currentRoutineDayKey=${dateKey} yesterdayKey=${yKey} today=${tasks.length} yesterday=0 planned=${plannedBreakdown.length} sum=${plannedMin}m`,
      { audit, breakdown: plannedBreakdown },
    );
  }
  const lastRoutineEnd = taskMeta.length ? Math.max(...taskMeta.map((m) => m.rEnd)) : 0;
  // End-of-day detection only applies when viewing the current routine day.
  const endOfDay = isTodayView && now !== null && tasks.length > 0 && nowRoutineMin >= lastRoutineEnd;
  const allDone = total > 0 && done === total;
  const reachedThreshold = total > 0 && done / total >= 0.8;
  const { streak, justBroke, status: streakStatus } = useStreak(reachedThreshold, endOfDay && !reachedThreshold);
  // Only persist daily summary for the actual current day; previewing a future
  // day must not overwrite today's stored stats.
  const { today: todaySummary, yesterday: yesterdaySummary } = useDailySummary(
    isTodayView ? done : 0,
    isTodayView ? total : 0,
  );

  // One-shot toast when streak breaks
  useEffect(() => {
    if (justBroke) toast("Streak broken — start again 💪", { icon: "💔" });
  }, [justBroke]);

  const [summaryDismissed, setSummaryDismissed] = useState(false);
  useEffect(() => { setSummaryDismissed(false); }, [allDone, endOfDay]);
  const showSummary = isTodayView && total > 0 && !summaryDismissed && (allDone || endOfDay);

  // Yesterday-recap card: shown once on first open of a new day.
  const [yesterdayRecap, setYesterdayRecap] = useState<DaySummary | null>(null);
  useEffect(() => {
    pruneOldCompletions();
    pruneOldExceptions();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    const ySum = getSummaryFor(yKey);
    if (ySum && ySum.total > 0 && getLastSeenSummaryDate() !== yKey) {
      setYesterdayRecap(ySum);
    }
  }, []);
  const dismissYesterdayRecap = () => {
    if (yesterdayRecap) markSummarySeen(yesterdayRecap.date);
    setYesterdayRecap(null);
  };

  // Index where "You are here" divider should appear (only after clock is set).
  // Compare in routine-day space so late-night tasks are ordered correctly.
  let hereIndex = now === null ? -2 : taskMeta.findIndex((m) => m.rStart > nowRoutineMin);
  if (now !== null && hereIndex === -1 && taskMeta.length > 0 && nowRoutineMin < taskMeta[0].rStart) hereIndex = 0;


  // Group sorted tasks into time sections. All sections belong to the same
  // routine day ("Today"); late-night tasks (before the Day Ends At cutoff)
  // get their own "Late Night" band at the end of the timeline.
  type SectionItem = { day: 0; label: string; icon: string; tasks: Task[]; originalIndices: number[] };
  const sections: SectionItem[] = [];
  let current: SectionItem | null = null;

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const m = toMinutes(t.time);
    const isLateNight = taskLateNightOffset(t, dayEndsAtMin) === 1;
    let label: string;
    let icon: string;
    if (isLateNight) { label = "Late Night"; icon = "\u{1F319}"; }
    else if (m >= 300 && m < 720) { label = "Morning"; icon = "\u{1F305}"; }
    else if (m >= 720 && m < 1020) { label = "Afternoon"; icon = "\u2600\uFE0F"; }
    else if (m >= 1020 && m < 1260) { label = "Evening"; icon = "\u{1F306}"; }
    else { label = "Night"; icon = "\u{1F319}"; }

    if (!current || current.label !== label) {
      current = { day: 0, label, icon, tasks: [], originalIndices: [] };
      sections.push(current);
    }
    current.tasks.push(t);
    current.originalIndices.push(i);
  }


  const progressLabel =
    allDone
      ? "All done 🎉"
      : missedCount > 0
      ? "Behind schedule ⚠️"
      : pct === 0
      ? "Starting..."
      : pct >= 75
      ? "Almost there 🔥"
      : pct >= 50
      ? "Halfway there 💪"
      : "On track ✅";

  return (
    <div className="space-y-5 relative">
      {milestone && (
        <div
          key={milestone}
          className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-milestone-rise"
          aria-live="polite"
        >
          <div className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-[0_10px_30px_-6px_rgba(37,99,235,0.55)]">
            {milestone}
          </div>
        </div>
      )}


      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center justify-center">
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
            🔥 {streak} day streak
          </span>
        </div>
      )}

      {/* Yesterday recap card — shown once on first open of a new day */}
      {yesterdayRecap && (() => {
        const r = yesterdayRecap;
        const dayBefore = (() => {
          const d = new Date(r.date + "T00:00:00");
          d.setDate(d.getDate() - 1);
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return getSummaryFor(k);
        })();
        const diff = dayBefore ? r.pct - dayBefore.pct : null;
        const emoji = r.pct >= 100 ? "🎉" : r.pct >= 80 ? "🔥" : r.pct >= 50 ? "💪" : "🌱";
        const streakLine =
          streakStatus === "brokenToday"
            ? "💪 Streak reset — fresh start today"
            : r.pct >= 80
            ? `🔥 Streak +1 (${streak} day${streak === 1 ? "" : "s"})`
            : null;
        return (
          <div className="relative overflow-hidden rounded-[1.25rem] border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-[0_8px_32px_-12px_rgba(37,99,235,0.25)] animate-ai-panel-in">
            <button
              onClick={dismissYesterdayRecap}
              aria-label="Dismiss"
              className="press absolute top-2.5 right-2.5 text-muted-foreground/60 hover:text-foreground p-1 rounded-full hover:bg-secondary"
            >
              <X className="size-4" />
            </button>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Yesterday recap
            </p>
            <p className="text-[15px] font-semibold text-foreground mt-1.5 leading-snug">
              You completed {r.done}/{r.total} tasks ({r.pct}%) {emoji}
            </p>
            {diff !== null && (
              <p className="text-[12px] text-muted-foreground mt-1">
                {diff > 0
                  ? `▲ ${diff}% — better than the day before`
                  : diff < 0
                  ? `▼ ${Math.abs(diff)}% — slight drop from the day before`
                  : `Same as the day before (${dayBefore!.pct}%)`}
              </p>
            )}
            {streakLine && (
              <p className="text-[12px] font-semibold text-primary mt-1">{streakLine}</p>
            )}
          </div>
        );
      })()}

      {/* Daily summary card */}
      {showSummary && (() => {
        const pctRound = todaySummary.pct;
        const yPct = yesterdaySummary?.pct ?? null;
        const diff = yPct !== null ? pctRound - yPct : null;
        const emoji = allDone ? "🎉" : pctRound >= 80 ? "🔥" : pctRound >= 50 ? "💪" : "🌱";
        return (
          <div className="relative overflow-hidden rounded-[1.25rem] border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-[0_8px_32px_-12px_rgba(37,99,235,0.25)] animate-ai-panel-in">
            <button
              onClick={() => setSummaryDismissed(true)}
              aria-label="Dismiss"
              className="press absolute top-2.5 right-2.5 text-muted-foreground/60 hover:text-foreground p-1 rounded-full hover:bg-secondary"
            >
              <X className="size-4" />
            </button>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              {allDone ? "Day complete" : "Daily summary"}
            </p>
            <p className="text-[15px] font-semibold text-foreground mt-1.5 leading-snug">
              You completed {todaySummary.done}/{todaySummary.total} tasks ({pctRound}%) {emoji}
            </p>
            {diff !== null && (
              <p className="text-[12px] text-muted-foreground mt-1">
                {diff > 0
                  ? `▲ ${diff}% vs yesterday — keep it up!`
                  : diff < 0
                  ? `▼ ${Math.abs(diff)}% vs yesterday`
                  : `Same as yesterday (${yPct}%)`}
              </p>
            )}
          </div>
        );
      })()}



      {/* Summary + progress (merged) */}
      <div>
        <div className="grid grid-cols-3 gap-3">
          <button type="button" className="press bg-card border border-border/60 border-b-0 rounded-t-2xl rounded-b-none p-3 pb-2.5 text-center transition-all active:scale-[0.98]">
            <p className="text-[22px] font-bold text-foreground leading-none">{done}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mt-1">Done</p>
          </button>
          <button type="button" className="press bg-card border border-border/60 border-b-0 rounded-t-2xl rounded-b-none p-3 pb-2.5 text-center transition-all active:scale-[0.98]">
            <p className={`text-[22px] font-bold leading-none ${total - done > 0 ? "text-foreground" : "text-muted-foreground/60"}`}>{total - done}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mt-1">Left</p>
          </button>
          <button type="button" className="press bg-card border border-border/60 border-b-0 rounded-t-2xl rounded-b-none p-3 pb-2.5 text-center transition-all active:scale-[0.98]">
            <p className="text-[18px] font-bold text-foreground leading-none">{formatDuration(plannedMin) || "0m"}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mt-1">Planned</p>
          </button>
        </div>
        <div className="bg-card border border-border/60 rounded-b-2xl rounded-t-none px-4 pt-3 pb-3 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-foreground">Today&apos;s progress</span>
            <span className="text-[13px] font-semibold tabular-nums text-foreground">
              {Math.round(pct)}%
              <span className={`ml-1.5 font-medium ${
                allDone ? "text-primary" : missedCount > 0 ? "text-destructive" : "text-muted-foreground"
              }`}>
                • {progressLabel}
              </span>
            </span>
          </div>
          <div className="h-[5px] rounded-full bg-secondary overflow-hidden">
            <div
              key={Math.round(pct)}
              className="h-full bg-primary rounded-full transition-all duration-[400ms] ease-in-out animate-progress-pulse"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Current Task */}
      {now !== null && (() => {
        // Empty routine — skip Now/Done cards entirely; the list body
        // renders its own empty state.
        if (tasks.length === 0) return null;
        // Time-based cards only apply to the current routine day.
        if (!isTodayView) return null;

        const activeIndex = taskMeta.findIndex((m) => m.isActive);
        const activeTask = activeIndex >= 0 ? tasks[activeIndex] : null;
        if (activeTask) {
          const meta = taskMeta[activeIndex];
          // remaining in routine-day space so cross-midnight blocks work.
          const remaining = Math.max(0, meta.rEnd - nowRoutineMin);
          return (
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setEditingTask(activeTask); setEditOpen(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditingTask(activeTask); setEditOpen(true); } }}
              className="press bg-card border border-primary/40 rounded-[1.25rem] p-5 shadow-[0_0_0_3px_rgba(37,99,235,0.08),0_8px_32px_-8px_rgba(37,99,235,0.2)] relative cursor-pointer text-left w-full"
              aria-label={`Edit ${activeTask.title}`}
            >
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary px-2 py-1 rounded-full bg-primary/10">
                  Now 🔥
                </span>
                <h3 className="text-lg font-bold text-foreground mt-3">{activeTask.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTask.endTime ? `${formatTime12(activeTask.time)} – ${formatTime12(activeTask.endTime)}` : formatTime12(activeTask.time)}
                </p>
                <p className="text-2xl font-bold text-primary mt-3">
                  ⏳ {formatDuration(remaining)} left
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFocusTask(activeTask); }}
                  className="press mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-full text-sm shadow-[0_4px_16px_-4px_rgba(37,99,235,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(37,99,235,0.5)]"
                >
                  <Play className="size-4" strokeWidth={2.5} /> Start Focus Session ({formatDuration(Math.min(remaining, 25)) || "25m"})
                </button>
              </div>
            </div>
          );
        }
        // Next-up must also be resolved in routine-day space so late-night
        // tasks (12 AM–3 AM) are picked as "next" during the evening.
        const nextIdx = taskMeta.findIndex((m, idx) => !tasks[idx].completed && m.rStart > nowRoutineMin);
        const nextUp = nextIdx >= 0 ? tasks[nextIdx] : undefined;
        const minsUntil = nextUp ? taskMeta[nextIdx].rStart - nowRoutineMin : 0;
        if (allDone) {
          return (
            <div className="space-y-2">
              <div className="bg-card/60 border border-primary/25 rounded-[1.25rem] p-5 text-center shadow-[0_8px_32px_-12px_rgba(37,99,235,0.25)] animate-ai-panel-in">
                <p className="text-sm text-muted-foreground animate-task-bounce">You&apos;re done for today ✨</p>
                <p className="text-[12px] text-muted-foreground/80 mt-1">
                  Archive today and reset the timeline for the next routine day.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    haptic([10, 30, 10]);
                    startNewRoutineDay();
                    setSummaryDismissed(true);
                    setNextSuggestions(null);
                    setLastMilestone(0);
                    toast.success("New routine day started 🌅");
                  }}
                  className="press mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-full text-sm shadow-[0_6px_20px_-4px_rgba(37,99,235,0.45)] hover:shadow-[0_8px_24px_-4px_rgba(37,99,235,0.55)]"
                >
                  <Sparkles className="size-4" strokeWidth={2.5} /> Start New Day
                </button>
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-2">
            <div className="bg-card/60 border border-border/40 rounded-[1.25rem] p-4 text-center">
              {nextUp ? (
                <p className="text-sm text-muted-foreground animate-breathe">
                  <span className="text-foreground/70 font-medium">🌿 Free time</span>
                  {" · next up: "}
                  <span className="text-foreground font-semibold">{nextUp.title}</span>
                  {" "}
                  <span className="font-mono text-xs">({formatTime12(nextUp.time)}{minsUntil > 0 ? ` · ${formatDuration(minsUntil)}` : ""})</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground animate-task-bounce">You&apos;re done for today ✨</p>
              )}

              {!nextSuggestions && (() => {
                const hasFreeTime = !nextUp || minsUntil >= 15;
                return (
                  <button
                    type="button"
                    disabled={suggestLoading}
                    onClick={async () => {
                      haptic(6);
                      setSuggestLoading(true);
                      const nowStr = now
                        ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
                        : "12:00";
                      // Derive contextual alternates from local state (no logic change to data)
                      const freeMin = nextUp ? Math.max(0, minsUntil) : 60;
                      const shortMin = Math.min(freeMin || 30, 30);
                      const alternates: Suggestion[] = [];
                      if (freeMin >= 20) {
                        alternates.push({
                          icon: "study",
                          title: "Quick Revision",
                          duration: `${Math.min(freeMin, 30)}m`,
                          time: nowStr,
                          reason: nextUp
                            ? `You have ${formatDuration(freeMin)} before ${nextUp.title}.`
                            : "A short focused session keeps momentum.",
                        });
                      }
                      alternates.push({
                        icon: shortMin <= 15 ? "breathe" : "walk",
                        title: shortMin <= 15 ? "2-min Breather" : "Reset Walk",
                        duration: shortMin <= 15 ? "2m" : "10m",
                        time: nowStr,
                        reason: "Refresh your mind before the next block.",
                      });
                      alternates.push({
                        icon: "hydrate",
                        title: "Hydrate & Stretch",
                        duration: "5m",
                        time: nowStr,
                        reason: "Small habit, big energy boost.",
                      });

                      try {
                        if (!online) throw new Error("offline");
                        const res = await suggestNextTask({
                          data: {
                            now: nowStr,
                            tasks: tasks.map((t) => ({
                              time: t.time,
                              endTime: t.endTime,
                              title: t.title,
                              completed: t.completed,
                            })),
                          },
                        });
                        const ai: Suggestion = {
                          icon: "ai",
                          title: res.title,
                          time: res.time,
                          duration: nextUp && minsUntil > 0 ? formatDuration(Math.min(minsUntil, 45)) : "30m",
                          reason: res.reason,
                        };
                        setNextSuggestions([ai, ...alternates].slice(0, 3));
                      } catch (err) {
                        if (!online) {
                          toast.error("Offline — showing simple suggestions");
                        } else {
                          console.error(err);
                          toast.error("AI not available");
                        }
                        // Time-of-day fallback (no AI required)
                        const hr = now ? now.getHours() : 12;
                        const todTitle =
                          hr < 11 ? "Plan your day" : hr < 17 ? "Focused Study Block" : hr < 21 ? "Wind-down review" : "Rest & recharge";
                        const todIcon: Suggestion["icon"] =
                          hr < 11 ? "focus" : hr < 17 ? "study" : hr < 21 ? "breathe" : "break";
                        const todReason =
                          hr < 11 ? "Morning energy is great for planning."
                          : hr < 17 ? "Peak focus hours — make them count."
                          : hr < 21 ? "Reflect on what worked today."
                          : "Sleep is part of the routine.";
                        const fallback: Suggestion = {
                          icon: todIcon,
                          title: nextUp ? `Warm-up before ${nextUp.title}` : todTitle,
                          time: nowStr,
                          duration: "15m",
                          reason: nextUp && minsUntil > 0
                            ? `You have ${formatDuration(minsUntil)} free before your next block.`
                            : todReason,
                        };
                        setNextSuggestions([fallback, ...alternates].slice(0, 3));
                      } finally {
                        setSuggestLoading(false);
                      }
                    }}
                    className={`press mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 transition-colors disabled:opacity-60 ${hasFreeTime && !suggestLoading && online ? "ai-glow" : ""}`}
                  >
                    {online ? (
                      <Sparkles className={`size-3.5 ${suggestLoading ? "animate-ai-spark" : ""}`} strokeWidth={2.5} />
                    ) : (
                      <span className="inline-flex"><span className="size-1.5 rounded-full bg-amber-500 mr-1" />💡</span>
                    )}
                    {suggestLoading ? "Thinking…" : online ? "What should I do next?" : "Offline ideas"}
                  </button>
                );
              })()}
            </div>
            {suggestLoading && !nextSuggestions && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-card border border-primary/15 rounded-[1.25rem] p-4 animate-ai-panel-in" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="flex items-start gap-3">
                      <div className="size-9 rounded-xl ai-shimmer shrink-0" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-3.5 w-1/2 rounded ai-shimmer" />
                        <div className="h-2.5 w-3/4 rounded ai-shimmer" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {nextSuggestions && (
              <div className="space-y-2 animate-ai-panel-in">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary inline-flex items-center gap-1.5">
                    <Sparkles className="size-3" strokeWidth={2.5} /> AI suggestions
                  </p>
                  <button
                    onClick={() => setNextSuggestions(null)}
                    className="press text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
                {nextSuggestions.map((s, idx) => {
                  const iconMap = {
                    study: { Icon: BookOpen, tint: "from-blue-500/20 to-blue-500/5 text-blue-500 border-blue-500/25" },
                    walk: { Icon: Footprints, tint: "from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/25" },
                    break: { Icon: Coffee, tint: "from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/25" },
                    focus: { Icon: Brain, tint: "from-violet-500/20 to-violet-500/5 text-violet-500 border-violet-500/25" },
                    hydrate: { Icon: Droplet, tint: "from-sky-500/20 to-sky-500/5 text-sky-500 border-sky-500/25" },
                    breathe: { Icon: Wind, tint: "from-teal-500/20 to-teal-500/5 text-teal-500 border-teal-500/25" },
                    ai: { Icon: Sparkles, tint: "from-primary/20 to-primary/5 text-primary border-primary/30" },
                  } as const;
                  const { Icon, tint } = iconMap[s.icon];
                  const isAi = s.icon === "ai";
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        haptic(10);
                        addTask({ time: s.time, title: s.title });
                        toast.success(`Added "${s.title}" ✨`);
                        setNextSuggestions(null);
                      }}
                      className={`press w-full text-left bg-card border rounded-[1.25rem] p-3.5 transition-all hover:shadow-[0_6px_20px_-10px_rgba(37,99,235,0.35)] ${isAi ? "border-primary/30 shadow-[0_4px_16px_-10px_rgba(37,99,235,0.3)]" : "border-border/60"}`}
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`size-10 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${tint}`}>
                          <Icon className="size-[18px]" strokeWidth={2.4} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[14.5px] font-semibold text-foreground leading-tight truncate">{s.title}</p>
                            <span className="shrink-0 text-[10.5px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-secondary text-foreground/70">
                              {s.duration}
                            </span>
                            {isAi && (
                              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                                AI
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{s.reason}</p>
                        </div>
                        <Plus className="size-4 text-muted-foreground/60 shrink-0 mt-1" strokeWidth={2.5} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <ul className="space-y-3">
        {sections.map((section, sIdx) => {
          return (
          <Fragment key={`${sIdx}-${section.label}`}>

            <li className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80 px-1 select-none pt-2 pb-1 animate-fade-in-soft">
              <span>{section.icon}</span>
              <span>{section.label}</span>
            </li>
            {section.tasks.map((t, si) => {
              const i = section.originalIndices[si];
              const { isActive, isMissed } = taskMeta[i];
              return (
                <Fragment key={t.id}>
                  {hereIndex === i && (
                    <li className="flex items-center gap-2.5 px-1 py-1.5 select-none animate-fade-in-soft sticky top-0 z-10">
                      <span className="relative flex size-3 shrink-0">
                        <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
                        <span className="relative size-3 rounded-full bg-primary shadow-[0_0_12px_2px_rgba(55,138,221,0.7)] animate-dot-glow" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">You are here</span>
                      <span className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-primary via-primary/70 to-transparent" />
                    </li>
                  )}
                  <li
                    style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
                    className={`press group bg-card border rounded-[1.25rem] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] animate-list-item-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)] active:scale-[0.98] active:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.14)] ${
                      t.completed ? "opacity-70 border-border/60" :
                      isActive ? "border-primary/60 bg-primary/[0.04] shadow-[0_0_0_3px_rgba(37,99,235,0.12),0_4px_20px_-4px_rgba(37,99,235,0.25)] hover:shadow-[0_0_0_3px_rgba(37,99,235,0.12),0_8px_24px_-4px_rgba(37,99,235,0.3)]" :
                      isMissed ? "border-amber-500/30 bg-amber-500/[0.03]" :
                      "border-border/60"
                    }`}
                  >
                    <div
                      key={t.completed ? "done" : "todo"}
                      className={`flex items-start gap-3 p-4 w-full ${t.completed ? "animate-task-bounce animate-success-flash rounded-[1.25rem]" : ""}`}
                    >
                      {/* Left time rail */}
                      <div className="w-16 shrink-0 flex flex-col items-start pt-0.5">
                        <span className="text-[12px] font-mono font-semibold text-foreground/80 leading-tight whitespace-nowrap">
                          {formatTime12(t.time)}
                        </span>
                        {t.endTime && (
                          <>
                            <span className="text-[10px] font-mono text-muted-foreground/70 leading-tight mt-0.5 whitespace-nowrap">
                              {formatTime12(t.endTime)}
                            </span>
                            <span className="text-[9px] font-medium text-muted-foreground/60 mt-1">
                              {formatDuration(rawDurationMin(t))}
                            </span>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => { if (!t.completed) haptic(10); toggleTask(t.id); }}
                        aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                        className={`press mt-0.5 size-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          t.completed
                            ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/25"
                            : isActive
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5 animate-pulse"
                            : isMissed
                            ? "border-amber-500/60 border-dashed bg-amber-500/5"
                            : "border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        {t.completed && <Check className="size-3.5 animate-check-pop" strokeWidth={3} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingTask(t); setEditOpen(true); }}
                        aria-label={`Edit ${t.title}`}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            key={t.completed ? "done" : "todo"}
                            className={`font-semibold text-foreground text-[0.95rem] leading-snug line-clamp-2 break-words transition-colors duration-500 ${
                              t.completed ? "strike-anim text-muted-foreground" : ""
                            }`}
                          >
                            {t.title}
                          </h3>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isActive && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                                Now 🔥
                              </span>
                            )}
                            {isMissed && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                Missed
                              </span>
                            )}
                          </div>
                        </div>
                        {t.note && (
                          <p
                            key={t.completed ? "note-done" : "note-todo"}
                            className={`text-[13px] text-muted-foreground/80 mt-1 leading-relaxed transition-opacity duration-500 ${t.completed ? "strike-anim opacity-70" : ""}`}
                          >
                            {t.note}
                          </p>
                        )}

                      </button>
                      <button
                        onClick={() => deleteTask(t.id)}
                        aria-label="Delete task"
                        className="press text-muted-foreground/40 hover:text-destructive p-1.5 rounded-full hover:bg-destructive/5"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                {i < tasks.length - 1 && (() => {
                  // Use the shared routine-day meta so cross-midnight blocks
                  // (rEnd already wraps correctly) produce the right gap.
                  const rCurEnd = taskMeta[i].rEnd;
                  const rNextStart = taskMeta[i + 1].rStart;
                  const gapMin = rNextStart - rCurEnd;
                  if (gapMin <= 0) return null;
                  return (
                    <li className="flex justify-center select-none py-0.5 animate-fade-in-soft">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60 bg-secondary/40 px-2.5 py-0.5 rounded-full">
                        · {formatGap(gapMin)} ·
                      </span>
                    </li>
                  );
                })()}
              </Fragment>
              );
            })}
          </Fragment>
          );
        })}
        {hereIndex === -1 && tasks.length > 0 && (
          <li className="flex items-center gap-2.5 px-1 py-1.5 select-none animate-fade-in-soft">
            <span className="relative flex size-3 shrink-0">
              <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
              <span className="relative size-3 rounded-full bg-primary shadow-[0_0_12px_2px_rgba(55,138,221,0.7)] animate-dot-glow" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">You are here</span>
            <span className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-primary via-primary/70 to-transparent" />
          </li>
        )}

        {tasks.length === 0 && (
          <li className="text-center text-muted-foreground py-16">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-secondary mb-5">
              <ClipboardList className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No tasks yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">Start by adding your first task 💪</p>
          </li>
        )}
      </ul>

      <button
        onClick={() => { haptic(6); setAiOpen(true); }}
        aria-label="AI Assist"
        title="AI Assist"
        style={{ ["--tx" as never]: "0px" }}
        className="press ai-float fixed bottom-24 right-1/2 translate-x-[calc(50%+3.75rem)] size-12 rounded-full bg-gradient-to-br from-card to-primary/10 border border-primary/30 text-primary flex items-center justify-center hover:border-primary/50 transition-all ai-glow"
      >
        <Sparkles className="size-5 animate-ai-spark" strokeWidth={2.5} />
      </button>

      <button
        onClick={() => { haptic(6); setOpen(true); }}
        aria-label="Add task"
        className="press fab-glow fixed bottom-24 right-1/2 translate-x-[calc(50%+7.5rem)] size-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      {open && <AddTaskSheet onClose={() => setOpen(false)} />}
      {aiOpen && <AIRoutineSheet onClose={() => setAiOpen(false)} />}
      {editOpen && editingTask && (
        <EditTaskSheet task={editingTask} onClose={() => { setEditOpen(false); setEditingTask(null); }} />
      )}
      {focusTask && (
        <FocusMode
          task={focusTask}
          onClose={() => setFocusTask(null)}
          onComplete={() => {
            if (!focusTask.completed) toggleTask(focusTask.id);
            setFocusTask(null);
          }}
        />
      )}
    </div>
  );
}




function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AddTaskSheet({ onClose }: { onClose: () => void }) {
  const [time, setTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:30");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [date, setDate] = useState<string>(() => todayKey());
  const [dateMode, setDateMode] = useState<"today" | "tomorrow" | "pick">("today");
  const [touched, setTouched] = useState(false);
  const titleEmpty = !title.trim();
  const showTitleError = touched && titleEmpty;

  const chooseDateMode = (mode: "today" | "tomorrow" | "pick") => {
    setDateMode(mode);
    if (mode === "today") setDate(todayKey());
    else if (mode === "tomorrow") setDate(tomorrowKey());
  };

  // Auto-advance end when start moves past it, unless the user has
  // explicitly typed a cross-midnight end (end < start by more than 30 min).
  const handleStartChange = (v: string) => {
    setTime(v);
    if (!endTime) return;
    const s = toMinutes(v);
    const eMin = toMinutes(endTime);
    // If end is equal or slightly before start (<= 5 min), treat as invalid
    // and push end forward by 30 min. Larger backward gaps are treated as
    // intentional cross-midnight and preserved.
    if (eMin === s || (eMin < s && s - eMin <= 5)) {
      const bumped = (s + 30) % 1440;
      setEndTime(`${String(Math.floor(bumped / 60)).padStart(2, "0")}:${String(bumped % 60).padStart(2, "0")}`);
    }
  };

  const invalidRange = !!endTime && toMinutes(endTime) === toMinutes(time);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (titleEmpty) return;
    if (invalidRange) {
      toast.error("End time must differ from start time");
      return;
    }
    const finalRepeat: Repeat =
      repeat === "custom" as never
        ? (customDays.length > 0 ? { days: [...customDays].sort() } : "none")
        : repeat;
    addTask({ time, endTime: endTime || undefined, title, note, repeat: finalRepeat, date });
    onClose();
  };


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-md">
      <div className="w-full max-w-md bg-card rounded-t-[1.75rem] p-6 shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.15)] animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground tracking-tight">New task</h3>
          <button onClick={onClose} aria-label="Close" className="press text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <Field label="Date">
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: "today", label: "Today" },
                { id: "tomorrow", label: "Tomorrow" },
                { id: "pick", label: "Pick date" },
              ] as const).map((o) => {
                const active = dateMode === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => chooseDateMode(o.id)}
                    className={`press text-[12px] font-semibold py-2.5 rounded-xl border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary text-foreground/80 border-transparent hover:bg-secondary/70"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {dateMode === "pick" && (
              <input
                type="date"
                value={date}
                min={todayKey()}
                onChange={(e) => setDate(e.target.value || todayKey())}
                className="mt-3 w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all font-medium"
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                value={time}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all font-medium"
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all font-medium"
              />
            </Field>
          </div>
          {invalidRange && (
            <p className="text-[11px] font-medium text-destructive -mt-3">End time must differ from start time.</p>
          )}

          <Field label="Title">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={showTitleError}
              placeholder="e.g. Morning run"
              className={`w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all placeholder:text-muted-foreground/60 font-medium ${
                showTitleError
                  ? "ring-2 ring-destructive/60 focus:ring-destructive/60"
                  : "focus:ring-primary/40"
              }`}
            />
            {showTitleError && (
              <p className="mt-1.5 text-[11px] font-medium text-destructive">Title is required</p>
            )}
          </Field>
          <Field label="Note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything to remember…"
              className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all placeholder:text-muted-foreground/60 resize-none font-medium"
            />
          </Field>
          <RepeatField
            value={repeat}
            customDays={customDays}
            onChange={setRepeat}
            onCustomDaysChange={setCustomDays}
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="press w-full bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-[1.25rem] py-4 font-semibold shadow-[0_8px_24px_-6px_rgba(37,99,235,0.45)] hover:shadow-[0_12px_32px_-6px_rgba(37,99,235,0.55)] disabled:opacity-45 disabled:shadow-none mt-2 transition-shadow"
          >
            Add task
          </button>
        </form>
      </div>
    </div>
  );
}

type RepeatChoice = "none" | "daily" | "weekdays" | "custom";

function RepeatField({
  value,
  customDays,
  onChange,
  onCustomDaysChange,
}: {
  value: Repeat;
  customDays: number[];
  onChange: (r: Repeat) => void;
  onCustomDaysChange: (d: number[]) => void;
}) {
  const choice: RepeatChoice =
    value === "none" || !value ? "none"
    : value === "daily" ? "daily"
    : value === "weekdays" ? "weekdays"
    : "custom";

  const setChoice = (c: RepeatChoice) => {
    if (c === "custom") {
      onChange("custom" as never); // sheet maps this on submit
    } else {
      onChange(c);
    }
  };

  const toggleDay = (d: number) => {
    const next = customDays.includes(d)
      ? customDays.filter((x) => x !== d)
      : [...customDays, d];
    onCustomDaysChange(next);
  };

  const opts: { id: RepeatChoice; label: string }[] = [
    { id: "none", label: "Once" },
    { id: "daily", label: "Daily" },
    { id: "weekdays", label: "Weekdays" },
    { id: "custom", label: "Custom" },
  ];
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <Field label="Repeat">
      <div className="grid grid-cols-4 gap-1.5">
        {opts.map((o) => {
          const active = choice === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setChoice(o.id)}
              className={`press text-[12px] font-semibold py-2.5 rounded-xl border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-secondary text-foreground/80 border-transparent hover:bg-secondary/70"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {choice === "custom" && (
        <div className="mt-3 flex gap-1.5 justify-between">
          {dayLabels.map((label, d) => {
            const active = customDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`press size-9 rounded-full text-[12px] font-bold border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-foreground/70 border-transparent"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </Field>
  );
}



function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function EditTaskSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const [time, setTime] = useState(task.time);
  const [endTime, setEndTime] = useState(task.endTime || "");
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note || "");
  const [touched, setTouched] = useState(false);
  const titleEmpty = !title.trim();
  const showTitleError = touched && titleEmpty;

  const handleStartChange = (v: string) => {
    setTime(v);
    if (!endTime) return;
    const s = toMinutes(v);
    const eMin = toMinutes(endTime);
    if (eMin === s || (eMin < s && s - eMin <= 5)) {
      const bumped = (s + 30) % 1440;
      setEndTime(`${String(Math.floor(bumped / 60)).padStart(2, "0")}:${String(bumped % 60).padStart(2, "0")}`);
    }
  };

  const invalidRange = !!endTime && toMinutes(endTime) === toMinutes(time);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (titleEmpty) return;
    if (invalidRange) {
      toast.error("End time must differ from start time");
      return;
    }
    // Route through editTaskToday so recurring tasks write a per-day
    // exception instead of mutating the template (protects history).
    editTaskToday(task.id, { time, endTime: endTime || undefined, title, note });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-md">
      <div className="w-full max-w-md bg-card rounded-t-[1.75rem] p-6 shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.15)] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground tracking-tight">Edit task</h3>
          <button onClick={onClose} aria-label="Close" className="press text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                value={time}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all font-medium"
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all font-medium"
              />
            </Field>
          </div>
          {invalidRange && (
            <p className="text-[11px] font-medium text-destructive -mt-3">End time must differ from start time.</p>
          )}

          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={showTitleError}
              placeholder="e.g. Morning run"
              className={`w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all placeholder:text-muted-foreground/60 font-medium ${
                showTitleError
                  ? "ring-2 ring-destructive/60 focus:ring-destructive/60"
                  : "focus:ring-primary/40"
              }`}
            />
            {showTitleError && (
              <p className="mt-1.5 text-[11px] font-medium text-destructive">Title is required</p>
            )}
          </Field>
          <Field label="Note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything to remember…"
              className="w-full bg-secondary rounded-xl px-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:bg-card focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] transition-all placeholder:text-muted-foreground/60 resize-none font-medium"
            />
          </Field>
          <button
            type="submit"
            disabled={!title.trim()}
            className="press w-full bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-[1.25rem] py-4 font-semibold shadow-[0_8px_24px_-6px_rgba(37,99,235,0.45)] hover:shadow-[0_12px_32px_-6px_rgba(37,99,235,0.55)] disabled:opacity-45 disabled:shadow-none mt-2 transition-shadow"
          >
            Update task
          </button>
        </form>
      </div>
    </div>
  );
}

function FocusMode({ task, onClose, onComplete }: { task: Task; onClose: () => void; onComplete: () => void }) {
  const { dayEndsAtMin } = useDayEndsAt();
  const initial = (() => {
    const startMin = toMinutes(task.time);
    // Duration handles cross-midnight tasks correctly.
    const durMin = rawDurationMin(task) || 30;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowSecInMin = now.getSeconds();
    const toRoutineMin = routineMinFactory(dayEndsAtMin);
    // Compute remaining in routine-day minutes then convert to seconds.
    const rStart = toRoutineMin(startMin);
    const rEnd = rStart + durMin;
    const rNow = toRoutineMin(nowMin);
    const remainingMin = rEnd - rNow;
    if (remainingMin <= 0) return 0;
    // Subtract the fractional second offset for a smoother first tick.
    return Math.max(0, remainingMin * 60 - nowSecInMin);
  })();
  const [remaining, setRemaining] = useState(initial);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const hh = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const mm = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const timesUp = remaining === 0;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-6 animate-in fade-in duration-300">
      <button
        onClick={onClose}
        aria-label="Exit focus"
        className="press absolute top-5 right-5 text-slate-400 hover:text-slate-100 p-2 rounded-full hover:bg-white/5 animate-in fade-in zoom-in-95 duration-300 delay-100"
      >
        <X className="size-6" />
      </button>

      <div className="flex flex-col items-center animate-in zoom-in-95 fade-in duration-500">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-300 text-center mb-12 max-w-md">
          {task.title}
        </h2>

        <div className="text-6xl md:text-8xl font-mono font-bold tabular-nums tracking-tight text-white">
          {hh}:{mm}:{ss}
        </div>

        {timesUp && (
          <p className="mt-6 text-lg font-semibold text-orange-400">Time&apos;s up ⏰</p>
        )}

        <div className="flex items-center gap-3 mt-14">
          {!paused ? (
            <button
              onClick={() => setPaused(true)}
              disabled={timesUp}
              className="press inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-5 py-3 rounded-full disabled:opacity-40"
            >
              <Pause className="size-4" /> Pause
            </button>
          ) : (
            <button
              onClick={() => setPaused(false)}
              disabled={timesUp}
              className="press inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-5 py-3 rounded-full disabled:opacity-40"
            >
              <Play className="size-4" /> Resume
            </button>
          )}
          <button
            onClick={onComplete}
            className="press inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-full shadow-[0_8px_28px_-6px_rgba(37,99,235,0.5)]"
          >
            <Check className="size-4" strokeWidth={3} /> Complete
          </button>
        </div>
      </div>
    </div>
  );
}

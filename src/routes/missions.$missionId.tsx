import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronDown, Flame, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import {
  addDay,
  addTask,
  deleteMission,
  deleteTask,
  missionProgress,
  toggleTask,
  updateTask,
  useMission,
  type Mission,
  type MissionTask,
} from "@/lib/missions-store";
import { getMissionStreak } from "@/lib/mission-streak-store";
import { DayCompleteCelebration } from "@/components/DayCompleteCelebration";

const CELEBRATED_KEY = "dailyos.dayCelebrated";
function getCelebrated(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(CELEBRATED_KEY) || "{}");
  } catch {
    return {};
  }
}
function markCelebrated(key: string) {
  const c = getCelebrated();
  c[key] = true;
  try {
    localStorage.setItem(CELEBRATED_KEY, JSON.stringify(c));
  } catch {}
}
function isCelebrated(key: string): boolean {
  return !!getCelebrated()[key];
}

export const Route = createFileRoute("/missions/$missionId")({
  head: () => ({ meta: [{ title: "Mission — DailyOS" }] }),
  component: MissionDetailPage,
});

function MissionDetailPage() {
  const { missionId } = Route.useParams();
  const navigate = useNavigate();
  const mission = useMission(missionId);

  if (!mission) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Mission not found.</p>
        <Link to="/missions" className="inline-block mt-4 text-primary font-semibold">
          Back to missions
        </Link>
      </div>
    );
  }

  const { total, done, pct } = missionProgress(mission);
  const dayCount = Math.max(mission.days || 1, 1);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  const streakInfo = getMissionStreak(missionId);
  const [streakFlash, setStreakFlash] = useState(false);
  const [celebrationDay, setCelebrationDay] = useState<number | null>(null);
  const pendingStreakRef = useRef<number | null>(null);

  const DAY_MS = 24 * 60 * 60 * 1000;
  const startMidnight = new Date(mission.startDate);
  startMidnight.setHours(0, 0, 0, 0);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const rawDay = Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / DAY_MS) + 1;
  const todayDay = rawDay >= 1 && rawDay <= dayCount ? rawDay : null;

  useEffect(() => {
    if (todayDay == null) return;
    const el = document.getElementById(`mission-day-${todayDay}`);
    if (el) {
      requestAnimationFrame(() =>
        el.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [mission.id, todayDay]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link
          to="/missions"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
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
          className="text-muted-foreground hover:text-destructive p-1.5 rounded-full"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <section className="bg-card border border-border/60 rounded-xl p-4">
        <h1 className="font-bold text-foreground text-xl">{mission.title}</h1>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            {done}/{total} tasks · {pct}%
          </p>
          {streakInfo.streak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500">
              <Flame className="size-3" /> {streakInfo.streak} day{streakInfo.streak === 1 ? "" : "s"}
            </span>
          )}
          {streakInfo.atRisk && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
              ⚠️ Streak at risk
            </span>
          )}
          {streakFlash && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary animate-pulse">
              +1 streak 🔥
            </span>
          )}
        </div>
        <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <div className="space-y-5">
        {days.map((day) => {
          const status: DayStatus =
            todayDay == null
              ? day === 1
                ? "today"
                : "future"
              : day < todayDay
                ? "past"
                : day === todayDay
                  ? "today"
                  : "future";
          return (
            <DaySection
              key={day}
              mission={mission}
              day={day}
              status={status}
              onStreakIncrease={() => {
                setStreakFlash(true);
                setTimeout(() => setStreakFlash(false), 2000);
              }}
              onDayComplete={(d, streakAfter) => {
                pendingStreakRef.current = streakAfter;
                setCelebrationDay(d);
              }}
            />
          );
        })}
      </div>

      <button
        onClick={() => addDay(mission.id)}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-xl py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40"
      >
        <Plus className="size-4" />
        Add Day
      </button>

      {celebrationDay != null && (
        <DayCompleteCelebration
          day={celebrationDay}
          onClose={() => {
            const s = pendingStreakRef.current;
            setCelebrationDay(null);
            pendingStreakRef.current = null;
            if (s && s > 0) {
              toast(`🔥 Streak increased to ${s} day${s === 1 ? "" : "s"}!`);
            }
          }}
        />
      )}
    </div>
  );
}

type DayStatus = "past" | "today" | "future";

function DaySection({
  mission,
  day,
  status,
  onStreakIncrease,
  onDayComplete,
}: {
  mission: Mission;
  day: number;
  status: DayStatus;
  onStreakIncrease?: () => void;
  onDayComplete?: (day: number, streakAfter: number) => void;
}) {
  const [value, setValue] = useState("");
  const [expanded, setExpanded] = useState(status !== "past");

  useEffect(() => {
    setExpanded(status !== "past");
  }, [status]);

  const tasks = mission.tasks
    .filter((t) => t.day === day)
    .sort((a, b) => a.createdAt - b.createdAt);

  const dayTotal = tasks.length;
  const dayDone = tasks.filter((t) => t.completed).length;
  const dayPct = dayTotal ? Math.round((dayDone / dayTotal) * 100) : 0;
  const allDone = dayTotal > 0 && dayDone === dayTotal;

  const prevAllDoneRef = useRef(allDone);
  useEffect(() => {
    if (allDone && !prevAllDoneRef.current) {
      const key = `${mission.id}:${day}`;
      if (!isCelebrated(key)) {
        markCelebrated(key);
        const streak = getMissionStreak(mission.id).streak;
        onDayComplete?.(day, streak);
      }
    }
    prevAllDoneRef.current = allDone;
  }, [allDone, mission.id, day, onDayComplete]);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const t = value.trim();
    if (!t) return;
    addTask(mission.id, t, day);
    setValue("");
  };

  const dayDate = new Date(mission.startDate + (day - 1) * 24 * 60 * 60 * 1000);
  const dateLabel = dayDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const isToday = status === "today";
  const isFuture = status === "future";
  const isPast = status === "past";

  return (
    <section
      id={`mission-day-${day}`}
      className={
        "space-y-3 rounded-xl transition-all scroll-mt-4 " +
        (isToday
          ? "border border-primary/40 bg-primary/5 p-3 shadow-sm"
          : isFuture
            ? "opacity-60"
            : "")
      }
    >
      <div
        className={isPast ? "cursor-pointer select-none" : ""}
        onClick={isPast ? () => setExpanded((v) => !v) : undefined}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-bold text-foreground text-base">
            Day {day}
            {isToday && <span className="text-primary"> (Today 🔥)</span>}
          </h2>
          <span className="text-xs text-muted-foreground">({dateLabel})</span>
          {isToday && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              Today 🔥
            </span>
          )}
          {isFuture && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
              <Lock className="size-3" /> Locked
            </span>
          )}
          {allDone && !isToday && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-full">
              <Check className="size-3" /> Done
            </span>
          )}
          {isPast && (
            <ChevronDown
              className={
                "size-4 text-muted-foreground ml-auto transition-transform " +
                (expanded ? "rotate-180" : "")
              }
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {dayDone}/{dayTotal} ({dayPct}%)
        </p>
      </div>

      {expanded && (
        <>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Add a task to Day ${day}…`}
              maxLength={200}
              className="flex-1 bg-secondary rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
            <button
              type="submit"
              disabled={!value.trim()}
              className="bg-primary text-primary-foreground font-semibold text-sm px-4 rounded-lg disabled:opacity-50"
            >
              Add
            </button>
          </form>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border/60 rounded-xl">
              No tasks yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  missionId={mission.id}
                  task={t}
                  onStreakIncrease={onStreakIncrease}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function TaskRow({
  missionId,
  task,
  onStreakIncrease,
}: {
  missionId: string;
  task: MissionTask;
  onStreakIncrease?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== task.title) {
      updateTask(missionId, task.id, v);
    } else {
      setDraft(task.title);
    }
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-3 bg-card border border-border/40 rounded-lg px-3 py-2.5">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => {
          const increased = toggleTask(missionId, task.id);
          if (increased) onStreakIncrease?.();
        }}
        className="size-4 accent-primary cursor-pointer"
      />
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          maxLength={200}
          className="flex-1 bg-secondary rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={
            "flex-1 text-left text-sm " +
            (task.completed ? "line-through text-muted-foreground" : "text-foreground")
          }
        >
          {task.title}
        </button>
      )}
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          aria-label="Edit task"
          className="text-muted-foreground hover:text-foreground p-1 rounded"
        >
          <Pencil className="size-4" />
        </button>
      )}
      <button
        onClick={() => deleteTask(missionId, task.id)}
        aria-label="Delete task"
        className="text-muted-foreground hover:text-destructive p-1 rounded"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

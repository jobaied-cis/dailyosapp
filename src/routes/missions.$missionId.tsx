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
import { MissionCompleteCelebration } from "@/components/MissionCompleteCelebration";

const MISSION_CELEBRATED_KEY = "dailyos.missionCelebrated";
function isMissionCelebrated(id: string): boolean {
  try {
    const c = JSON.parse(localStorage.getItem(MISSION_CELEBRATED_KEY) || "{}");
    return !!c[id];
  } catch {
    return false;
  }
}
function markMissionCelebrated(id: string) {
  try {
    const c = JSON.parse(localStorage.getItem(MISSION_CELEBRATED_KEY) || "{}");
    c[id] = true;
    localStorage.setItem(MISSION_CELEBRATED_KEY, JSON.stringify(c));
  } catch {}
}

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

  const dayCount = Math.max(mission?.days || 1, 1);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const tasksAll = mission?.tasks ?? [];
  const total = tasksAll.length;
  const done = tasksAll.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const streakInfo = getMissionStreak(missionId);
  const [streakFlash, setStreakFlash] = useState(false);
  const [celebrationDay, setCelebrationDay] = useState<number | null>(null);
  const [missionComplete, setMissionComplete] = useState(false);
  const pendingStreakRef = useRef<number | null>(null);

  const everyDayHasTasks = days.every((d) => tasksAll.some((t) => t.day === d));
  const isFullyComplete = !!mission && total > 0 && done === total && everyDayHasTasks;

  useEffect(() => {
    if (!mission) return;
    if (isFullyComplete && !isMissionCelebrated(mission.id) && celebrationDay == null) {
      markMissionCelebrated(mission.id);
      const t = setTimeout(() => setMissionComplete(true), 400);
      return () => clearTimeout(t);
    }
  }, [isFullyComplete, mission, celebrationDay]);

  const DAY_MS = 24 * 60 * 60 * 1000;
  const startDate = mission?.startDate ?? Date.now();
  const startMidnight = new Date(startDate);
  startMidnight.setHours(0, 0, 0, 0);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const rawDay = Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / DAY_MS) + 1;
  const todayDay = rawDay >= 1 && rawDay <= dayCount ? rawDay : null;

  useEffect(() => {
    if (!mission || todayDay == null) return;
    const el = document.getElementById(`mission-day-${todayDay}`);
    if (el) {
      requestAnimationFrame(() =>
        el.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [mission, todayDay]);

  if (!mission) {
    return (
      <div className="space-y-4 pb-12 animate-pulse">
        <div className="h-5 w-24 bg-secondary rounded" />
        <div className="h-24 w-full bg-card border border-border/60 rounded-xl" />
        <div className="h-32 w-full bg-card border border-border/60 rounded-xl" />
        <Link to="/missions" className="inline-block mt-4 text-primary font-semibold text-sm">
          Back to missions
        </Link>
      </div>
    );
  }


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
        {(() => {
          const endDate = new Date(mission.startDate + mission.days * DAY_MS);
          const endLabel = endDate.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const diff = Math.ceil((endDate.getTime() - Date.now()) / DAY_MS);
          const completed = pct >= 100;
          const overdue = !completed && diff < 0;
          const near = !overdue && !completed && diff <= 3;
          const colorClass = completed
            ? "text-emerald-500"
            : overdue
              ? "text-amber-500"
              : near
                ? "text-orange-500"
                : "text-blue-500";
          const countdown = completed
            ? "Completed ✓"
            : overdue
              ? `Overdue ${Math.abs(diff)}d`
              : diff === 0
                ? "Due today"
                : `${diff} day${diff === 1 ? "" : "s"} left`;
          return (
            <p className={`text-xs font-semibold mt-1 ${colorClass}`}>
              {completed ? countdown : `Ends ${endLabel} · ${countdown}`}
              {(diff === 1 || diff === 0) && !overdue && !completed && " · ⚠️ Last day"}
            </p>
          );
        })()}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            {done}/{total} tasks · {pct}%
          </p>
          {streakInfo.streak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500">
              <Flame className="size-3" /> {streakInfo.streak} day{streakInfo.streak === 1 ? "" : "s"}
            </span>
          )}
          {streakInfo.atRisk && pct < 100 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500">
              ⚠️ Streak at risk
            </span>
          )}
          {streakFlash && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary animate-pulse">
              +1 streak 🔥
            </span>
          )}
        </div>
        {(() => {
          const msg =
            pct >= 100
              ? "Completed 🎉"
              : pct >= 75
                ? "Almost done"
                : pct >= 50
                  ? "Halfway there 💪"
                  : pct >= 25
                    ? "Good momentum"
                    : pct > 0
                      ? "Just getting started"
                      : null;
          return msg ? (
            <p
              className={
                "text-xs font-semibold mt-2 " +
                (pct >= 100 ? "text-emerald-500" : "text-primary")
              }
            >
              {msg}
            </p>
          ) : null;
        })()}
        <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={
              "h-full transition-all duration-500 ease-out " +
              (pct >= 100 ? "bg-emerald-500" : "bg-primary")
            }
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

      {missionComplete && (
        <MissionCompleteCelebration
          title={mission.title}
          totalDays={dayCount}
          totalTasks={total}
          finalStreak={streakInfo.streak}
          finishedInDays={Math.min(
            Math.max(
              1,
              Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / DAY_MS) + 1,
            ),
            dayCount,
          )}
          onClose={() => setMissionComplete(false)}
          onStartNew={() => {
            setMissionComplete(false);
            navigate({ to: "/missions" });
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
        "space-y-3 rounded-xl transition-all scroll-mt-4 animate-fade-in " +
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
          <h2 className="font-bold text-foreground text-base">Day {day}</h2>
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
          {isPast && dayTotal > 0 && allDone && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded-full">
              <Check className="size-3" /> Done
            </span>
          )}
          {isPast && dayTotal > 0 && !allDone && dayDone > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full">
              Partial ({dayDone}/{dayTotal})
            </span>
          )}
          {isPast && (dayTotal === 0 || dayDone === 0) && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              Skipped
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
              placeholder={isToday ? "What's next?" : "Add a task…"}
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
              Add your first task 🚀
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
    <li
      className={
        "flex items-center gap-3 bg-card border border-border/40 rounded-lg px-3 py-2.5 transition-all duration-200 hover:border-border active:scale-[0.99] " +
        (task.completed ? "animate-fade-in" : "")
      }
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => {
          const increased = toggleTask(missionId, task.id);
          if (increased) onStreakIncrease?.();
        }}
        className={
          "size-4 accent-primary cursor-pointer transition-transform duration-150 ease-out hover:scale-110 active:scale-125 " +
          (task.completed ? "scale-110" : "")
        }
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
          onClick={() => !task.completed && setEditing(true)}
          className={
            "flex-1 text-left text-sm " +
            (task.completed ? "line-through text-muted-foreground" : "text-foreground")
          }
        >
          {task.title}
        </button>
      )}
      {!editing && !task.completed && (
        <button
          onClick={() => setEditing(true)}
          aria-label="Edit task"
          className="text-muted-foreground hover:text-foreground p-1 rounded"
        >
          <Pencil className="size-4" />
        </button>
      )}
      {!task.completed && (
        <button
          onClick={() => deleteTask(missionId, task.id)}
          aria-label="Delete task"
          className="text-muted-foreground hover:text-destructive p-1 rounded"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}

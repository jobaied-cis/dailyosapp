import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { addMission, deleteMission, missionProgress, updateMission, useMissions } from "@/lib/missions-store";
import { getMissionStreak } from "@/lib/mission-streak-store";
import { Pencil, Trash2, Target } from "lucide-react";

export const Route = createFileRoute("/missions")({
  head: () => ({
    meta: [
      { title: "Missions — DailyOS" },
      { name: "description", content: "Track long-term missions and goals." },
    ],
  }),
  component: MissionsLayout,
});

function MissionsLayout() {
  const matchRoute = useMatchRoute();
  const onDetail = matchRoute({ to: "/missions/$missionId" });
  if (onDetail) return <Outlet />;
  return <MissionsListPage />;
}

const PRIORITY_LABELS: Record<number, { label: string; dot: string; bar: string }> = {
  1: { label: "High", dot: "bg-red-500", bar: "bg-red-500" },
  2: { label: "Medium", dot: "bg-yellow-500", bar: "bg-yellow-500" },
  3: { label: "Low", dot: "bg-blue-500", bar: "bg-blue-500" },
};

const DAY_MS = 86_400_000;

type DeadlineStatus = "normal" | "near" | "overdue" | "done";

function deadlineLabel(
  startDate: number,
  days: number,
  pct: number,
): { text: string; status: DeadlineStatus; lastDay: boolean } {
  if (pct >= 100) return { text: "Completed ✓", status: "done", lastDay: false };
  const end = startDate + days * DAY_MS;
  const diff = Math.ceil((end - Date.now()) / DAY_MS);
  if (diff < 0)
    return { text: `Overdue ${Math.abs(diff)}d`, status: "overdue", lastDay: false };
  if (diff === 0) return { text: "Due today", status: "near", lastDay: true };
  if (diff === 1) return { text: "1 day left", status: "near", lastDay: true };
  if (diff <= 3) return { text: `${diff} days left`, status: "near", lastDay: false };
  return { text: `${diff} days left`, status: "normal", lastDay: false };
}

function deadlineColor(status: DeadlineStatus): string {
  switch (status) {
    case "done":
      return "text-emerald-500";
    case "overdue":
      return "text-amber-500";
    case "near":
      return "text-orange-500";
    default:
      return "text-blue-500";
  }
}

function MissionsListPage() {
  const missions = useMissions();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(2);
  const [duration, setDuration] = useState(7);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    addMission(t, priority, Math.max(1, Number(duration) || 1));
    setTitle("");
    setPriority(2);
    setDuration(7);
    toast.success("Mission added");
  };

  const startEdit = (m: { id: string; title: string }) => {
    setEditingId(m.id);
    setDraftTitle(m.title);
  };

  const commitEdit = (id: string) => {
    const t = draftTitle.trim();
    if (t) {
      updateMission(id, t);
      toast.success("Mission updated");
    }
    setEditingId(null);
    setDraftTitle("");
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === "Enter") commitEdit(id);
    if (e.key === "Escape") {
      setEditingId(null);
      setDraftTitle("");
    }
  };

  const sortedMissions = [...missions].sort((a, b) => a.priority - b.priority);
  const activeMissions = sortedMissions.filter((m) => missionProgress(m).pct < 100);
  const completedMissions = sortedMissions.filter((m) => missionProgress(m).pct >= 100);
  const activeCount = activeMissions.length;

  const bestStreak = sortedMissions.reduce((max, m) => {
    const s = getMissionStreak(m.id).streak;
    return s > max ? s : max;
  }, 0);

  const avgProgress = sortedMissions.length
    ? Math.round(
        sortedMissions.reduce((sum, m) => sum + missionProgress(m).pct, 0) /
          sortedMissions.length
      )
    : 0;

  const renderMissionCard = (m: (typeof sortedMissions)[number], completed: boolean) => {
    const { total, done, pct } = missionProgress(m);
    const isEditing = editingId === m.id;
    const pri = PRIORITY_LABELS[m.priority] || PRIORITY_LABELS[2];
    const streakInfo = getMissionStreak(m.id);
    const streak = streakInfo.streak;
    const atRisk = streakInfo.atRisk;
    const deadline = deadlineLabel(m.startDate, m.days, pct);
    const hasStarted = done > 0;
    return (
      <li key={m.id} className={"relative group " + (completed ? "opacity-70" : "")}>
        <Link
          to="/missions/$missionId"
          params={{ missionId: m.id }}
          className="card-pop block relative overflow-hidden bg-card border border-border/60 rounded-xl p-4 pl-5 hover:border-primary/40 hover:shadow-md transition-all"
        >
          <span className={`absolute left-0 top-0 bottom-0 w-1 ${pri.bar}`} />
          <div className="flex items-center justify-between gap-3">
            {isEditing ? (
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => commitEdit(m.id)}
                onKeyDown={(e) => handleKey(e, m.id)}
                className="flex-1 bg-secondary rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                onClick={(e) => e.preventDefault()}
              />
            ) : (
              <h3 className="font-semibold text-foreground truncate">{m.title}</h3>
            )}
            <span
              className={
                "text-sm font-bold tabular-nums shrink-0 " +
                (completed ? "text-emerald-500" : "text-primary")
              }
            >
              {pct}%
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            {done}/{total} tasks · {pct}%
          </p>

          <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={
                "h-full rounded-full transition-all duration-500 ease-out " +
                (pct >= 100 ? "bg-emerald-500" : "bg-primary")
              }
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${pri.dot}`} />
              {pri.label}
            </span>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500">
                🔥 {streak} day{streak === 1 ? "" : "s"}
              </span>
            )}
            {atRisk && !completed && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500">
                ⚠️ Streak at risk
              </span>
            )}
            <span className={`text-xs font-medium ${deadlineColor(deadline.status)}`}>
              {deadline.text}
            </span>
            {deadline.lastDay && deadline.status !== "overdue" && deadline.status !== "done" && (
              <span className="text-xs font-semibold text-amber-500">
                ⚠️ Last day
              </span>
            )}
            {!completed && (
              <span className="text-xs text-muted-foreground ml-auto">
                {hasStarted ? "Continue where you left off →" : "Let's get started →"}
              </span>
            )}
          </div>
        </Link>
        <div className="absolute top-3 right-14 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startEdit(m);
            }}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition min-w-9 min-h-9 inline-flex items-center justify-center"
            aria-label="Edit mission"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirmId(m.id);
            }}
            className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition min-w-9 min-h-9 inline-flex items-center justify-center"
            aria-label="Delete mission"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <section>
        <h2 className="font-bold text-foreground text-2xl tracking-tight">Missions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {sortedMissions.length === 0
            ? "No missions yet"
            : `${activeCount} active mission${activeCount === 1 ? "" : "s"}`}
        </p>
      </section>

      {sortedMissions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border/60 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground tabular-nums">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Active</p>
          </div>
          <div className="bg-card border border-border/60 rounded-xl p-3 text-center">
            {bestStreak > 0 ? (
              <p className="text-lg font-bold text-foreground tabular-nums">🔥 {bestStreak}</p>
            ) : (
              <p className="text-xs font-semibold text-foreground mt-1.5">Start your streak 🔥</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Best streak</p>
          </div>
          <div className="bg-card border border-border/60 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground tabular-nums">{avgProgress}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg progress</p>
          </div>
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New mission title…"
          className="w-full bg-secondary rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="bg-secondary rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value={1}>High</option>
            <option value={2}>Medium</option>
            <option value={3}>Low</option>
          </select>
          <div className="flex items-center gap-2 flex-1 bg-secondary rounded-lg px-3">
            <input
              type="number"
              min={1}
              max={365}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-16 bg-transparent py-2 outline-none text-sm tabular-nums"
            />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <button
            type="submit"
            disabled={!title.trim()}
            className="press bg-primary text-primary-foreground font-semibold text-sm px-4 rounded-lg disabled:opacity-50 shadow-[0_4px_14px_-4px_rgba(37,99,235,0.35)]"
          >
            Add
          </button>
        </div>
      </form>

      {sortedMissions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/60 rounded-xl">
          <div className="inline-flex items-center justify-center size-12 rounded-full bg-secondary mb-3">
            <Target className="size-5 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold text-foreground">No missions added</p>
          <p className="text-sm text-muted-foreground mt-1">Create one above to get started.</p>
        </div>
      ) : (
        <>
          {activeMissions.length > 0 && (
            <ul className="space-y-3">
              {activeMissions.map((m) => renderMissionCard(m, false))}
            </ul>
          )}

          {completedMissions.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
                Completed 🎉
              </h3>
              <ul className="space-y-3">
                {completedMissions.map((m) => renderMissionCard(m, true))}
              </ul>
            </section>
          )}
        </>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-foreground">Delete Mission</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this mission? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMission(confirmId);
                  setConfirmId(null);
                  toast("Mission deleted");
                }}
                className="press px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

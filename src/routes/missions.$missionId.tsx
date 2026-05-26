import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  addDay,
  addTask,
  deleteMission,
  deleteTask,
  missionProgress,
  toggleTask,
  useMission,
  type Mission,
} from "@/lib/missions-store";

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
        <p className="text-xs text-muted-foreground mt-2 font-semibold uppercase tracking-wider">
          {done}/{total} tasks · {pct}%
        </p>
        <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <div className="space-y-5">
        {days.map((day) => (
          <DaySection key={day} mission={mission} day={day} />
        ))}
      </div>

      <button
        onClick={() => addDay(mission.id)}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-xl py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40"
      >
        <Plus className="size-4" />
        Add Day
      </button>
    </div>
  );
}

function DaySection({ mission, day }: { mission: Mission; day: number }) {
  const [value, setValue] = useState("");
  const tasks = mission.tasks
    .filter((t) => t.day === day)
    .sort((a, b) => a.createdAt - b.createdAt);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const t = value.trim();
    if (!t) return;
    addTask(mission.id, t, day);
    setValue("");
  };

  return (
    <section className="space-y-3">
      <h2 className="font-bold text-foreground text-base">Day {day}</h2>

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
            <li
              key={t.id}
              className="flex items-center gap-3 bg-card border border-border/40 rounded-lg px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={t.completed}
                onChange={() => toggleTask(mission.id, t.id)}
                className="size-4 accent-primary cursor-pointer"
              />
              <span
                className={
                  "flex-1 text-sm " +
                  (t.completed ? "line-through text-muted-foreground" : "text-foreground")
                }
              >
                {t.title}
              </span>
              <button
                onClick={() => deleteTask(mission.id, t.id)}
                aria-label="Delete task"
                className="text-muted-foreground hover:text-destructive p-1 rounded"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

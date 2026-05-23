import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Trash2, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  addStep,
  deleteMission,
  deleteStep,
  missionProgress,
  toggleStep,
  useMission,
} from "@/lib/missions-store";

export const Route = createFileRoute("/missions/$missionId")({
  head: () => ({ meta: [{ title: "Mission — DailyOS" }] }),
  component: MissionDetailPage,
});

function MissionDetailPage() {
  const { missionId } = Route.useParams();
  const navigate = useNavigate();
  const mission = useMission(missionId);
  const [newTask, setNewTask] = useState("");

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
  const tasks = [...mission.steps].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const title = newTask.trim();
    if (!title) return;
    addStep(missionId, title);
    setNewTask("");
  };

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
          className="text-muted-foreground/60 hover:text-destructive p-1.5 rounded-full hover:bg-destructive/5"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <section className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
        <h1 className="font-bold text-foreground text-xl tracking-tight">
          {mission.title}
        </h1>
        <div className="flex items-baseline justify-between mt-3">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            {done}/{total} tasks completed
          </p>
          <span className="text-2xl font-extrabold text-primary tabular-nums">
            {pct}%
          </span>
        </div>
        <Progress value={pct} className="mt-3 h-3" />
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-foreground text-base">
          Tasks for this mission
        </h2>

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new task…"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!newTask.trim()}
            className="inline-flex items-center gap-1 bg-primary text-primary-foreground font-semibold text-sm px-4 rounded-md disabled:opacity-45 hover:bg-primary/90 transition"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Add
          </button>
        </form>

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-xl">
            No tasks yet. Add your first one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="group flex items-center gap-3 bg-card border border-border/40 rounded-xl px-3 py-3"
              >
                <Checkbox
                  checked={t.completed}
                  onCheckedChange={() => toggleStep(missionId, t.id)}
                  aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                />
                <span
                  className={
                    "flex-1 text-sm font-medium leading-snug " +
                    (t.completed
                      ? "line-through text-muted-foreground"
                      : "text-foreground")
                  }
                >
                  {t.title}
                </span>
                <button
                  onClick={() => deleteStep(missionId, t.id)}
                  aria-label="Delete task"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive p-1 rounded-full hover:bg-destructive/5 transition"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

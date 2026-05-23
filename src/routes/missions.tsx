import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { addMission, missionProgress, useMissions } from "@/lib/missions-store";

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

function MissionsListPage() {
  const missions = useMissions();
  const [title, setTitle] = useState("");

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    addMission(t);
    setTitle("");
  };

  return (
    <div className="space-y-6 pb-12">
      <section>
        <h2 className="font-bold text-foreground text-2xl tracking-tight">Missions</h2>
        <p className="text-sm text-muted-foreground mt-1">Tap a mission to open it.</p>
      </section>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New mission title…"
          className="flex-1 bg-secondary rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="bg-primary text-primary-foreground font-semibold text-sm px-4 rounded-lg disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {missions.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12 border border-dashed border-border/60 rounded-xl">
          No missions yet. Add one above.
        </p>
      ) : (
        <ul className="space-y-3">
          {missions.map((m) => {
            const { total, done, pct } = missionProgress(m);
            return (
              <li key={m.id}>
                <Link
                  to="/missions/$missionId"
                  params={{ missionId: m.id }}
                  className="block bg-card border border-border/60 rounded-xl p-4 hover:border-primary/40 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-foreground truncate">{m.title}</h3>
                    <span className="text-sm font-bold text-primary tabular-nums">{pct}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {done}/{total} tasks
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

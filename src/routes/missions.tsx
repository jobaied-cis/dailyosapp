import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { addMission, deleteMission, missionProgress, updateMission, useMissions } from "@/lib/missions-store";
import { Pencil, Trash2 } from "lucide-react";

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

const PRIORITY_LABELS: Record<number, { label: string; dot: string }> = {
  1: { label: "High", dot: "bg-red-500" },
  2: { label: "Medium", dot: "bg-yellow-500" },
  3: { label: "Low", dot: "bg-green-500" },
};

function MissionsListPage() {
  const missions = useMissions();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(2);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    addMission(t, priority);
    setTitle("");
    setPriority(2);
  };

  const startEdit = (m: { id: string; title: string }) => {
    setEditingId(m.id);
    setDraftTitle(m.title);
  };

  const commitEdit = (id: string) => {
    const t = draftTitle.trim();
    if (t) updateMission(id, t);
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
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="bg-secondary rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value={1}>High</option>
          <option value={2}>Medium</option>
          <option value={3}>Low</option>
        </select>
        <button
          type="submit"
          disabled={!title.trim()}
          className="bg-primary text-primary-foreground font-semibold text-sm px-4 rounded-lg disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {sortedMissions.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12 border border-dashed border-border/60 rounded-xl">
          No missions yet. Add one above.
        </p>
      ) : (
        <ul className="space-y-3">
          {sortedMissions.map((m) => {
            const { total, done, pct } = missionProgress(m);
            const isEditing = editingId === m.id;
            const pri = PRIORITY_LABELS[m.priority] || PRIORITY_LABELS[2];
            return (
              <li key={m.id} className="relative group">
                <Link
                  to="/missions/$missionId"
                  params={{ missionId: m.id }}
                  className="block bg-card border border-border/60 rounded-xl p-4 hover:border-primary/40 transition"
                >
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
                    <span className="text-sm font-bold text-primary tabular-nums">{pct}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {done}/{total} tasks
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className={`w-2 h-2 rounded-full ${pri.dot}`} />
                      {pri.label}
                    </span>
                  </div>
                </Link>
                <div className="absolute top-3 right-14 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startEdit(m);
                    }}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition"
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
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                    aria-label="Delete mission"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition"
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

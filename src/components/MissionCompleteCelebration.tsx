import { useMemo } from "react";

interface Props {
  title: string;
  totalDays: number;
  totalTasks: number;
  completedTasks?: number;
  finalStreak: number;
  finishedInDays?: number;
  onStartNew: () => void;
  onClose: () => void;
  onViewMissions?: () => void;
}

const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

export function MissionCompleteCelebration({
  title,
  totalDays,
  totalTasks,
  completedTasks,
  finalStreak,
  finishedInDays,
  onStartNew,
  onClose,
  onViewMissions,
}: Props) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2 + Math.random() * 1.6,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 360,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="absolute top-[-20px] rounded-sm"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 1.6,
              background: p.color,
              transform: `rotate(${p.rotate}deg)`,
              animation: `confetti-fall ${p.duration}s ${p.delay}s linear forwards`,
            }}
          />
        ))}
      </div>
      <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl animate-scale-in p-6 text-center">
        <div className="text-6xl mb-3 animate-bounce">🎉</div>
        <h2 className="text-2xl font-bold text-foreground">Mission accomplished!</h2>
        <p className="text-sm text-muted-foreground mt-1 truncate">{title}</p>
        {finishedInDays != null && (
          <p className="text-sm font-semibold text-primary mt-2">
            Finished in {finishedInDays} day{finishedInDays === 1 ? "" : "s"}
          </p>
        )}
        <p className="text-sm text-foreground/80 mt-1">
          {completedTasks ?? totalTasks}/{totalTasks} tasks completed ✓
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 text-left">
          <Stat label="Total days" value={String(totalDays)} />
          <Stat label="Total tasks" value={String(totalTasks)} />
          <Stat label="Final streak" value={`🔥 ${finalStreak} day${finalStreak === 1 ? "" : "s"}`} />
          <Stat label="Completion" value="100%" />
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onStartNew}
            className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
          >
            Start New Mission 🚀
          </button>
          <button
            onClick={onViewMissions ?? onClose}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            View missions
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p className="text-sm font-bold text-foreground mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

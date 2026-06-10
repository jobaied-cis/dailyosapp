import { useEffect, useMemo } from "react";

interface Props {
  day: number;
  onClose: () => void;
}

const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

export function DayCompleteCelebration({ day, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
        rotate: Math.random() * 360,
      })),
    [],
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in cursor-pointer"
    >
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
      <div className="relative text-center px-6 py-8 rounded-2xl bg-card border border-border shadow-2xl animate-scale-in max-w-xs">
        <div className="text-5xl mb-2 animate-bounce">🎉</div>
        <h2 className="text-xl font-bold text-foreground">Day {day} Complete!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Great job — keep your streak going!
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="mt-4 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

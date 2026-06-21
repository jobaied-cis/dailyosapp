import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Check, Trash2, Pencil } from "lucide-react";

interface SwipeableRowProps {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  thresholdPct?: number;
  disabled?: boolean;
  rightLabel?: string;
  rightIcon?: "check" | "edit";
  rightBgClass?: string;
  leftLabel?: string;
  leftBgClass?: string;
  children: ReactNode;
}

export function SwipeableRow({
  onSwipeRight,
  onSwipeLeft,
  thresholdPct = 0.35,
  disabled = false,
  children,
}: SwipeableRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const widthRef = useRef(0);
  const draggingRef = useRef(false);
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startXRef.current = e.clientX;
    widthRef.current = containerRef.current?.offsetWidth ?? 1;
    draggingRef.current = true;
    setAnimating(false);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || startXRef.current === null) return;
    const delta = e.clientX - startXRef.current;
    // capture pointer once we know it's a horizontal intent
    if (Math.abs(delta) > 6) {
      try { (e.target as Element).setPointerCapture(e.pointerId); } catch {}
    }
    setDx(delta);
  };

  const finish = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    startXRef.current = null;
    const w = widthRef.current || 1;
    const ratio = dx / w;
    setAnimating(true);
    if (ratio >= thresholdPct && onSwipeRight) {
      setDx(w);
      window.setTimeout(() => {
        onSwipeRight();
        setDx(0);
        setAnimating(false);
      }, 180);
    } else if (ratio <= -thresholdPct && onSwipeLeft) {
      setDx(-w);
      window.setTimeout(() => {
        onSwipeLeft();
        setDx(0);
        setAnimating(false);
      }, 180);
    } else {
      setDx(0);
      window.setTimeout(() => setAnimating(false), 220);
    }
  };

  const showRight = dx > 0;
  const showLeft = dx < 0;
  const progress = Math.min(1, Math.abs(dx) / ((widthRef.current || 1) * thresholdPct));

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-[1.25rem] touch-pan-y select-none">
      {/* Right action background (swipe right → complete) */}
      <div
        className="absolute inset-0 flex items-center justify-start pl-6 rounded-[1.25rem] bg-emerald-500/90 text-white"
        style={{ opacity: showRight ? 0.4 + 0.6 * progress : 0 }}
        aria-hidden
      >
        <div className="flex items-center gap-2">
          <Check className="size-5" />
          <span className="text-sm font-semibold">Complete</span>
        </div>
      </div>
      {/* Left action background (swipe left → delete) */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-6 rounded-[1.25rem] bg-destructive text-destructive-foreground"
        style={{ opacity: showLeft ? 0.4 + 0.6 * progress : 0 }}
        aria-hidden
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Delete</span>
          <Trash2 className="size-5" />
        </div>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{
          transform: `translate3d(${dx}px,0,0)`,
          transition: animating ? "transform 220ms cubic-bezier(0.22,1,0.36,1)" : "none",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

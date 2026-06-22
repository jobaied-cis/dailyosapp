/**
 * DailyOS — Weekly share card.
 * Renders a simple, branded PNG of the weekly report via canvas.
 * Frontend-only, no libraries.
 */

export type ShareCardInput = {
  name?: string;
  tasksDone: number;
  activeDays: number; // 0-7
  spentLabel: string; // e.g. "৳1,200" or "—"
  bestDay?: string | null;
  bestDayCount?: number;
  theme?: "dark" | "light";
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderWeeklyShareCard(
  input: ShareCardInput,
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dark = (input.theme ?? "dark") === "dark";
  const bgTop = dark ? "#0b1020" : "#ffffff";
  const bgBottom = dark ? "#131a36" : "#eef2ff";
  const fg = dark ? "#ffffff" : "#0b1020";
  const muted = dark ? "rgba(255,255,255,0.65)" : "rgba(11,16,32,0.6)";
  const accent = "#6366f1";
  const card = dark ? "rgba(255,255,255,0.06)" : "rgba(17,24,39,0.04)";
  const border = dark ? "rgba(255,255,255,0.10)" : "rgba(17,24,39,0.08)";

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Soft accent blob
  const blob = ctx.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 600);
  blob.addColorStop(0, "rgba(99,102,241,0.35)");
  blob.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "top";
  ctx.fillStyle = muted;
  ctx.font = "600 32px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("DAILYOS · WEEKLY REPORT", 80, 90);

  ctx.fillStyle = fg;
  ctx.font = "800 76px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("My week with", 80, 150);
  ctx.fillStyle = accent;
  ctx.fillText("DailyOS 🚀", 80, 234);

  // Stats grid (3 cards)
  type Stat = { label: string; value: string; icon: string };
  const stats: Stat[] = [
    { label: "Tasks done", value: String(input.tasksDone), icon: "✅" },
    { label: "Active days", value: `${input.activeDays}/7`, icon: "📅" },
    { label: "Spent", value: input.spentLabel, icon: "💸" },
  ];

  const gridY = 380;
  const gap = 24;
  const cardW = (W - 160 - gap * 2) / 3;
  const cardH = 260;
  stats.forEach((s, i) => {
    const x = 80 + i * (cardW + gap);
    ctx.fillStyle = card;
    roundRect(ctx, x, gridY, cardW, cardH, 28);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    roundRect(ctx, x, gridY, cardW, cardH, 28);
    ctx.stroke();

    ctx.fillStyle = fg;
    ctx.font = "400 64px system-ui";
    ctx.fillText(s.icon, x + 28, gridY + 28);

    ctx.font = "800 64px system-ui";
    ctx.fillText(s.value, x + 28, gridY + 110);

    ctx.fillStyle = muted;
    ctx.font = "600 26px system-ui";
    ctx.fillText(s.label, x + 28, gridY + 188);
  });

  // Best day highlight
  let y = gridY + cardH + 60;
  if (input.bestDay && (input.bestDayCount ?? 0) > 0) {
    const bh = 130;
    ctx.fillStyle = card;
    roundRect(ctx, 80, y, W - 160, bh, 24);
    ctx.fill();
    ctx.strokeStyle = border;
    roundRect(ctx, 80, y, W - 160, bh, 24);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = "600 24px system-ui";
    ctx.fillText("BEST DAY", 110, y + 24);
    ctx.fillStyle = fg;
    ctx.font = "800 40px system-ui";
    ctx.fillText(
      `${input.bestDay} — ${input.bestDayCount} action${(input.bestDayCount ?? 0) > 1 ? "s" : ""} 🌟`,
      110,
      y + 60,
    );
    y += bh + 40;
  }

  // Footer brand
  ctx.fillStyle = muted;
  ctx.font = "600 28px system-ui";
  ctx.fillText("Your Life Operating System", 80, H - 140);
  ctx.fillStyle = fg;
  ctx.font = "800 44px system-ui";
  ctx.fillText("DailyOS", 80, H - 100);

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

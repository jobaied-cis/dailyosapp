// Tiny haptic feedback helper. No-op when unsupported or reduced-motion.
export function haptic(pattern: number | number[] = 8) {
  if (typeof window === "undefined") return;
  try {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const nav = window.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    nav.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

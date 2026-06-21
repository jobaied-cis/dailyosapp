/**
 * Branded splash shown while AuthContext is hydrating.
 */
export function SplashScreen() {
  return (
    <div
      className="min-h-dvh w-full flex items-center justify-center"
      style={{ background: "#0D1220" }}
    >
      <div className="flex flex-col items-center gap-4 splash-pulse">
        <div
          className="w-16 h-16 rounded-[18px] flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #378ADD, #34D399)",
            boxShadow: "0 18px 50px -12px rgba(55,138,221,0.55)",
          }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 12 L17 9" />
          </svg>
        </div>
        <div className="text-white/85 text-sm font-medium tracking-tight">
          Daily<span style={{ color: "#378ADD" }}>OS</span>
        </div>
      </div>
      <style>{`
        @keyframes splash-pulse-kf {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.04); }
        }
        .splash-pulse { animation: splash-pulse-kf 1.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

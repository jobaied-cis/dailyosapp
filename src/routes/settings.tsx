import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, LogOut, Moon, RefreshCcw, Sun, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CurrencyTrigger } from "@/components/CurrencySheet";
import { useCurrency, TAKA } from "@/lib/currency";
import { useTheme } from "@/lib/theme-store";


export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DailyOS" },
      { name: "description", content: "Manage your DailyOS account and preferences." },
    ],
  }),
  component: SettingsPage,
});

const PRIORITY_LABELS: Record<string, { label: string; emoji: string }> = {
  study: { label: "Study", emoji: "📚" },
  productivity: { label: "Productivity", emoji: "⚡" },
  fitness: { label: "Fitness", emoji: "💪" },
  finance: { label: "Finance", emoji: "💰" },
};

const STORAGE_KEYS = {
  isFirstTime: "dailyos.auth.isFirstTime",
  isLoggedIn: "dailyos.auth.isLoggedIn",
  introProgress: "dailyos.auth.introProgress",
};

function SettingsPage() {
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();
  const currency = useCurrency();
  const { theme, setTheme, mounted } = useTheme();


  const name = userProfile?.name || "Your name";
  const avatar = userProfile?.avatar || "🙂";
  const priorities = userProfile?.priorities ?? [];
  const currencySymbol = currency === "USD" ? "$" : TAKA;

  const handleResetOnboarding = () => {
    if (!window.confirm("Restart onboarding from beginning?")) return;
    try {
      localStorage.setItem(STORAGE_KEYS.isFirstTime, "true");
      localStorage.setItem(STORAGE_KEYS.isLoggedIn, "false");
      localStorage.setItem(STORAGE_KEYS.introProgress, "0");
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to logout?")) return;
    logout();
    window.location.reload();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate({ to: "/" })}
          aria-label="Back"
          className="size-10 inline-flex items-center justify-center rounded-xl border border-border/60 bg-card text-foreground active:scale-[0.96] hover:bg-secondary/40 transition-all"
        >
          <ChevronLeft className="size-[18px]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight leading-none">Settings ⚙️</h1>
          <p className="text-[13px] text-muted-foreground leading-snug mt-1.5">
            Manage your system
          </p>
        </div>
      </div>

      {/* Profile */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-4 shadow-sm transition-all hover:border-border hover:shadow-md">
        <div className="flex items-center gap-3">
          <div
            className="size-14 rounded-full flex items-center justify-center text-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 shadow-inner"
            aria-hidden
          >
            {avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold leading-tight truncate">{name}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Currency · {currencySymbol} {currency}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/edit-profile" })}
          className="w-full h-11 rounded-[12px] border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary text-[13px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.96] transition-all"
        >
          Edit Profile
          <ChevronRight className="size-4" />
        </button>

      </section>

      {/* Preferences */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-sm transition-all hover:border-border">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Preferences
          </h2>
          <p className="text-[12px] text-muted-foreground mt-1">Your selected priorities</p>
        </div>
        {priorities.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border/60 bg-background/40 px-3 py-4 text-center">
            <p className="text-[13px] text-muted-foreground">
              Select what matters to you to personalize your system 🎯
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {priorities.map((p) => {
              const meta = PRIORITY_LABELS[p] ?? { label: p, emoji: "✨" };
              return (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[12px] font-semibold text-foreground"
                >
                  <span>{meta.emoji}</span>
                  {meta.label}
                </span>
              );
            })}
          </div>
        )}

        <div className="pt-4 mt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Currency
            </p>
            <span className="text-[11px] text-muted-foreground/80">
              {currencySymbol} {currency}
            </span>
          </div>
          <CurrencyTrigger
            ariaLabel="Change currency"
            className="w-full h-12 rounded-[12px] border border-border/60 bg-background hover:bg-secondary/40 text-[13px] font-semibold text-foreground flex items-center justify-between px-4 active:scale-[0.96] transition-all"
          >
            <span className="inline-flex items-center gap-2">
              <User className="size-4 text-primary" />
              {currencySymbol} {currency}
            </span>
            <span className="text-[12px] text-muted-foreground inline-flex items-center gap-0.5">
              Change <ChevronRight className="size-3.5" />
            </span>
          </CurrencyTrigger>
        </div>
      </section>

      {/* Actions */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-md">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Actions
        </h2>

        <div className="space-y-1.5">
          <button
            onClick={handleResetOnboarding}
            className="w-full h-11 rounded-[12px] border border-border/70 bg-transparent hover:bg-secondary/40 text-foreground text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.96] transition-all"
          >
            <RefreshCcw className="size-4 text-muted-foreground" />
            Restart onboarding
          </button>
          <p className="text-[11px] text-muted-foreground text-center px-2">
            This will restart your onboarding experience
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full h-11 rounded-[12px] bg-red-500/90 hover:bg-red-500 text-white text-[13px] font-semibold flex items-center justify-center gap-2.5 shadow-sm shadow-red-500/15 active:scale-[0.96] transition-all"
        >
          <LogOut className="size-4" />
          <span>Logout</span>
        </button>
      </section>
    </div>
  );
}

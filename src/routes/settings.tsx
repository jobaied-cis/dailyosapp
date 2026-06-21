import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, LogOut, RefreshCcw, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CurrencyTrigger } from "@/components/CurrencySheet";
import { useCurrency, TAKA } from "@/lib/currency";

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
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate({ to: "/" })}
          aria-label="Back"
          className="size-9 inline-flex items-center justify-center rounded-xl border border-border/60 bg-card text-foreground active:scale-95 transition-transform"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight leading-tight">Settings ⚙️</h1>
          <p className="text-[13px] text-muted-foreground leading-snug">Manage your system</p>
        </div>
      </div>

      {/* Profile */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="size-14 rounded-full flex items-center justify-center text-2xl border border-border/60 bg-background"
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
          className="w-full h-10 rounded-[12px] border border-border/60 bg-background text-[13px] font-semibold text-foreground active:scale-[0.98] transition-transform"
        >
          Edit Profile
        </button>
      </section>

      {/* Preferences */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Preferences
          </h2>
          <p className="text-[12px] text-muted-foreground mt-1">Your selected priorities</p>
        </div>
        {priorities.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No priorities selected.</p>
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

        <div className="pt-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Currency
          </p>
          <CurrencyTrigger
            ariaLabel="Change currency"
            className="w-full h-10 rounded-[12px] border border-border/60 bg-background text-[13px] font-semibold text-foreground flex items-center justify-between px-3 active:scale-[0.98] transition-transform"
          >
            <span className="inline-flex items-center gap-2">
              <User className="size-4 text-primary" />
              {currencySymbol} {currency}
            </span>
            <span className="text-[12px] text-muted-foreground">Change</span>
          </CurrencyTrigger>
        </div>
      </section>

      {/* Actions */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Actions
        </h2>

        <button
          onClick={handleResetOnboarding}
          className="w-full h-11 rounded-[12px] border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <RefreshCcw className="size-4" />
          Restart onboarding
        </button>

        <button
          onClick={handleLogout}
          className="w-full h-11 rounded-[12px] border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </section>
    </div>
  );
}

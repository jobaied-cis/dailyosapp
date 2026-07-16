import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mail,
  Moon,
  RefreshCcw,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { CurrencyTrigger } from "@/components/CurrencySheet";
import { useCurrency, TAKA } from "@/lib/currency";
import { useTheme } from "@/lib/theme-store";
import { useDayEndsAt } from "@/lib/day-boundary-store";

function formatHour12(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

const DAY_END_OPTIONS = [0, 60, 120, 180, 240, 300, 360]; // 12 AM – 6 AM

const APP_VERSION = "v1.0";

const APP_DESCRIPTION = "Your Life Operating System — plan your day, manage tasks, track expenses, and stay focused.";

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
  const { dayEndsAtMin, setDayEndsAtMin, mounted: dayEndsMounted } = useDayEndsAt();

  const name = userProfile?.name || "Your name";
  const avatar = userProfile?.avatar || "🙂";
  const email = userProfile?.name ? "you@dailyos.app" : undefined;
  const priorities = userProfile?.priorities ?? [];
  const currencySymbol = currency === "USD" ? "$" : TAKA;

  const handleResetOnboarding = () => {
    toast("Restart onboarding from beginning?", {
      action: {
        label: "Restart",
        onClick: () => {
          try {
            localStorage.setItem(STORAGE_KEYS.isFirstTime, "true");
            localStorage.setItem(STORAGE_KEYS.isLoggedIn, "false");
            localStorage.setItem(STORAGE_KEYS.introProgress, "0");
          } catch {
            /* noop */
          }
          window.location.reload();
        },
      },
    });
  };

  const handleLogout = () => {
    toast("Logout from DailyOS?", {
      action: {
        label: "Logout",
        onClick: () => {
          logout();
          window.location.reload();
        },
      },
    });
  };

  const handleComingSoon = () => {
    toast("Coming soon 🚀");
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
          <h1 className="text-[22px] font-bold tracking-tight leading-none">Settings</h1>
          <p className="text-[13px] text-muted-foreground leading-snug mt-1.5">
            Manage your system
          </p>
        </div>
      </div>

      {/* Profile */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-4 shadow-sm transition-all hover:border-border hover:shadow-md">
        <SectionHeader title="Profile" subtitle="Your account" />
        <div className="flex items-center gap-3">
          <div
            className="size-16 rounded-full flex items-center justify-center text-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 shadow-inner"
            aria-hidden
          >
            {avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold leading-tight truncate">{name}</p>
            {email && (
              <p className="text-[12px] text-muted-foreground mt-0.5 inline-flex items-center gap-1 truncate">
                <Mail className="size-3.5" />
                {email}
              </p>
            )}
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              <span>{currencySymbol}</span>
              {currency}
            </div>
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
        <SectionHeader title="Preferences" subtitle="Your selected priorities" />
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

        <div className="pt-3 mt-1 border-t border-border/50">
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

      {/* Appearance */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-sm transition-all hover:border-border">
        <SectionHeader title="Appearance" subtitle="Choose your theme" />
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: "light" as const, label: "Light", icon: Sun, emoji: "☀️" },
            { value: "dark" as const, label: "Dark", icon: Moon, emoji: "🌙" },
          ]).map(({ value, label, icon: Icon, emoji }) => {
            const selected = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={selected}
                className={`h-12 rounded-[12px] border text-[13px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.96] ${
                  selected
                    ? "border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px_var(--primary)]"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                <Icon className={`size-4 ${selected ? "text-primary" : ""}`} />
                <span>{emoji} {label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Routine Day */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-sm transition-all hover:border-border">
        <SectionHeader
          title="Routine Day"
          subtitle="Tasks scheduled before this time belong to the previous routine day."
        />
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">Day ends at</span>
          <span className="text-[12px] font-mono font-semibold text-primary">
            {dayEndsMounted ? formatHour12(dayEndsAtMin) : "—"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {DAY_END_OPTIONS.map((opt) => {
            const selected = dayEndsMounted && dayEndsAtMin === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setDayEndsAtMin(opt)}
                aria-pressed={selected}
                className={`h-10 rounded-[10px] border text-[12px] font-semibold transition-all active:scale-[0.96] ${
                  selected
                    ? "border-primary bg-primary/10 text-primary shadow-[0_0_0_1px_var(--primary)]"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                {formatHour12(opt)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Future Features */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-sm transition-all hover:border-border">
        <SectionHeader title="Future Features" subtitle="More power coming soon" />
        <div className="space-y-2">
          <FutureFeatureRow icon={Bell} label="Notifications" onClick={handleComingSoon} />
          <FutureFeatureRow icon={Sparkles} label="AI Settings" onClick={handleComingSoon} />
          <FutureFeatureRow icon={BarChart3} label="Statistics" onClick={handleComingSoon} />
        </div>
      </section>

      {/* Security */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-md transition-all hover:border-border">
        <SectionHeader title="Security" subtitle="Account actions" />
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={handleResetOnboarding}
            className="h-11 rounded-[14px] border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.96] transition-all"
          >
            <RefreshCcw className="size-4" />
            Restart Onboarding
          </button>

          <button
            onClick={handleLogout}
            className="h-11 rounded-[14px] bg-red-500/90 hover:bg-red-500 text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-sm shadow-red-500/20 active:scale-[0.96] transition-all"
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </div>
      </section>

      {/* About */}
      <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-sm">
        <SectionHeader title="About" />
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground">DailyOS</p>
            <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
              {APP_DESCRIPTION}
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-full border border-border/60 bg-background/50 ml-3">
            {APP_VERSION}
          </span>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[12px] text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function FutureFeatureRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-12 rounded-[12px] border border-border/60 bg-background/40 hover:bg-secondary/40 text-[13px] font-semibold text-foreground flex items-center justify-between px-4 active:scale-[0.96] transition-all"
    >
      <span className="inline-flex items-center gap-2.5">
        <Icon className="size-4 text-primary" />
        {label}
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}

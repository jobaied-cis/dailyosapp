import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { CalendarDays, Home, ListChecks, Moon, Sun, Target, Wallet } from "lucide-react";
import { useTheme } from "@/lib/theme-store";
import { useCurrency, TAKA } from "@/lib/currency";
import { CurrencyTrigger } from "@/components/CurrencySheet";

export function AppShell() {
  const { pathname } = useLocation();

  const titles: Record<string, string> = {
    "/": "DailyOS",
    "/routine": "DailyOS",
  };

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-md flex flex-col min-h-screen relative">
        <header className="px-6 pt-8 pb-4">
          <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-3 border transition-all duration-200 bg-gradient-to-r from-white via-slate-50 to-white border-slate-200 shadow-sm text-slate-900 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:border-white/10 dark:shadow-md dark:text-white">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-emerald-400 shrink-0"
                style={{ boxShadow: "0 0 0 6px rgba(55,138,221,0.12)" }}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="7" />
                  <path d="M12 12 L16 9" />
                </svg>
              </span>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="font-semibold text-sm leading-none">
                  <span>Daily</span>
                  <span className="text-primary">OS</span>
                </span>
                <span className="text-[9px] uppercase tracking-wide mt-1 text-slate-500 dark:text-white/60">
                  Your Life Operating System
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CurrencyToggle />
              <span aria-hidden className="w-px h-5 mx-1 bg-slate-200 dark:bg-white/10" />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main key={pathname} className="flex-1 px-6 pb-32 animate-screen-in">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-5 pt-3">
          <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-[1.25rem] shadow-[0_8px_32px_-8px_rgba(15,23,42,0.12)] grid grid-cols-5 p-1.5">
            <NavItem to="/" icon={<Home className="size-5" />} label="Home" exact />
            <NavItem to="/routine" icon={<ListChecks className="size-5" />} label="Routine" />
            <NavItem to="/missions" icon={<Target className="size-5" />} label="Mission" />
            <NavItem to="/events" icon={<CalendarDays className="size-5" />} label="Events" />
            <NavItem to="/expenses" icon={<Wallet className="size-5" />} label="Expense" />
          </div>
        </nav>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="press inline-flex items-center justify-center size-10 rounded-full bg-secondary text-foreground hover:bg-secondary/80"
    >
      {mounted ? (
        theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />
      ) : (
        <span className="size-5" />
      )}
    </button>
  );
}

function CurrencyToggle() {
  const currency = useCurrency();
  const label = currency === "BDT" ? TAKA : "$";
  return (
    <CurrencyTrigger
      ariaLabel="Change currency"
      className="press inline-flex items-center justify-center size-10 rounded-full bg-secondary text-foreground hover:bg-secondary/80 font-bold text-base leading-none"
    >
      {label}
    </CurrencyTrigger>
  );
}

function NavItem({
  to,
  icon,
  label,
  exact,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="press flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-[1rem] text-muted-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-md min-w-0"
    >
      {icon}
      <span className="text-[10px] font-semibold leading-none w-full text-center truncate">{label}</span>
    </Link>
  );
}

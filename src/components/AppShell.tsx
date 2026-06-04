import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { CalendarDays, Home, ListChecks, Moon, Sun, Target, Wallet } from "lucide-react";
import { useTheme } from "@/lib/theme-store";
import { useCurrency, setCurrency, TAKA } from "@/lib/currency";

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-primary" />
                <h1 className="pl-2 text-[1.75rem] font-extrabold tracking-tight text-foreground leading-none">
                  <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Daily
                  </span>
                  <span className="text-foreground">OS</span>
                </h1>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-none">
                Your Life Operating System
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CurrencyToggle />
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
      className="press flex flex-col items-center justify-center gap-1 py-2.5 rounded-[1rem] text-muted-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-md"
    >
      {icon}
      <span className="text-[11px] font-semibold leading-none">{label}</span>
    </Link>
  );
}

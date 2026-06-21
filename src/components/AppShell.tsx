import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { CalendarDays, Home, ListChecks, Moon, Sun, Target, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useTheme } from "@/lib/theme-store";
import { useCurrency, TAKA } from "@/lib/currency";
import { CurrencyTrigger } from "@/components/CurrencySheet";

export function AppShell() {
  const { pathname } = useLocation();

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

/* --- Ripple hook --- */
function useRipples() {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const addRipple = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((r) => r.filter((p) => p.id !== id)), 520);
  };
  const node = (
    <>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="header-ripple"
          style={{ left: r.x, top: r.y }}
        />
      ))}
    </>
  );
  return { node, addRipple };
}

/* --- Toggle switch shell --- */
function ToggleSwitch({
  on,
  onClick,
  ariaLabel,
  trackClass,
  knobClass,
  children,
  extras,
}: {
  on: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
  trackClass: string;
  knobClass: string;
  children: ReactNode;
  extras?: ReactNode;
}) {
  const { node, addRipple } = useRipples();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={on}
      onClick={(e) => {
        addRipple(e);
        onClick(e);
      }}
      className={`relative overflow-hidden rounded-full transition-all duration-300 ease-out active:scale-95 ${trackClass}`}
      style={{ width: 60, height: 32 }}
    >
      {extras}
      <span
        className={`absolute top-1/2 -translate-y-1/2 rounded-full shadow-md flex items-center justify-center ${knobClass}`}
        style={{
          width: 26,
          height: 26,
          left: on ? 31 : 3,
          transition: "left 320ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), background 300ms ease",
          transform: on ? "rotate(360deg)" : "rotate(0deg)",
        }}
      >
        {children}
      </span>
      {node}
    </button>
  );
}

function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme();
  const isDark = mounted && theme === "dark";

  return (
    <ToggleSwitch
      on={isDark}
      onClick={toggle}
      ariaLabel="Toggle theme"
      trackClass={
        isDark
          ? "bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950"
          : "bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400"
      }
      knobClass={
        isDark
          ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800"
          : "bg-gradient-to-br from-white to-amber-50 text-amber-500"
      }
      extras={
        isDark ? (
          <>
            <span className="absolute header-twinkle rounded-full bg-white" style={{ width: 2, height: 2, top: 7, left: 10 }} />
            <span className="absolute header-twinkle rounded-full bg-white" style={{ width: 2, height: 2, top: 18, left: 18, animationDelay: "0.4s" }} />
            <span className="absolute header-twinkle rounded-full bg-white" style={{ width: 1.5, height: 1.5, top: 12, left: 22, animationDelay: "0.9s" }} />
          </>
        ) : null
      }
    >
      <span key={isDark ? "moon" : "sun"} className="header-sym-in inline-flex">
        {!mounted ? (
          <span className="w-3.5 h-3.5" />
        ) : isDark ? (
          <Moon className="w-3.5 h-3.5" />
        ) : (
          <Sun className="w-3.5 h-3.5" />
        )}
      </span>
    </ToggleSwitch>
  );
}

function CurrencyToggle() {
  const currency = useCurrency();
  const isUSD = currency === "USD";
  const label = isUSD ? "$" : TAKA;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const { node, addRipple } = useRipples();

  return (
    <div className="relative inline-flex">
      {/* Hidden CurrencyTrigger to reuse drawer logic */}
      <CurrencyTrigger ariaLabel="Change currency" className="sr-only absolute pointer-events-none">
        <span ref={(el) => { triggerRef.current = el as unknown as HTMLButtonElement; }} />
      </CurrencyTrigger>
      <button
        type="button"
        aria-label="Change currency"
        aria-pressed={isUSD}
        onClick={(e) => {
          addRipple(e);
          // Forward click to the hidden CurrencyTrigger button to open the sheet.
          const root = (e.currentTarget.parentElement as HTMLElement | null);
          const hidden = root?.querySelector<HTMLButtonElement>("button.sr-only");
          hidden?.click();
        }}
        className={`relative overflow-hidden rounded-full transition-all duration-300 ease-out active:scale-95 ${
          isUSD
            ? "bg-gradient-to-l from-emerald-400 via-emerald-500 to-blue-500"
            : "bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"
        }`}
        style={{ width: 60, height: 32 }}
      >
        <span
          className={`absolute top-1/2 -translate-y-1/2 rounded-full shadow-md flex items-center justify-center font-bold text-[13px] leading-none ${
            isUSD
              ? "bg-gradient-to-br from-emerald-300 to-blue-400 text-white"
              : "bg-gradient-to-br from-blue-400 to-emerald-300 text-white"
          }`}
          style={{
            width: 26,
            height: 26,
            left: isUSD ? 31 : 3,
            transition: "left 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background 300ms ease",
          }}
        >
          <span key={label} className="header-sym-in inline-block">{label}</span>
        </span>
        {node}
      </button>
    </div>
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

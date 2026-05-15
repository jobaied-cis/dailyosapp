import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Home, ListChecks } from "lucide-react";

export function AppShell() {
  const { pathname } = useLocation();

  const titles: Record<string, string> = {
    "/": "DailyOS",
    "/routine": "DailyOS",
  };

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-md flex flex-col min-h-screen relative">
        <header className="px-5 pt-6 pb-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {titles[pathname] ?? "DailyOS"}
            </h1>
            <span className="text-xs font-medium text-muted-foreground">
              Your Life OS
            </span>
          </div>
        </header>

        <main className="flex-1 px-5 pb-28">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="bg-card border border-border rounded-2xl shadow-lg shadow-primary/5 grid grid-cols-2 p-1.5">
            <NavItem to="/" icon={<Home className="size-5" />} label="Home" exact />
            <NavItem to="/routine" icon={<ListChecks className="size-5" />} label="Routine" />
          </div>
        </nav>
      </div>
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
      className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-muted-foreground transition-colors data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

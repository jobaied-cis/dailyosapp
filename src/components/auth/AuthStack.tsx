import { useAuth } from "@/lib/auth-context";

type AuthStackProps = {
  initial?: "intro" | "welcome";
};

/**
 * AuthStack — placeholder only.
 * Accepts `initial` to decide which sub-screen would mount first
 * (intro for first-timers, welcome for returning logged-out users).
 * Real screens land in a later step.
 */
export function AuthStack({ initial = "welcome" }: AuthStackProps) {
  const { login } = useAuth();
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">DailyOS — Auth</h1>
        <p className="text-sm text-muted-foreground">
          Placeholder auth stack (initial: <code>{initial}</code>). UI screens come later.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => login({ name: "Guest" })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Continue (dummy login)
          </button>
        </div>
      </div>
    </div>
  );
}

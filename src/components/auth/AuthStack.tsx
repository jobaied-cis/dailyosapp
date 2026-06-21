import { useAuth } from "@/lib/auth-context";

/**
 * AuthStack — placeholder only.
 * No UI design yet; just wired actions so the navigation switch works.
 */
export function AuthStack() {
  const { login } = useAuth();
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">DailyOS — Auth</h1>
        <p className="text-sm text-muted-foreground">
          Placeholder auth stack. UI screens come later.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => login({ id: `local-${Date.now()}`, name: "Guest" })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Continue (dummy login)
          </button>
        </div>
      </div>
    </div>
  );
}

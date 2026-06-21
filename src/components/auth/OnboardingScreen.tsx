import { useAuth } from "@/lib/auth-context";

/**
 * Onboarding/Intro placeholder. Shown when isFirstTime === true.
 */
export function OnboardingScreen() {
  const { completeOnboarding } = useAuth();
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">Welcome to DailyOS</h1>
        <p className="text-sm text-muted-foreground">
          Intro screens will live here. Placeholder for now.
        </p>
        <button
          onClick={completeOnboarding}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Get started
        </button>
      </div>
    </div>
  );
}

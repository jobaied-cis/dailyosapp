/**
 * Temporary splash placeholder shown while AuthContext is hydrating.
 * No design yet — will be upgraded later.
 */
export function SplashScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading DailyOS...</p>
    </div>
  );
}

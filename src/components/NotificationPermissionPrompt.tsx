import { Bell, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  getSettings,
  subscribeSettings,
  updateSettings,
} from "@/lib/notifications/notification-settings-store";
import { getPermissionState, requestPermission } from "@/lib/notifications/permission";
import { broadcastSettingsChanged } from "@/lib/notifications/notification-scheduler";

/**
 * Contextual in-app card asking permission. Rendered by AppShell.
 * We never call requestPermission() until the user taps "Enable".
 */
export function NotificationPermissionPrompt() {
  const settings = useSyncExternalStore(
    subscribeSettings,
    () => getSettings(),
    () => getSettings(),
  );
  const permission = getPermissionState();

  const shouldShow =
    settings.masterEnabled &&
    !settings.permissionDismissed &&
    permission === "default";

  if (!shouldShow) return null;

  const onEnable = async () => {
    const result = await requestPermission();
    if (result === "granted") {
      toast.success("Notifications enabled");
    } else if (result === "denied") {
      toast("Notifications blocked. You can enable them from your browser settings.");
    }
    updateSettings({ permissionDismissed: true });
    broadcastSettingsChanged();
  };

  const onDismiss = () => {
    updateSettings({ permissionDismissed: true });
    broadcastSettingsChanged();
  };

  return (
    <div className="fixed inset-x-0 bottom-24 z-40 pointer-events-none px-4 flex justify-center">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-primary/30 bg-card shadow-lg p-4 flex items-start gap-3">
        <div className="size-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
          <Bell className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold leading-tight">Enable Notifications</p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
            Get reminders for your routine, missions, events, and daily summary — even when
            DailyOS is in the background.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onEnable}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold active:scale-[0.97] transition-transform"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="h-9 px-4 rounded-lg border border-border/60 bg-background/40 text-[12px] font-semibold text-muted-foreground hover:bg-secondary/40"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 size-8 rounded-lg text-muted-foreground hover:bg-secondary/40 inline-flex items-center justify-center"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

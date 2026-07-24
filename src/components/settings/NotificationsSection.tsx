import { Bell } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  getSettings,
  subscribeSettings,
  updateSettings,
  type NotificationSettings,
} from "@/lib/notifications/notification-settings-store";
import { getPermissionState, requestPermission } from "@/lib/notifications/permission";
import { broadcastSettingsChanged } from "@/lib/notifications/notification-scheduler";

const LEAD_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hr" },
  { value: 120, label: "2 hr" },
];

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {subtitle && <p className="text-[12px] text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between h-11 px-3 rounded-[10px] border border-border/60 bg-background/40 ${
        disabled ? "opacity-50" : "hover:bg-secondary/40"
      }`}
    >
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function TimeRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between h-11 px-3 rounded-[10px] border border-border/60 bg-background/40 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <input
        type="time"
        className="bg-transparent text-[13px] font-mono font-semibold text-primary outline-none"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function NotificationsSection() {
  const settings = useSyncExternalStore(
    subscribeSettings,
    () => getSettings(),
    () => getSettings(),
  );
  const permission = getPermissionState();

  const patch = (p: Partial<NotificationSettings>) => {
    updateSettings(p);
    broadcastSettingsChanged();
  };

  const onMasterToggle = async (v: boolean) => {
    patch({ masterEnabled: v });
    if (v && permission === "default") {
      // Don't request automatically — surface the in-app card by
      // clearing the "dismissed" flag so it can appear.
      patch({ permissionDismissed: false });
    }
  };

  const onRequestPermission = async () => {
    const result = await requestPermission();
    if (result === "granted") toast.success("Notifications enabled");
    else if (result === "denied") toast("Notifications blocked. Enable them from your browser settings.");
    patch({ permissionDismissed: true });
  };

  const disabled = !settings.masterEnabled;

  const permissionLabel =
    permission === "granted"
      ? "Allowed"
      : permission === "denied"
        ? "Blocked"
        : permission === "default"
          ? "Not requested"
          : "Not supported";

  return (
    <section className="rounded-[14px] border border-border/60 bg-card p-4 space-y-3 shadow-sm transition-all hover:border-border">
      <SectionHeader
        title="Notifications"
        subtitle="Offline reminders powered by your browser."
      />

      <label className="flex items-center justify-between h-12 px-3 rounded-[12px] border border-primary/30 bg-primary/5">
        <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold text-foreground">
          <Bell className="size-4 text-primary" />
          Enable notifications
        </span>
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={settings.masterEnabled}
          onChange={(e) => void onMasterToggle(e.target.checked)}
        />
      </label>

      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Browser permission
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold ${
              permission === "granted"
                ? "text-emerald-600 dark:text-emerald-400"
                : permission === "denied"
                  ? "text-red-500"
                  : "text-muted-foreground"
            }`}
          >
            {permissionLabel}
          </span>
          {permission === "default" && settings.masterEnabled && (
            <button
              type="button"
              onClick={() => void onRequestPermission()}
              className="h-7 px-2.5 rounded-md border border-primary/40 bg-primary/10 text-[11px] font-semibold text-primary"
            >
              Allow
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <ToggleRow
          label="Routine reminders"
          checked={settings.routineEnabled}
          disabled={disabled}
          onChange={(v) => patch({ routineEnabled: v })}
        />
        <ToggleRow
          label="Mission reminders"
          checked={settings.missionEnabled}
          disabled={disabled}
          onChange={(v) => patch({ missionEnabled: v })}
        />
        <ToggleRow
          label="Event reminders"
          checked={settings.eventEnabled}
          disabled={disabled}
          onChange={(v) => patch({ eventEnabled: v })}
        />
        <ToggleRow
          label="Expense reminder"
          checked={settings.expenseEnabled}
          disabled={disabled}
          onChange={(v) => patch({ expenseEnabled: v })}
        />
        <ToggleRow
          label="Daily summary"
          checked={settings.summaryEnabled}
          disabled={disabled}
          onChange={(v) => patch({ summaryEnabled: v })}
        />
        <ToggleRow
          label="Streak reminder"
          checked={settings.streakEnabled}
          disabled={disabled}
          onChange={(v) => patch({ streakEnabled: v })}
        />
      </div>

      <div className="pt-3 mt-1 border-t border-border/50 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Times
        </p>
        <TimeRow
          label="Morning reminder"
          value={settings.morningReminderTime}
          disabled={disabled}
          onChange={(v) => patch({ morningReminderTime: v })}
        />
        <TimeRow
          label="Night reminder"
          value={settings.nightReminderTime}
          disabled={disabled}
          onChange={(v) => patch({ nightReminderTime: v })}
        />
        <TimeRow
          label="Expense reminder time"
          value={settings.expenseReminderTime}
          disabled={disabled}
          onChange={(v) => patch({ expenseReminderTime: v })}
        />
        <TimeRow
          label="Daily summary time"
          value={settings.dailySummaryTime}
          disabled={disabled}
          onChange={(v) => patch({ dailySummaryTime: v })}
        />

        <label
          className={`flex items-center justify-between h-11 px-3 rounded-[10px] border border-border/60 bg-background/40 ${
            disabled ? "opacity-50" : ""
          }`}
        >
          <span className="text-[13px] font-semibold text-foreground">Event lead time</span>
          <select
            className="bg-transparent text-[13px] font-semibold text-primary outline-none"
            value={settings.eventLeadMinutes}
            disabled={disabled}
            onChange={(e) => patch({ eventLeadMinutes: Number(e.target.value) || 0 })}
          >
            {LEAD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground pt-2">
        Reminders work offline while DailyOS is open in a tab or installed as an app.
        Delivery when the app is fully closed depends on your device — iOS in particular
        may not fire reminders when the app isn't running.
      </p>
    </section>
  );
}

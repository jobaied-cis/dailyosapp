import { toast } from "sonner";
import { getPermissionState } from "./permission";

/**
 * Deliver a single notification. If browser permission is granted we
 * show an OS-level Notification (which also appears when the tab is
 * hidden or the window is minimized). Otherwise we fall back to an
 * in-app sonner toast so the user still sees the reminder.
 *
 * Dedup is the caller's responsibility — this module never checks
 * the delivery log.
 */

export interface NotifyInput {
  title: string;
  body?: string;
  /** Stable tag so repeat OS notifications collapse. */
  tag?: string;
  /** Deep-link opened on click. */
  url?: string;
}

export function notify(input: NotifyInput): void {
  if (typeof window === "undefined") return;

  const permission = getPermissionState();
  if (permission === "granted" && typeof Notification !== "undefined") {
    try {
      const n = new Notification(input.title, {
        body: input.body,
        tag: input.tag,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
      });
      n.onclick = () => {
        try {
          window.focus();
          if (input.url) window.location.assign(input.url);
        } catch {
          /* noop */
        }
        n.close();
      };
      return;
    } catch {
      /* fall through to toast */
    }
  }

  toast(input.title, { description: input.body });
}

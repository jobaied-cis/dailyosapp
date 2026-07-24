/**
 * Thin wrapper around the browser Notification permission model.
 * We never call requestPermission() automatically — always in response
 * to an explicit user gesture.
 */

export type PermissionState = "unsupported" | "default" | "granted" | "denied";

export function getPermissionState(): PermissionState {
  if (typeof window === "undefined") return "unsupported";
  if (typeof Notification === "undefined") return "unsupported";
  const p = Notification.permission;
  if (p === "granted" || p === "denied" || p === "default") return p;
  return "unsupported";
}

export async function requestPermission(): Promise<PermissionState> {
  if (getPermissionState() === "unsupported") return "unsupported";
  try {
    const result = await Notification.requestPermission();
    if (result === "granted" || result === "denied" || result === "default") return result;
    return "default";
  } catch {
    return "default";
  }
}

export function isBrowserNotificationSupported(): boolean {
  return getPermissionState() !== "unsupported";
}

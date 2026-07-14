// Browser notification helper (in-tab; no service worker / web-push).

export async function ensureNotificationPermission(
  opts: { requireUserGesture?: boolean } = {},
): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  // Safari (esp. iOS) throws "Notification prompting can only be done from a
  // user gesture" when requestPermission runs on page load. Skip the prompt
  // unless we're inside a user-initiated event.
  if (opts.requireUserGesture !== true) return false;
  try {
    const p = await Notification.requestPermission();
    return p === "granted";
  } catch {
    return false;
  }
}

export function showBrowserNotification(title: string, body?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", badge: "/favicon.ico" });
  } catch {
    // ignore
  }
}

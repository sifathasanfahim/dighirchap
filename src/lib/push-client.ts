import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";

const SW_URL = "/push-sw.js";
const SW_SCOPE = "/";

function isPreviewOrDev(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  return false;
}

export function pushSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;
  return true;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported() || isPreviewOrDev()) return null;
  try {
    let reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (!reg || !reg.active || (reg.active.scriptURL && !reg.active.scriptURL.endsWith(SW_URL))) {
      reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    }
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn("[push] SW register failed", e);
    return null;
  }
}

/** Subscribe current signed-in user to push. Safe to call repeatedly. */
export async function enablePushForCurrentUser(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (isPreviewOrDev()) return { ok: false, reason: "preview" };

  if (Notification.permission === "default") {
    try {
      const p = await Notification.requestPermission();
      if (p !== "granted") return { ok: false, reason: "denied" };
    } catch {
      return { ok: false, reason: "denied" };
    }
  }
  if (Notification.permission !== "granted") return { ok: false, reason: "denied" };

  const reg = await getRegistration();
  if (!reg) return { ok: false, reason: "no-registration" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (e) {
      console.warn("[push] subscribe failed", e);
      return { ok: false, reason: "subscribe-failed" };
    }
  }

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false, reason: "no-user" };

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "bad-subscription" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: u.user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 250),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.warn("[push] save subscription failed", error);
    return { ok: false, reason: "save-failed" };
  }
  return { ok: true };
}

export async function disablePushForCurrentUser(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) {
    console.warn("[push] disable failed", e);
  }
}

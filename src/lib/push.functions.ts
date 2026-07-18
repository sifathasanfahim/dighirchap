import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  image?: string;
  tag?: string;
  type?: "order" | "promo" | "system";
};

export type SendPushInput = {
  payload: PushPayload;
  target: "all" | "user" | "admins";
  userId?: string | null;
};

export const sendPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SendPushInput) => {
    if (!data?.payload?.title) throw new Error("title required");
    if (!["all", "user", "admins"].includes(data.target)) throw new Error("bad target");
    return data;
  })
  .handler(async ({ data, context }) => {
    // Authorize: only staff/owner may send.
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isOwner && !isStaff) throw new Error("Forbidden");

    // Use the RLS-scoped client (staff/owner have SELECT/DELETE via policies).
    const db = context.supabase;

    // Resolve target user IDs.
    let userIds: string[] | null = null;
    if (data.target === "user") {
      if (!data.userId) throw new Error("userId required");
      userIds = [data.userId];
    } else if (data.target === "admins") {
      const { data: rows } = await db
        .from("user_roles")
        .select("user_id")
        .in("role", ["owner", "manager", "cashier"]);
      userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    }

    let query = db
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth,id");
    if (userIds) query = query.in("user_id", userIds);
    const { data: subs, error: subsErr } = await query;
    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    const payloadStr = JSON.stringify(data.payload);
    let sent = 0;
    let failed = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payloadStr,
            { TTL: 60 },
          );
          sent++;
        } catch (e: any) {
          failed++;
          const code = e?.statusCode;
          if (code === 404 || code === 410) stale.push(s.id);
        }
      }),
    );

    if (stale.length) {
      await db.from("push_subscriptions").delete().in("id", stale);
    }
    return { sent, failed };
  });

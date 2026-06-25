import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RIDER_EMAIL_DOMAIN = "rider.local";

const createSchema = z.object({
  rider_id: z.string().min(2).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, . _ -"),
  password: z.string().min(6),
  full_name: z.string().min(1),
  phone: z.string().optional().default(""),
  vehicle: z.string().optional().default(""),
});

export const createRiderAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Only owner/manager can create riders
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => r.role);
    if (!roles.includes("owner") && !roles.includes("manager")) {
      throw new Error("Only owner/manager can create riders");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `${data.rider_id.toLowerCase()}@${RIDER_EMAIL_DOMAIN}`;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone, rider_id: data.rider_id },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Failed to create user");
    const userId = created.user.id;

    // Profile + role + rider row (handle_new_user trigger may have created profile/role already)
    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.full_name, phone: data.phone });
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "rider" }, { onConflict: "user_id,role" });
    const { error: rErr } = await supabaseAdmin.from("riders").insert({ profile_id: userId, vehicle: data.vehicle, active: true });
    if (rErr && !rErr.message.includes("duplicate")) throw new Error(rErr.message);

    return { ok: true, rider_id: data.rider_id, email };
  });

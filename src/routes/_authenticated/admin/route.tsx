import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    if (!context.userId) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role);
    const allowed = roles.some((r) => ["owner", "manager", "cashier", "marketing", "rider_manager"].includes(r));
    if (!allowed) throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "cashier" | "marketing" | "rider_manager" | "rider" | "customer";

export interface AuthState {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, roles: [], loading: true });

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (userId: string) => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      return (data?.map((r) => r.role) ?? []) as AppRole[];
    };

    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user ?? null;
      const roles = user ? await loadRoles(user.id) : [];
      if (mounted) setState({ user, roles, loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const user = session?.user ?? null;
      // defer to avoid deadlock per supabase guidance
      setTimeout(async () => {
        const roles = user ? await loadRoles(user.id) : [];
        if (mounted) setState({ user, roles, loading: false });
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export const hasRole = (roles: AppRole[], r: AppRole) => roles.includes(r);
export const isStaff = (roles: AppRole[]) =>
  roles.some((r) => ["owner", "manager", "cashier", "marketing", "rider_manager"].includes(r));

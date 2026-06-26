import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    return { userId: data.user?.id ?? "" };
  },
  component: AuthenticatedGate,
});

function AuthenticatedGate() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!userId) {
      const id = window.setTimeout(() => {
        navigate({ to: "/auth", search: { redirect: location.href }, replace: true });
      }, 100);
      return () => window.clearTimeout(id);
    }
  }, [location.href, navigate, userId]);

  if (!userId) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <Outlet />;
}

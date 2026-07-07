import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

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

  if (!userId) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            D
          </div>
          <h1 className="mt-4 text-xl font-bold">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please sign in to open this section.</p>
          <Link
            to="/auth"
            className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

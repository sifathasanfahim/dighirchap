import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/rider")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id);
      const list = (roles ?? []).map((r) => r.role);
      if (list.includes("rider")) throw redirect({ to: "/rider" });
      if (list.some((r) => ["owner", "manager", "cashier", "marketing", "rider_manager"].includes(r))) {
        throw redirect({ to: "/admin" });
      }
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [{ title: "Rider Login — Dighir Chap" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: RiderLoginPage,
});

function RiderLoginPage() {
  const navigate = useNavigate();
  const [riderId, setRiderId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const id = riderId.trim();
      // Match auth.tsx phone-mapping so rider IDs sign in the same way
      const loginEmail = id.includes("@") ? id : `${id.replace(/\D/g, "") || id}@phone.local`;
      const { data: signed, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (error) throw error;
      const uid = signed.user?.id;
      if (uid) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
        const list = (roles ?? []).map((r) => r.role);
        if (!list.includes("rider")) {
          await supabase.auth.signOut();
          throw new Error("This account is not a rider. Ask admin to enable rider access.");
        }
      }
      toast.success("Welcome back!");
      navigate({ to: "/rider-portal" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-orange-50 via-background to-accent px-4">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold">Rider Portal</div>
            <div className="text-xs text-muted-foreground">Dighir Chap</div>
          </div>
        </div>
        <h1 className="text-xl font-bold">Sign in to deliver</h1>
        <p className="text-sm text-muted-foreground">Use the login ID your admin gave you.</p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <Label htmlFor="rid">Rider ID</Label>
            <Input
              id="rid"
              value={riderId}
              onChange={(e) => setRiderId(e.target.value)}
              placeholder="e.g. rider01"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          Not a rider?{" "}
          <Link to="/auth" className="font-medium text-primary hover:underline">
            Customer / staff login
          </Link>
        </div>
      </div>
    </div>
  );
}

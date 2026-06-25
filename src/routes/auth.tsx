import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: (search.redirect as never) ?? "/" });
  },
  head: () => ({ meta: [{ title: "Sign in — Dighir Chap" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset link sent. Check your email.");
        setMode("signin");
        return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name, phone },
          },
        });
        if (error) throw error;
        toast.success("Account created!");
      } else {
        const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        toast.success("Welcome back!");
        // Route riders to their portal automatically
        const uid = signed.user?.id;
        if (uid) {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
          const list = (roles ?? []).map((r) => r.role);
          if (list.includes("rider")) {
            navigate({ to: "/rider" });
            return;
          }
          if (list.includes("owner") || list.includes("manager") || list.includes("cashier") || list.includes("marketing") || list.includes("rider_manager")) {
            navigate({ to: "/admin" });
            return;
          }
        }
      }
      navigate({ to: (redirectTo as never) ?? "/" });

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-orange-50 via-background to-accent px-4">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-xl">
        <Link to="/" className="mb-4 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">D</div>
          <span className="font-bold">Dighir Chap</span>
        </Link>
        <h1 className="text-xl font-bold">
          {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "forgot" ? "We'll email you a link to set a new password." : "Order delicious chap & biryani in minutes."}
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <>
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="phone">Mobile</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" required />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="email">{mode === "signin" ? "Email or rider ID" : "Email"}</Label>
            <Input id="email" type={mode === "signup" || mode === "forgot" ? "email" : "text"} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {mode !== "forgot" && (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>
        </form>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin"
            ? "New here? Create an account"
            : mode === "signup"
              ? "Already have an account? Sign in"
              : "Back to sign in"}
        </button>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Coins, LogOut, Award } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Account — Dighir Chap" }] }),
  component: ProfilePage,
});

const tierStyles: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-200 text-slate-800",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-violet-100 text-violet-800",
};

function ProfilePage() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const roles = useQuery({
    queryKey: ["my-roles", userId],
    queryFn: async () => (await supabase.from("user_roles").select("role").eq("user_id", userId)).data ?? [],
  });

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
      setAddress(profile.data.address ?? "");
    }
  }, [profile.data]);

  const save = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: name, phone, address }).eq("id", userId);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const staff = roles.data?.some((r) => ["owner", "manager", "cashier", "marketing", "rider_manager"].includes(r.role));
  const rider = roles.data?.some((r) => r.role === "rider");
  const owner = roles.data?.some((r) => r.role === "owner");

  return (
    <CustomerShell>
      <h1 className="mb-4 text-2xl font-bold">My Account</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Coins className="h-4 w-4" /> Coins</div>
          <div className="mt-1 text-3xl font-bold text-primary">{profile.data?.coins ?? 0}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Award className="h-4 w-4" /> Tier</div>
          <span className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold capitalize ${tierStyles[profile.data?.tier ?? "bronze"]}`}>
            {profile.data?.tier ?? "bronze"}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Profile</h2>
        <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><Label>Default address</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} /></div>
        <Button onClick={save}>Save</Button>
      </div>

      {(staff || rider || owner) && (
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-semibold">Switch portal</h2>
          <div className="flex flex-wrap gap-2">
            {staff && <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>Admin</Button>}
            {owner && <Button variant="outline" onClick={() => navigate({ to: "/owner" })}>Owner</Button>}
            {rider && <Button variant="outline" onClick={() => navigate({ to: "/rider" })}>Rider</Button>}
          </div>
        </div>
      )}

      <Button variant="outline" className="mt-4 w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </CustomerShell>
  );
}

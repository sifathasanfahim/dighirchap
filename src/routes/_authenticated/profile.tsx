import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Coins, LogOut, Award, ChevronRight } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TierExplorer, useTiers } from "@/components/tier-explorer";
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

  const tiers = useTiers();
  const rules = useQuery({
    queryKey: ["loyalty-rules-public"],
    queryFn: async () => (await supabase.from("loyalty_rules").select("redeem_rate").eq("id", 1).maybeSingle()).data,
  });
  const redeemRate = Number(rules.data?.redeem_rate ?? 1);
  const coins = profile.data?.coins ?? 0;
  const tierName = (profile.data?.tier ?? "bronze") as string;
  const activeTier = tiers.data?.find((t) => t.name.toLowerCase() === tierName.toLowerCase());

  return (
    <CustomerShell>
      <h1 className="mb-4 text-2xl font-bold">My Account</h1>

      <div className="grid grid-cols-2 gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 cursor-help transition-transform hover:scale-[1.02]">
                <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/10 blur-xl transition-all group-hover:bg-primary/20" />
                <div className="relative flex items-center gap-2 text-sm text-muted-foreground">
                  <Coins className="h-4 w-4 animate-pulse text-primary" /> Coins
                </div>
                <div className="relative mt-1 text-3xl font-bold text-primary">{coins}</div>
                <div className="relative mt-0.5 text-[11px] text-muted-foreground">
                  ≈ ৳{(coins * redeemRate).toFixed(0)} value
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">1 coin = ৳{redeemRate} at checkout</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TierExplorer
          currentTier={tierName}
          lifetimeSpend={Number(profile.data?.lifetime_spend ?? 0)}
          trigger={
            <button
              type="button"
              className="group relative overflow-hidden rounded-2xl border bg-card p-4 text-left transition-transform hover:scale-[1.02]"
              style={activeTier ? { background: `linear-gradient(135deg, ${activeTier.color}22, transparent 70%)` } : undefined}
            >
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><Award className="h-4 w-4" /> Tier</span>
                <ChevronRight className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-0.5" />
              </div>
              <span
                className="mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold capitalize text-white shadow-sm"
                style={{ backgroundColor: activeTier?.color ?? "#a78bfa" }}
              >
                {tierName}
              </span>
              <div className="mt-1 text-[11px] text-muted-foreground">Tap to see all tiers</div>
            </button>
          }
        />
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

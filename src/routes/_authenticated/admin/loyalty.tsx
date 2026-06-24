import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/loyalty")({
  component: AdminLoyalty,
});

function AdminLoyalty() {
  const [coins, setCoins] = useState("5");
  const [redeem, setRedeem] = useState("1");
  const [silver, setSilver] = useState("5000");
  const [gold, setGold] = useState("20000");
  const [platinum, setPlatinum] = useState("50000");

  const rules = useQuery({
    queryKey: ["loyalty-rules"],
    queryFn: async () => (await supabase.from("loyalty_rules").select("*").eq("id", 1).maybeSingle()).data,
  });

  useEffect(() => {
    if (rules.data) {
      setCoins(String(rules.data.coins_per_100));
      setRedeem(String(rules.data.redeem_rate));
      setSilver(String(rules.data.silver_threshold));
      setGold(String(rules.data.gold_threshold));
      setPlatinum(String(rules.data.platinum_threshold));
    }
  }, [rules.data]);

  const save = async () => {
    const { error } = await supabase.from("loyalty_rules").update({
      coins_per_100: Number(coins),
      redeem_rate: Number(redeem),
      silver_threshold: Number(silver),
      gold_threshold: Number(gold),
      platinum_threshold: Number(platinum),
    }).eq("id", 1);
    if (error) toast.error(error.message);
    else toast.success("Saved (owner only)");
  };

  return (
    <StaffShell title="Loyalty Rules">
      <div className="max-w-lg rounded-2xl border bg-card p-5 space-y-3">
        <div><Label>Coins per ৳100 spent</Label><Input type="number" value={coins} onChange={(e) => setCoins(e.target.value)} /></div>
        <div><Label>Redeem rate (1 coin = ৳ value)</Label><Input type="number" value={redeem} onChange={(e) => setRedeem(e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Silver ৳</Label><Input type="number" value={silver} onChange={(e) => setSilver(e.target.value)} /></div>
          <div><Label>Gold ৳</Label><Input type="number" value={gold} onChange={(e) => setGold(e.target.value)} /></div>
          <div><Label>Platinum ৳</Label><Input type="number" value={platinum} onChange={(e) => setPlatinum(e.target.value)} /></div>
        </div>
        <Button onClick={save}>Save rules</Button>
        <p className="text-xs text-muted-foreground">Note: only the Owner role can update loyalty rules (enforced by RLS).</p>
      </div>
    </StaffShell>
  );
}

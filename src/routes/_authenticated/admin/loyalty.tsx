import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Tier } from "@/components/tier-explorer";

export const Route = createFileRoute("/_authenticated/admin/loyalty")({
  component: AdminLoyalty,
});

const ICONS = ["medal", "award", "trophy", "crown", "sparkles", "star", "gem"];

function AdminLoyalty() {
  const qc = useQueryClient();
  const [coins, setCoins] = useState("5");
  const [redeem, setRedeem] = useState("1");
  const [silver, setSilver] = useState("5000");
  const [gold, setGold] = useState("20000");
  const [platinum, setPlatinum] = useState("50000");

  const rules = useQuery({
    queryKey: ["loyalty-rules"],
    queryFn: async () => (await supabase.from("loyalty_rules").select("*").eq("id", 1).maybeSingle()).data,
  });

  const tiers = useQuery({
    queryKey: ["loyalty-tiers-admin"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("loyalty_tiers").select("*").order("sort_order", { ascending: true });
      return (data ?? []) as Tier[];
    },
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

  const addTier = async () => {
    const next = (tiers.data?.length ?? 0) + 1;
    const { error } = await (supabase as any).from("loyalty_tiers").insert({
      name: `Tier ${next}`,
      min_spend: 0,
      discount_pct: 0,
      color: "#a78bfa",
      icon: "sparkles",
      perks: [],
      sort_order: next,
      active: true,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["loyalty-tiers-admin"] });
    qc.invalidateQueries({ queryKey: ["loyalty-tiers"] });
  };

  const updateTier = async (id: string, patch: Partial<Tier>) => {
    const { error } = await (supabase as any).from("loyalty_tiers").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["loyalty-tiers-admin"] });
    qc.invalidateQueries({ queryKey: ["loyalty-tiers"] });
  };

  const deleteTier = async (id: string) => {
    if (!confirm("Delete this tier?")) return;
    const { error } = await (supabase as any).from("loyalty_tiers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["loyalty-tiers-admin"] });
    qc.invalidateQueries({ queryKey: ["loyalty-tiers"] });
  };

  return (
    <StaffShell title="Loyalty Rules">
      <div className="max-w-lg rounded-2xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Coins & Thresholds</h2>
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

      <div className="mt-6 max-w-3xl rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Tier Designer</h2>
            <p className="text-xs text-muted-foreground">Customer-facing tiers shown in their account. Add as many as you like.</p>
          </div>
          <Button size="sm" onClick={addTier}><Plus className="mr-1 h-4 w-4" /> New tier</Button>
        </div>
        <div className="space-y-3">
          {tiers.data?.map((t) => (
            <TierRow key={t.id} tier={t} onSave={(p) => updateTier(t.id, p)} onDelete={() => deleteTier(t.id)} />
          ))}
          {tiers.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No tiers yet — click "New tier".</p>
          )}
        </div>
      </div>
    </StaffShell>
  );
}

function TierRow({ tier, onSave, onDelete }: { tier: Tier; onSave: (p: Partial<Tier>) => void; onDelete: () => void }) {
  const [name, setName] = useState(tier.name);
  const [minSpend, setMinSpend] = useState(String(tier.min_spend));
  const [discount, setDiscount] = useState(String(tier.discount_pct));
  const [color, setColor] = useState(tier.color);
  const [icon, setIcon] = useState(tier.icon);
  const [perks, setPerks] = useState((tier.perks ?? []).join("\n"));
  const [order, setOrder] = useState(String(tier.sort_order));
  const [active, setActive] = useState(tier.active);

  return (
    <div className="rounded-xl border p-3" style={{ background: `linear-gradient(135deg, ${color}10, transparent 60%)` }}>
      <div className="grid gap-3 md:grid-cols-[1fr,1fr,1fr,auto,auto]">
        <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label className="text-xs">Min lifetime ৳</Label><Input type="number" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} /></div>
        <div><Label className="text-xs">Discount %</Label><Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
        <div><Label className="text-xs">Order</Label><Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="w-16" /></div>
        <div className="flex flex-col items-center gap-1"><Label className="text-xs">Active</Label><Switch checked={active} onCheckedChange={setActive} /></div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[120px,1fr,1fr]">
        <div>
          <Label className="text-xs">Color</Label>
          <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
        </div>
        <div>
          <Label className="text-xs">Icon</Label>
          <select value={icon} onChange={(e) => setIcon(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
            {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Perks (one per line)</Label>
          <textarea
            value={perks}
            onChange={(e) => setPerks(e.target.value)}
            rows={2}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        <Button size="sm" onClick={() => onSave({
          name, min_spend: Number(minSpend), discount_pct: Number(discount),
          color, icon, perks: perks.split("\n").map((p) => p.trim()).filter(Boolean),
          sort_order: Number(order), active,
        })}><Save className="mr-1 h-4 w-4" /> Save</Button>
      </div>
    </div>
  );
}

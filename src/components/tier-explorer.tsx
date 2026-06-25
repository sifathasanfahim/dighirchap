import { useQuery } from "@tanstack/react-query";
import { Medal, Award, Trophy, Crown, Sparkles, Star, Gem, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const iconMap: Record<string, typeof Medal> = {
  medal: Medal, award: Award, trophy: Trophy, crown: Crown,
  sparkles: Sparkles, star: Star, gem: Gem,
};

export type Tier = {
  id: string;
  name: string;
  min_spend: number;
  discount_pct: number;
  color: string;
  icon: string;
  perks: string[];
  sort_order: number;
  active: boolean;
};

export function useTiers() {
  return useQuery({
    queryKey: ["loyalty-tiers"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("loyalty_tiers")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      return (data ?? []) as Tier[];
    },
  });
}

export function TierExplorer({
  trigger,
  currentTier,
  lifetimeSpend = 0,
}: {
  trigger: ReactNode;
  currentTier?: string | null;
  lifetimeSpend?: number;
}) {
  const tiers = useTiers();
  const list = tiers.data ?? [];
  const currentIdx = list.findIndex(
    (t) => t.name.toLowerCase() === (currentTier ?? "").toLowerCase(),
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            Loyalty Tiers
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {list.map((t, i) => {
            const Icon = iconMap[t.icon] ?? Sparkles;
            const isCurrent = i === currentIdx;
            const isUnlocked = lifetimeSpend >= Number(t.min_spend);
            const next = list[i + 1];
            const toNext = next ? Math.max(0, Number(next.min_spend) - lifetimeSpend) : 0;
            const pct = next
              ? Math.min(100, ((lifetimeSpend - Number(t.min_spend)) / (Number(next.min_spend) - Number(t.min_spend))) * 100)
              : 100;
            return (
              <div
                key={t.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-4 transition-all animate-fade-in",
                  isCurrent ? "ring-2 ring-primary shadow-lg scale-[1.02]" : "hover:scale-[1.01]",
                  !isUnlocked && "opacity-70",
                )}
                style={{
                  background: `linear-gradient(135deg, ${t.color}18, transparent 70%)`,
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-md"
                    style={{ backgroundColor: t.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{t.name}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Number(t.min_spend) === 0 ? "Starter tier" : `Unlocks at ${fmtBDT(Number(t.min_spend))} lifetime`}
                    </p>
                    {Number(t.discount_pct) > 0 && (
                      <p className="mt-1 text-sm font-semibold" style={{ color: t.color }}>
                        {t.discount_pct}% off every order
                      </p>
                    )}
                    {t.perks?.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {t.perks.map((p, j) => (
                          <li key={j} className="flex gap-1.5">
                            <Star className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> {p}
                          </li>
                        ))}
                      </ul>
                    )}
                    {isCurrent && next && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Spend {fmtBDT(toNext)} more to reach {next.name}</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: next.color }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">No tiers configured yet.</p>
          )}
        </div>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" /> Earn coins on every order — spend them at checkout.
        </p>
      </DialogContent>
    </Dialog>
  );
}

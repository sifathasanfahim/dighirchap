import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/owner/")({
  head: () => ({
    meta: [
      { title: "Owner Analytics — Dighir Chap" },
      { name: "description", content: "Owner analytics dashboard." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    if (!context.userId) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "owner");
    if (!data?.length) throw redirect({ to: "/" });
  },
  component: OwnerDashboard,
});

type Preset = "today" | "7d" | "30d" | "90d" | "custom";

function rangeFor(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  if (preset === "today") return { from: start, to: end };
  if (preset === "7d") { const s = new Date(start); s.setDate(s.getDate() - 6); return { from: s, to: end }; }
  if (preset === "30d") { const s = new Date(start); s.setDate(s.getDate() - 29); return { from: s, to: end }; }
  if (preset === "90d") { const s = new Date(start); s.setDate(s.getDate() - 89); return { from: s, to: end }; }
  const s = customFrom ? new Date(customFrom + "T00:00:00") : start;
  const e = customTo ? new Date(customTo + "T23:59:59") : end;
  return { from: s, to: e };
}

function OwnerDashboard() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);
  const fromISO = range.from.toISOString();
  const toISO = range.to.toISOString();

  const analytics = useQuery({
    queryKey: ["owner-analytics", fromISO, toISO],
    queryFn: async () => {
      const [orders, customers, riders, items] = await Promise.all([
        supabase.from("orders").select("id, total, status, created_at, customer_id").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("profiles").select("id, created_at"),
        supabase.from("riders").select("id, active"),
        supabase.from("order_items").select("name, qty, order_id, created_at").gte("created_at", fromISO).lte("created_at", toISO),
      ]);
      const orderRows = orders.data ?? [];
      const revenue = orderRows.filter((o) => o.status === "delivered").reduce((a, o) => a + Number(o.total), 0);
      const completed = orderRows.filter((o) => o.status === "delivered").length;
      const cancelled = orderRows.filter((o) => o.status === "cancelled").length;
      const avgOrder = completed ? revenue / completed : 0;

      const itemMap = new Map<string, number>();
      (items.data ?? []).forEach((i) => itemMap.set(i.name, (itemMap.get(i.name) ?? 0) + i.qty));
      const top = [...itemMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

      const byDay = new Map<string, number>();
      orderRows.forEach((o) => {
        const d = new Date(o.created_at).toLocaleDateString("en-CA");
        byDay.set(d, (byDay.get(d) ?? 0) + Number(o.total));
      });
      const dailySales = [...byDay.entries()].sort();

      return {
        revenue, completed, cancelled, avgOrder,
        customers: customers.data?.length ?? 0,
        activeRiders: (riders.data ?? []).filter((r) => r.active).length,
        top, dailySales,
      };
    },
  });

  const a = analytics.data;
  const maxSale = Math.max(1, ...(a?.dailySales ?? []).map(([, v]) => v));

  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <StaffShell title="Owner Analytics" variant="owner">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        {presets.map((p) => (
          <Button key={p.key} size="sm" variant={preset === p.key ? "default" : "outline"} onClick={() => setPreset(p.key)}>
            {p.label}
          </Button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto" />
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {range.from.toLocaleDateString()} — {range.to.toLocaleDateString()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Revenue" value={fmtBDT(a?.revenue ?? 0)} />
        <Stat label="Completed orders" value={a?.completed ?? 0} />
        <Stat label="Avg order value" value={fmtBDT(a?.avgOrder ?? 0)} />
        <Stat label="Cancellation rate" value={`${a && (a.completed + a.cancelled) ? Math.round((a.cancelled / (a.completed + a.cancelled)) * 100) : 0}%`} />
        <Stat label="Customers" value={a?.customers ?? 0} />
        <Stat label="Active riders" value={a?.activeRiders ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Daily sales</h2>
          <div className="flex h-48 items-end gap-1">
            {a?.dailySales.map(([day, val]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-primary" style={{ height: `${(val / maxSale) * 100}%` }} title={`${day}: ${fmtBDT(val)}`} />
                <span className="text-[9px] text-muted-foreground">{day.slice(5)}</span>
              </div>
            ))}
            {a?.dailySales.length === 0 && <div className="text-sm text-muted-foreground">No sales in range.</div>}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Top items</h2>
          <div className="space-y-2">
            {a?.top.map(([name, qty]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-sm">{name}</span>
                <span className="font-semibold text-primary">{qty}</span>
              </div>
            ))}
            {a?.top.length === 0 && <div className="text-sm text-muted-foreground">No sales yet.</div>}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

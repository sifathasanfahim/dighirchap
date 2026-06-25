import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, DollarSign, Users, Bike, TrendingUp, Radio } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

type Preset = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

function rangeFor(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  if (preset === "today") return { from: start, to: end };
  if (preset === "yesterday") {
    const s = new Date(start); s.setDate(s.getDate() - 1);
    const e = new Date(end); e.setDate(e.getDate() - 1);
    return { from: s, to: e };
  }
  if (preset === "7d") { const s = new Date(start); s.setDate(s.getDate() - 6); return { from: s, to: end }; }
  if (preset === "30d") { const s = new Date(start); s.setDate(s.getDate() - 29); return { from: s, to: end }; }
  if (preset === "90d") { const s = new Date(start); s.setDate(s.getDate() - 89); return { from: s, to: end }; }
  // custom
  const s = customFrom ? new Date(customFrom + "T00:00:00") : start;
  const e = customTo ? new Date(customTo + "T23:59:59") : end;
  return { from: s, to: e };
}

function AdminDashboard() {
  const [preset, setPreset] = useState<Preset>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);

  const stats = useQuery({
    queryKey: ["admin-stats", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const [orders, customers, riders] = await Promise.all([
        supabase
          .from("orders")
          .select("total, created_at, customer_id")
          .gte("created_at", range.from.toISOString())
          .lte("created_at", range.to.toISOString()),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("riders").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      const data = orders.data ?? [];
      const revenue = data.reduce((a, o) => a + Number(o.total), 0);
      const uniqueCustomers = new Set(data.map((o: any) => o.customer_id)).size;

      // per-day breakdown
      const byDay = new Map<string, { count: number; revenue: number }>();
      data.forEach((o: any) => {
        const d = new Date(o.created_at).toISOString().slice(0, 10);
        const cur = byDay.get(d) ?? { count: 0, revenue: 0 };
        cur.count += 1; cur.revenue += Number(o.total);
        byDay.set(d, cur);
      });
      const days = Array.from(byDay.entries())
        .sort((a, b) => b[0].localeCompare(a[0]));

      return {
        orderCount: data.length,
        revenue,
        uniqueCustomers,
        customers: customers.count ?? 0,
        riders: riders.count ?? 0,
        days,
      };
    },
  });

  const s = stats.data;
  const cards = [
    { label: "Orders", value: s?.orderCount ?? 0, icon: ShoppingBag },
    { label: "Revenue", value: fmtBDT(s?.revenue ?? 0), icon: DollarSign },
    { label: "Buying customers", value: s?.uniqueCustomers ?? 0, icon: Users },
    { label: "Active riders", value: s?.riders ?? 0, icon: Bike },
  ];

  const presets: { id: Preset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
    { id: "90d", label: "90 days" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <StaffShell title="Dashboard">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={preset === p.id ? "default" : "outline"}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto" />
            <span className="text-muted-foreground">→</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto" />
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {range.from.toLocaleDateString()} – {range.to.toLocaleDateString()}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-sm">{c.label}</span>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-2 text-3xl font-bold">{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <h2 className="font-semibold">Daily breakdown</h2>
        </div>
        {stats.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !s?.days.length ? (
          <p className="text-sm text-muted-foreground">No orders in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2">Orders</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {s.days.map(([d, v]) => (
                  <tr key={d} className="border-t">
                    <td className="py-2">{new Date(d).toLocaleDateString()}</td>
                    <td className="py-2">{v.count}</td>
                    <td className="py-2 text-right font-medium">{fmtBDT(v.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StaffShell>
  );
}

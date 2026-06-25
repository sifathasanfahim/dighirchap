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

function statusPriority(s: string) {
  const order: Record<string, number> = {
    pending: 0, confirmed: 1, preparing: 2, ready: 3,
    out_for_delivery: 4, delivered: 5, cancelled: 6,
  };
  return order[s] ?? 99;
}

function statusStyle(s: string) {
  switch (s) {
    case "pending":
      return { label: "New • Unconfirmed", row: "border-red-500 bg-red-50 dark:bg-red-950/30", badge: "bg-red-600 text-white", icon: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" };
    case "confirmed":
      return { label: "Confirmed", row: "border-green-500 bg-green-50 dark:bg-green-950/30", badge: "bg-green-600 text-white", icon: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" };
    case "preparing":
      return { label: "Preparing", row: "border-amber-500 bg-amber-50 dark:bg-amber-950/30", badge: "bg-amber-500 text-white", icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" };
    case "ready":
      return { label: "Ready", row: "border-blue-500 bg-blue-50 dark:bg-blue-950/30", badge: "bg-blue-600 text-white", icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" };
    case "out_for_delivery":
      return { label: "Out for delivery", row: "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30", badge: "bg-indigo-600 text-white", icon: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" };
    case "delivered":
      return { label: "Delivered", row: "border-muted bg-card", badge: "bg-muted text-muted-foreground", icon: "bg-muted text-muted-foreground" };
    case "cancelled":
      return { label: "Cancelled", row: "border-muted bg-muted/30 opacity-70", badge: "bg-destructive text-destructive-foreground", icon: "bg-muted text-muted-foreground" };
    default:
      return { label: s, row: "border-border", badge: "bg-muted text-foreground", icon: "bg-primary/10 text-primary" };
  }
}

function AdminDashboard() {
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Preset>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);

  const liveOrders = useQuery({
    queryKey: ["admin-live-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-dash-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-live-orders"] });
        qc.invalidateQueries({ queryKey: ["admin-stats"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);


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
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 animate-pulse text-green-500" />
            <h2 className="font-semibold">Live orders</h2>
            <span className="text-xs text-muted-foreground">(auto-updates)</span>
          </div>
          <Link to="/admin/orders" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        {liveOrders.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !liveOrders.data?.length ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="space-y-2">
            {[...liveOrders.data]
              .sort((a: any, b: any) => statusPriority(a.status) - statusPriority(b.status))
              .map((o: any) => {
              const st = statusStyle(o.status);
              return (
              <Link
                key={o.id}
                to="/admin/orders"
                className={`flex items-center justify-between rounded-xl border-2 p-3 transition hover:bg-muted/50 ${st.row}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${st.icon}`}>
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">#{o.order_number}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${st.badge}`}>
                        {st.label}
                      </span>
                      {o.status === "pending" && (
                        <span className="h-2 w-2 animate-ping rounded-full bg-red-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="font-semibold">{fmtBDT(Number(o.total) || 0)}</div>
              </Link>
              );
            })}
          </div>
        )}
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

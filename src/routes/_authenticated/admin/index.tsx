import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, DollarSign, Users, Bike, TrendingUp, Radio, Check, ChevronRight, X, Loader2 } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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

const STATUS_FLOW = ["pending", "confirmed", "preparing", "ready", "picked_up", "delivered"] as const;

function statusPriority(s: string) {
  const order: Record<string, number> = {
    pending: 0, confirmed: 1, preparing: 2, ready: 3,
    out_for_delivery: 4, delivered: 5, cancelled: 6,
  };
  return order[s] ?? 99;
}

function statusMeta(s: string) {
  switch (s) {
    case "pending":
      return { label: "New", tone: "text-rose-600", dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900" };
    case "confirmed":
      return { label: "Confirmed", tone: "text-emerald-600", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900" };
    case "preparing":
      return { label: "Preparing", tone: "text-amber-600", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900" };
    case "ready":
      return { label: "Ready", tone: "text-sky-600", dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900" };
    case "out_for_delivery":
      return { label: "On the way", tone: "text-indigo-600", dot: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900" };
    case "delivered":
      return { label: "Delivered", tone: "text-muted-foreground", dot: "bg-muted-foreground/60", chip: "bg-muted text-muted-foreground ring-border" };
    case "cancelled":
      return { label: "Cancelled", tone: "text-muted-foreground", dot: "bg-muted-foreground/40", chip: "bg-muted text-muted-foreground ring-border line-through" };
    default:
      return { label: s, tone: "text-muted-foreground", dot: "bg-muted-foreground/40", chip: "bg-muted text-muted-foreground ring-border" };
  }
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Order moved to ${statusMeta(v.status).label}`);
      qc.invalidateQueries({ queryKey: ["admin-live-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });



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

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight">Live orders</h2>
            {liveOrders.data?.length ? (
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                {liveOrders.data.length}
              </span>
            ) : null}
            {(() => {
              const pending = liveOrders.data?.filter((o: any) => o.status === "pending").length ?? 0;
              return pending ? (
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-500/30">
                  {pending} new
                </span>
              ) : null;
            })()}
          </div>
          <Link to="/admin/orders" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        {liveOrders.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : !liveOrders.data?.length ? (
          <div className="grid place-items-center gap-1 py-12 text-center">
            <Radio className="h-5 w-5 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Waiting for the first order…</p>
          </div>
        ) : (
          <ul className="divide-y">
            {[...liveOrders.data]
              .sort((a: any, b: any) => statusPriority(a.status) - statusPriority(b.status))
              .map((o: any) => {
                const meta = statusMeta(o.status);
                const stepIdx = STATUS_FLOW.indexOf(o.status as any);
                const isPending = o.status === "pending";
                return (
                  <li key={o.id}>
                    <Link
                      to="/admin/orders"
                      className={`group flex items-center gap-4 px-5 py-3 transition hover:bg-muted/40 ${
                        isPending ? "bg-rose-50/40 dark:bg-rose-950/10" : ""
                      }`}
                    >
                      <span className={`h-8 w-1 rounded-full ${meta.dot}`} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">#{o.order_number}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset ${meta.chip}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                          <span className="text-xs text-muted-foreground">· {timeAgo(o.created_at)}</span>
                        </div>

                        {stepIdx >= 0 && o.status !== "cancelled" && (
                          <div className="mt-2 flex items-center gap-1">
                            {STATUS_FLOW.map((_, i) => (
                              <span
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-all ${
                                  i <= stepIdx ? meta.dot : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{fmtBDT(Number(o.total) || 0)}</div>
                        <div className={`text-[11px] font-medium ${meta.tone}`}>
                          {isPending ? "Tap to confirm" : "Open →"}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
          </ul>
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag, DollarSign, Users, Bike, TrendingUp, Radio, Check, ChevronRight, X, Loader2, ChefHat, Receipt } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { sfx, unlockSounds } from "@/lib/sounds";

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

const STATUS_FLOW = ["pending", "preparing", "picked_up", "delivered"] as const;

function statusPriority(s: string) {
  const order: Record<string, number> = {
    pending: 0, confirmed: 1, preparing: 1, ready: 2,
    picked_up: 2, delivered: 3, cancelled: 4,
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
    case "picked_up":
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

  // Keep beeping while any order is still in "pending" — stops the moment
  // admin confirms / moves it forward / cancels.
  const pendingCount = liveOrders.data?.filter((o: any) => o.status === "pending").length ?? 0;
  const pendingRef = useRef(pendingCount);
  pendingRef.current = pendingCount;
  useEffect(() => {
    const tick = () => {
      if (pendingRef.current > 0) sfx.newOrder();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    const onClick = () => {
      unlockSounds();
      tick();
    }; // unlock audio on first user gesture
    window.addEventListener("click", onClick, { once: true });
    return () => {
      window.clearInterval(id);
      window.removeEventListener("click", onClick);
    };
  }, []);

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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border bg-card p-3 shadow-sm sm:p-5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs sm:text-sm">{c.label}</span>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="mt-2 text-xl font-bold sm:text-3xl">{c.value}</div>
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

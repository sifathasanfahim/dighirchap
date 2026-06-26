import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Search, Phone, User, Package, Bike, Clock, ExternalLink, RefreshCw, Printer, ChefHat, Receipt } from "lucide-react";

const openPrint = (id: string, type: "kitchen" | "invoice" | "both") => {
  window.open(`/print/${id}?type=${type}`, "_blank", "width=420,height=720");
};

type OrderStatus = Database["public"]["Enums"]["order_status"];

const STATUSES: OrderStatus[] = ["pending", "preparing", "picked_up", "delivered", "cancelled"];

const STATUS_META: Record<OrderStatus, { label: string; dot: string; ring: string; chip: string; row: string }> = {
  pending:      { label: "New",        dot: "bg-red-500",     ring: "ring-red-500/40",     chip: "bg-red-600 text-white",         row: "border-l-red-500" },
  confirmed:    { label: "Confirmed",  dot: "bg-green-500",   ring: "ring-green-500/40",   chip: "bg-green-600 text-white",       row: "border-l-green-500" },
  preparing:    { label: "Preparing",  dot: "bg-amber-500",   ring: "ring-amber-500/40",   chip: "bg-amber-500 text-white",       row: "border-l-amber-500" },
  ready:        { label: "Ready",      dot: "bg-blue-500",    ring: "ring-blue-500/40",    chip: "bg-blue-600 text-white",        row: "border-l-blue-500" },
  picked_up:    { label: "Out for delivery",  dot: "bg-indigo-500",  ring: "ring-indigo-500/40",  chip: "bg-indigo-600 text-white",      row: "border-l-indigo-500" },
  delivered:    { label: "Delivered",  dot: "bg-emerald-500", ring: "ring-emerald-500/40", chip: "bg-emerald-600 text-white",     row: "border-l-emerald-500" },
  cancelled:    { label: "Cancelled",  dot: "bg-rose-500",    ring: "ring-rose-500/40",    chip: "bg-rose-600 text-white",        row: "border-l-rose-500" },
};

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<OrderStatus | "all" | "active">("active");
  const [q, setQ] = useState("");

  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles!orders_customer_id_fkey(full_name, phone), order_items(name, qty)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const riders = useQuery({
    queryKey: ["riders-active"],
    queryFn: async () => (await supabase.from("riders").select("id, profiles(full_name)").eq("active", true)).data ?? [],
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-orders-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Status updated");
  };

  const assignRider = async (id: string, riderId: string) => {
    const { error } = await supabase.from("orders").update({ rider_id: riderId }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Rider assigned");
  };

  const normalizeStatus = (s: string): OrderStatus => {
    if (s === "confirmed") return "preparing";
    if (s === "ready") return "picked_up";
    return s as OrderStatus;
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, active: 0 };
    STATUSES.forEach((s) => (c[s] = 0));
    (orders.data ?? []).forEach((o: any) => {
      const st = normalizeStatus(o.status);
      c.all++;
      c[st] = (c[st] ?? 0) + 1;
      if (!["delivered", "cancelled"].includes(st)) c.active++;
    });
    return c;
  }, [orders.data]);

  const filtered = useMemo(() => {
    const list = orders.data ?? [];
    const query = q.trim().toLowerCase();
    return list.filter((o: any) => {
      const st = normalizeStatus(o.status);
      if (filter === "active" && ["delivered", "cancelled"].includes(st)) return false;
      if (filter !== "all" && filter !== "active" && st !== filter) return false;
      if (!query) return true;
      const hay = `${o.order_number} ${o.phone ?? ""} ${o.profiles?.full_name ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [orders.data, filter, q]);


  const tabs: { id: OrderStatus | "all" | "active"; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "all", label: "All" },
    { id: "cancelled", label: STATUS_META.cancelled.label },
  ];


  return (
    <StaffShell title="Orders">
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order #, name, or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => orders.refetch()} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", orders.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = filter === t.id;
          const count = counts[t.id] ?? 0;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
              )}
            >
              {t.id !== "all" && t.id !== "active" && (
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[t.id as OrderStatus].dot)} />
              )}
              {t.label}
              <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", active ? "bg-background/20" : "bg-muted")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {orders.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No orders match.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((o: any) => {
            const meta = STATUS_META[normalizeStatus(o.status)];
            return (
              <div
                key={o.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border-l-4 bg-card shadow-sm ring-1 ring-border/50 transition hover:shadow-md",
                  meta.row,
                )}
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">#{o.order_number}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", meta.chip)}>
                        {meta.label}
                      </span>
                      {o.status === "pending" && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {fmtDate(o.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{fmtBDT(o.total)}</div>
                    <div className="text-[11px] text-muted-foreground">{o.payment_method ?? "—"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t bg-muted/30 px-4 py-3 text-sm sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{o.profiles?.full_name ?? "Guest"}</span>
                    </div>
                    {o.phone && (
                      <a
                        href={`tel:${o.phone}`}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {o.phone}
                      </a>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">
                      {o.order_items.map((i: any) => `${i.qty}× ${i.name}`).join(", ") || "No items"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Select value={normalizeStatus(o.status)} onValueChange={(v) => updateStatus(o.id, v as OrderStatus)}>
                      <SelectTrigger className={cn("h-9 text-xs font-medium ring-2", meta.ring)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            <span className="flex items-center gap-2">
                              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[s].dot)} />
                              {STATUS_META[s].label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={o.rider_id ?? ""} onValueChange={(v) => assignRider(o.id, v)}>
                      <SelectTrigger className="h-9 text-xs">
                        <Bike className="mr-1.5 h-3.5 w-3.5" />
                        <SelectValue placeholder="Assign rider" />
                      </SelectTrigger>
                      <SelectContent>
                        {riders.data?.map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.profiles?.full_name ?? r.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => openPrint(o.id, "kitchen")} title="Kitchen ticket (KOT)">
                      <ChefHat className="h-3.5 w-3.5" /> <span className="hidden sm:inline">KOT</span>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => openPrint(o.id, "invoice")} title="Customer invoice">
                      <Receipt className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Bill</span>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => openPrint(o.id, "both")} title="Print both">
                      <Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">All</span>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-1">
                      <Link to="/orders/$id" params={{ id: o.id }}>
                        <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StaffShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT, fmtDate, statusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "picked_up", "delivered", "cancelled"];

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles!orders_customer_id_fkey(full_name, phone), order_items(name, qty)")
        .order("created_at", { ascending: false })
        .limit(100);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => orders.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orders]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Updated");
  };

  const assignRider = async (id: string, riderId: string) => {
    const { error } = await supabase.from("orders").update({ rider_id: riderId }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Rider assigned");
  };

  return (
    <StaffShell title="Orders">
      <div className="rounded-2xl border bg-card">
        <div className="grid grid-cols-12 gap-2 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-2">Order</div>
          <div className="col-span-2">Customer</div>
          <div className="col-span-3">Items</div>
          <div className="col-span-1">Total</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Rider</div>
        </div>
        {orders.data?.map((o) => (
          <div key={o.id} className="grid grid-cols-12 items-center gap-2 border-b px-4 py-3 text-sm last:border-0">
            <div className="col-span-2">
              <div className="font-semibold">{o.order_number}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</div>
            </div>
            <div className="col-span-2">
              <div>{o.profiles?.full_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{o.phone}</div>
            </div>
            <div className="col-span-3 text-xs text-muted-foreground">
              {o.order_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
            </div>
            <div className="col-span-1 font-semibold">{fmtBDT(o.total)}</div>
            <div className="col-span-2">
              <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v as OrderStatus)}>
                <SelectTrigger className={cn("h-8 text-xs", statusColor[o.status])}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Select value={o.rider_id ?? ""} onValueChange={(v) => assignRider(o.id, v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assign rider" /></SelectTrigger>
                <SelectContent>
                  {riders.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.profiles?.full_name ?? r.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {orders.data?.length === 0 && <div className="p-8 text-center text-muted-foreground">No orders yet.</div>}
      </div>
    </StaffShell>
  );
}

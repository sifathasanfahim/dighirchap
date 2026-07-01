import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Phone } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtBDT, fmtDate, statusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

export const Route = createFileRoute("/_authenticated/rider/")({
  head: () => ({
    meta: [
      { title: "Rider Portal — Dighir Chap" },
      { name: "description", content: "Rider delivery portal." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    if (!context.userId) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "rider");
    if (!data?.length) throw redirect({ to: "/" });
  },
  component: RiderPortal,
});

function RiderPortal() {
  const { userId } = Route.useRouteContext();

  const rider = useQuery({
    queryKey: ["rider-self", userId],
    queryFn: async () => (await supabase.from("riders").select("*").eq("profile_id", userId).maybeSingle()).data,
  });

  const orders = useQuery({
    queryKey: ["rider-orders", rider.data?.id],
    enabled: !!rider.data?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, profiles!orders_customer_id_fkey(full_name, phone)")
        .eq("rider_id", rider.data!.id)
        .in("status", ["confirmed", "preparing", "ready", "picked_up", "delivered"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!rider.data?.id) return;
    const ch = supabase
      .channel(`rider-${rider.data.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `rider_id=eq.${rider.data.id}` }, () => orders.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rider.data?.id, orders]);

  const setStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Status updated");
  };

  const todayDelivered = (orders.data ?? []).filter((o) => {
    if (o.status !== "delivered" || !o.delivered_at) return false;
    return new Date(o.delivered_at).toDateString() === new Date().toDateString();
  });
  const todayEarnings = todayDelivered.reduce((a, o) => a + Number(o.delivery_fee), 0);

  return (
    <StaffShell title="Rider Portal" variant="rider">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Today delivered</div>
          <div className="mt-1 text-3xl font-bold">{todayDelivered.length}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Today earnings (fees)</div>
          <div className="mt-1 text-3xl font-bold text-primary">{fmtBDT(todayEarnings)}</div>
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-lg font-bold">Assigned orders</h2>
      <div className="space-y-3">
        {orders.data?.length === 0 && <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">No assigned orders.</div>}
        {orders.data?.map((o) => (
          <div key={o.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</div>
                <div className="mt-1 text-sm">{o.profiles?.full_name}</div>
                <div className="text-xs text-muted-foreground">{o.address}</div>
              </div>
              <div className="text-right">
                <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", statusColor[o.status])}>{o.status}</span>
                <div className="mt-1 font-bold">{fmtBDT(o.total)}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {o.phone && <a href={`tel:${o.phone}`} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs"><Phone className="h-3 w-3" /> Call</a>}
              {o.status === "ready" && <Button size="sm" onClick={() => setStatus(o.id, "picked_up")}>Mark picked up</Button>}
              {o.status === "picked_up" && <Button size="sm" onClick={() => setStatus(o.id, "delivered")}>Mark delivered</Button>}
              {o.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`}
                  target="_blank" rel="noreferrer"
                  className="rounded-full bg-secondary px-3 py-1 text-xs"
                >
                  Navigate
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </StaffShell>
  );
}

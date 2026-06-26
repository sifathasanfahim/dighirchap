import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Check, Phone } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT, fmtDate, statusColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: () => ({ meta: [{ title: "Order Tracking — Dighir Chap" }] }),
  component: OrderDetail,
});

const steps = ["pending", "preparing", "picked_up", "delivered"] as const;
const stepLabels: Record<string, string> = {
  pending: "Order placed",
  preparing: "Preparing your food",
  picked_up: "Out for delivery",
  delivered: "Delivered",
};

function OrderDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const add = useCart((s) => s.add);

  const order = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), riders(*, profiles(full_name, phone))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => {
        order.refetch();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, order]);

  if (order.isLoading) return <CustomerShell><div className="text-muted-foreground">Loading...</div></CustomerShell>;
  if (!order.data) return <CustomerShell><div>Order not found.</div></CustomerShell>;
  const o = order.data;
  const normalizedStatus = (o.status === "confirmed" ? "preparing" : o.status === "ready" ? "picked_up" : o.status) as typeof steps[number];
  const currentStep = steps.indexOf(normalizedStatus);

  const reorder = () => {
    o.order_items.forEach((i) => add({ id: i.menu_item_id ?? i.id, name: i.name, price: Number(i.price) }));
    toast.success("Added to cart");
    navigate({ to: "/cart" });
  };

  return (
    <CustomerShell>
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold">{o.order_number}</h1>
            <p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusColor[o.status])}>{o.status}</span>
        </div>
      </div>

      {o.status !== "cancelled" && (
        <div className="mt-3 rounded-2xl border bg-card p-4">
          <h2 className="mb-4 font-semibold">Progress</h2>
          <ol className="space-y-3">
            {steps.map((s, idx) => {
              const done = idx <= currentStep;
              return (
                <li key={s} className="flex items-center gap-3">
                  <div className={cn("grid h-7 w-7 place-items-center rounded-full text-xs", done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {done ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className={cn("text-sm", done ? "font-medium" : "text-muted-foreground")}>{stepLabels[s]}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {o.riders && (
        <div className="mt-3 rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-semibold">Your rider</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{o.riders.profiles?.full_name ?? "Rider"}</div>
              <div className="text-xs text-muted-foreground">{o.riders.vehicle}</div>
            </div>
            {o.riders.profiles?.phone && (
              <a href={`tel:${o.riders.profiles.phone}`} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-2xl border bg-card p-4">
        <h2 className="mb-2 font-semibold">Items</h2>
        {o.order_items.map((i) => (
          <div key={i.id} className="flex justify-between py-1 text-sm">
            <span>{i.qty}× {i.name}</span>
            <span>{fmtBDT(Number(i.price) * i.qty)}</span>
          </div>
        ))}
        <div className="mt-3 border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{fmtBDT(o.subtotal)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>{fmtBDT(o.delivery_fee)}</span></div>
          {o.coins_redeemed > 0 && <div className="flex justify-between"><span>Coins</span><span>-{fmtBDT(o.coins_redeemed)}</span></div>}
          <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{fmtBDT(o.total)}</span></div>
          {o.coins_earned > 0 && <div className="text-xs text-primary">+{o.coins_earned} coins earned</div>}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border bg-card p-4 text-sm">
        <div className="font-semibold">Delivery address</div>
        <div className="text-muted-foreground">{o.address}</div>
        <div className="text-muted-foreground">{o.phone}</div>
      </div>

      <Button className="mt-4 w-full" variant="outline" onClick={reorder}>One-click reorder</Button>
    </CustomerShell>
  );
}

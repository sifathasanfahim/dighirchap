import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT, fmtDate, statusColor } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({ meta: [{ title: "My Orders — Dighir Chap" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const { userId } = Route.useRouteContext();
  const orders = useQuery({
    queryKey: ["my-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <CustomerShell>
      <h1 className="mb-4 text-2xl font-bold">My Orders</h1>
      <div className="space-y-2">
        {orders.data?.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">No orders yet.</div>
        )}
        {orders.data?.map((o) => (
          <Link
            key={o.id}
            to="/orders/$id"
            params={{ id: o.id }}
            className="block rounded-2xl border bg-card p-4 transition hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">{fmtBDT(o.total)}</div>
                <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", statusColor[o.status])}>
                  {o.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </CustomerShell>
  );
}

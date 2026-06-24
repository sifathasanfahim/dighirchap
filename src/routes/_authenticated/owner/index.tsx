import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/owner/")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "owner");
    if (!data?.length) throw redirect({ to: "/" });
  },
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const analytics = useQuery({
    queryKey: ["owner-analytics"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const [orders, customers, riders, items] = await Promise.all([
        supabase.from("orders").select("total, status, created_at, customer_id").gte("created_at", since.toISOString()),
        supabase.from("profiles").select("id, created_at"),
        supabase.from("riders").select("id, active"),
        supabase.from("order_items").select("name, qty"),
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

  return (
    <StaffShell title="Owner Analytics" variant="owner">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Revenue (30d)" value={fmtBDT(a?.revenue ?? 0)} />
        <Stat label="Completed orders" value={a?.completed ?? 0} />
        <Stat label="Avg order value" value={fmtBDT(a?.avgOrder ?? 0)} />
        <Stat label="Cancellation rate" value={`${a && (a.completed + a.cancelled) ? Math.round((a.cancelled / (a.completed + a.cancelled)) * 100) : 0}%`} />
        <Stat label="Customers" value={a?.customers ?? 0} />
        <Stat label="Active riders" value={a?.activeRiders ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Daily sales (30d)</h2>
          <div className="flex h-48 items-end gap-1">
            {a?.dailySales.map(([day, val]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-primary" style={{ height: `${(val / maxSale) * 100}%` }} title={`${day}: ${fmtBDT(val)}`} />
                <span className="text-[9px] text-muted-foreground">{day.slice(5)}</span>
              </div>
            ))}
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

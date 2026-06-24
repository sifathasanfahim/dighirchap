import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, DollarSign, Users, Bike } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [ordersToday, allOrders, customers, riders] = await Promise.all([
        supabase.from("orders").select("total", { count: "exact" }).gte("created_at", today.toISOString()),
        supabase.from("orders").select("total"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("riders").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      const todayRevenue = (ordersToday.data ?? []).reduce((a, o) => a + Number(o.total), 0);
      const totalRevenue = (allOrders.data ?? []).reduce((a, o) => a + Number(o.total), 0);
      return {
        ordersToday: ordersToday.count ?? 0,
        todayRevenue,
        totalRevenue,
        customers: customers.count ?? 0,
        riders: riders.count ?? 0,
      };
    },
  });

  const s = stats.data;
  const cards = [
    { label: "Orders today", value: s?.ordersToday ?? 0, icon: ShoppingBag },
    { label: "Revenue today", value: fmtBDT(s?.todayRevenue ?? 0), icon: DollarSign },
    { label: "Customers", value: s?.customers ?? 0, icon: Users },
    { label: "Active riders", value: s?.riders ?? 0, icon: Bike },
  ];

  return (
    <StaffShell title="Dashboard">
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
        <h2 className="font-semibold">Welcome to Dighir Chap CRM</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage orders, menu, customers, riders and more from the sidebar.</p>
      </div>
    </StaffShell>
  );
}

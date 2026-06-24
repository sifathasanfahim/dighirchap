import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const customers = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("lifetime_spend", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <StaffShell title="Customers">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-right">Coins</th>
              <th className="px-4 py-3 text-right">Lifetime spend</th>
              <th className="px-4 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.data?.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 font-medium">{c.full_name ?? "—"}</td>
                <td className="px-4 py-3">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{c.tier}</td>
                <td className="px-4 py-3 text-right">{c.coins}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtBDT(c.lifetime_spend)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}

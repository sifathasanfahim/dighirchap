import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: AdminCustomers,
});

type CustomerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  tier: string | null;
  coins: number | null;
  lifetime_spend: number | null;
  created_at: string | null;
  is_guest?: boolean;
  order_count?: number;
};

function AdminCustomers() {
  const customers = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async (): Promise<CustomerRow[]> => {
      const [profilesRes, guestRes] = await Promise.all([
        supabase.from("profiles").select("*").order("lifetime_spend", { ascending: false }).limit(1000),
        supabase
          .from("orders")
          .select("guest_name, phone, address, total, created_at")
          .is("customer_id", null)
          .not("phone", "is", null)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (guestRes.error) throw guestRes.error;

      const profilePhones = new Set(
        (profilesRes.data ?? []).map((p) => (p.phone ?? "").replace(/\s+/g, "")).filter(Boolean),
      );

      const guestMap = new Map<string, CustomerRow>();
      for (const o of guestRes.data ?? []) {
        const phone = (o.phone ?? "").replace(/\s+/g, "");
        if (!phone || profilePhones.has(phone)) continue;
        const existing = guestMap.get(phone);
        if (existing) {
          existing.lifetime_spend = (existing.lifetime_spend ?? 0) + Number(o.total ?? 0);
          existing.order_count = (existing.order_count ?? 0) + 1;
        } else {
          guestMap.set(phone, {
            id: `guest:${phone}`,
            full_name: o.guest_name ?? "Guest",
            phone: o.phone,
            address: o.address,
            tier: "guest",
            coins: 0,
            lifetime_spend: Number(o.total ?? 0),
            created_at: o.created_at,
            is_guest: true,
            order_count: 1,
          });
        }
      }

      const all: CustomerRow[] = [...(profilesRes.data as CustomerRow[]), ...guestMap.values()];
      all.sort((a, b) => (b.lifetime_spend ?? 0) - (a.lifetime_spend ?? 0));
      return all;
    },
  });


  const handlePrint = () => {
    const rows = customers.data ?? [];
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Customers</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{margin:0 0 4px}
        .meta{color:#666;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#f4f4f5;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
        .num{text-align:right;white-space:nowrap}
        @media print{ button{display:none} }
      </style></head><body>
      <h1>Customer List</h1>
      <div class="meta">Generated ${new Date().toLocaleString()} · ${rows.length} customers</div>
      <table>
        <thead><tr>
          <th>#</th><th>Name</th><th>Phone</th><th>Address</th>
          <th>Tier</th><th class="num">Coins</th><th class="num">Lifetime spend</th><th>Joined</th>
        </tr></thead>
        <tbody>
          ${rows.map((c, i) => `<tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(c.full_name ?? "—")}</td>
            <td>${escapeHtml(c.phone ?? "—")}</td>
            <td>${escapeHtml(c.address ?? "—")}</td>
            <td style="text-transform:capitalize">${escapeHtml(c.tier ?? "")}</td>
            <td class="num">${c.coins ?? 0}</td>
            <td class="num">${fmtBDT(c.lifetime_spend ?? 0)}</td>
            <td>${fmtDate(c.created_at ?? "")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <script>window.onload=()=>{window.print()}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <StaffShell title="Customers">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {customers.data?.length ?? 0} customers
        </p>
        <Button onClick={handlePrint} disabled={!customers.data?.length}>
          <Printer className="mr-2 h-4 w-4" /> Print all (PDF)
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-right">Coins</th>
              <th className="px-4 py-3 text-right">Lifetime spend</th>
              <th className="px-4 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.data?.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 font-medium">
                  {c.full_name ?? "—"}
                  {c.is_guest && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      GUEST · {c.order_count} order{(c.order_count ?? 0) > 1 ? "s" : ""}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 max-w-xs text-muted-foreground">{c.address ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{c.tier}</td>
                <td className="px-4 py-3 text-right">{c.coins ?? 0}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtBDT(c.lifetime_spend ?? 0)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(c.created_at ?? "")}</td>
              </tr>
            ))}

          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

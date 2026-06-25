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

function AdminCustomers() {
  const customers = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("lifetime_spend", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
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
            <td>${fmtDate(c.created_at)}</td>
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
                <td className="px-4 py-3 font-medium">{c.full_name ?? "—"}</td>
                <td className="px-4 py-3">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 max-w-xs text-muted-foreground">{c.address ?? "—"}</td>
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

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT, fmtDate } from "@/lib/format";

type Search = { type?: "kitchen" | "invoice" | "both" };

export const Route = createFileRoute("/_authenticated/print/$id")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    type: (s.type as Search["type"]) ?? "both",
  }),
  component: PrintOrder,
});

function PrintOrder() {
  const { id } = Route.useParams();
  const { type } = useSearch({ from: "/_authenticated/print/$id" });

  const q = useQuery({
    queryKey: ["print-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), profiles!orders_customer_id_fkey(full_name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (q.data) setTimeout(() => window.print(), 300);
  }, [q.data]);

  if (q.isLoading || !q.data) return <div className="p-4 text-sm">Loading…</div>;
  const o = q.data as any;

  const showKitchen = type === "kitchen" || type === "both";
  const showInvoice = type === "invoice" || type === "both";

  return (
    <>
      <style>{`
        @page { size: 80mm auto; margin: 3mm; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .ticket { page-break-after: always; }
          .ticket:last-child { page-break-after: auto; }
        }
        .ticket {
          width: 72mm;
          font-family: 'Courier New', ui-monospace, monospace;
          color: #000;
          font-size: 12px;
          line-height: 1.35;
          padding: 4px 0;
        }
        .ticket h1 { font-size: 16px; font-weight: 800; text-align: center; margin: 0; }
        .ticket h2 { font-size: 13px; font-weight: 800; text-align: center; margin: 2px 0 6px; letter-spacing: 2px; }
        .ticket .row { display: flex; justify-content: space-between; gap: 6px; }
        .ticket .sep { border-top: 1px dashed #000; margin: 6px 0; }
        .ticket table { width: 100%; border-collapse: collapse; }
        .ticket td { vertical-align: top; padding: 1px 0; }
        .ticket .right { text-align: right; }
        .ticket .center { text-align: center; }
        .ticket .big { font-size: 14px; font-weight: 800; }
      `}</style>

      <div className="no-print flex items-center justify-between gap-2 border-b bg-muted/40 p-3 text-sm">
        <span>Print preview — {o.order_number}</span>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1" onClick={() => window.print()}>Print</button>
          <button className="rounded border px-3 py-1" onClick={() => window.close()}>Close</button>
        </div>
      </div>

      <div className="flex flex-col items-center bg-white p-4">
        {showKitchen && (
          <div className="ticket">
            <h1>KITCHEN</h1>
            <h2>#{o.order_number}</h2>
            <div className="row"><span>{fmtDate(o.created_at)}</span><span>{o.payment_method ?? ""}</span></div>
            <div className="row"><span>Cust:</span><span>{o.profiles?.full_name ?? "Guest"}</span></div>
            {o.phone && <div className="row"><span>Ph:</span><span>{o.phone}</span></div>}
            <div className="sep" />
            <table>
              <tbody>
                {o.order_items.map((i: any) => (
                  <tr key={i.id}>
                    <td className="big" style={{ width: "18%" }}>{i.qty}×</td>
                    <td className="big">{i.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {o.notes && (<><div className="sep" /><div><b>Note:</b> {o.notes}</div></>)}
            <div className="sep" />
            <div className="center">*** KOT ***</div>
          </div>
        )}

        {showInvoice && (
          <div className="ticket">
            <h1>DIGHIR CHAP</h1>
            <div className="center">Customer Invoice</div>
            <div className="sep" />
            <div className="row"><span>Order:</span><span>#{o.order_number}</span></div>
            <div className="row"><span>Date:</span><span>{fmtDate(o.created_at)}</span></div>
            <div className="row"><span>Name:</span><span>{o.profiles?.full_name ?? "Guest"}</span></div>
            {o.phone && <div className="row"><span>Phone:</span><span>{o.phone}</span></div>}
            {o.address && <div>Addr: {o.address}</div>}
            <div className="sep" />
            <table>
              <tbody>
                {o.order_items.map((i: any) => (
                  <tr key={i.id}>
                    <td style={{ width: "10%" }}>{i.qty}</td>
                    <td>{i.name}</td>
                    <td className="right" style={{ width: "30%" }}>{fmtBDT(Number(i.price) * i.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sep" />
            <div className="row"><span>Subtotal</span><span>{fmtBDT(o.subtotal)}</span></div>
            <div className="row"><span>Delivery</span><span>{fmtBDT(o.delivery_fee)}</span></div>
            {o.coins_redeemed > 0 && <div className="row"><span>Coins</span><span>-{fmtBDT(o.coins_redeemed)}</span></div>}
            <div className="sep" />
            <div className="row big"><span>TOTAL</span><span>{fmtBDT(o.total)}</span></div>
            <div className="row"><span>Payment</span><span>{o.payment_method ?? "—"}</span></div>
            {o.coins_earned > 0 && <div className="center">+{o.coins_earned} coins earned</div>}
            <div className="sep" />
            <div className="center">Thank you!</div>
            <div className="center">dighirchap</div>
          </div>
        )}
      </div>
    </>
  );
}

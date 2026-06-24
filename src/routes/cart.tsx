import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { fmtBDT } from "@/lib/format";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — Dighir Chap" }] }),
  component: CartPage,
});

function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0);
  const deliveryFee = subtotal > 0 ? 60 : 0;

  return (
    <CustomerShell>
      <h1 className="mb-4 text-2xl font-bold">Your Cart</h1>
      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="text-muted-foreground">Cart is empty.</p>
          <Link to="/menu" className="mt-4 inline-block">
            <Button>Browse menu</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <div className="grid h-14 w-14 place-items-center rounded-xl bg-accent text-xl">🥘</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.name}</div>
                  <div className="text-sm text-primary font-semibold">{fmtBDT(i.price)}</div>
                </div>
                <div className="flex items-center gap-1 rounded-full border">
                  <button onClick={() => setQty(i.id, i.qty - 1)} className="p-2"><Minus className="h-3 w-3" /></button>
                  <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                  <button onClick={() => setQty(i.id, i.qty + 1)} className="p-2"><Plus className="h-3 w-3" /></button>
                </div>
                <button onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border bg-card p-4">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{fmtBDT(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span>Delivery</span><span>{fmtBDT(deliveryFee)}</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{fmtBDT(subtotal + deliveryFee)}</span></div>
            <Link to="/checkout" className="mt-4 block">
              <Button className="w-full" size="lg">Checkout</Button>
            </Link>
          </div>
        </>
      )}
    </CustomerShell>
  );
}

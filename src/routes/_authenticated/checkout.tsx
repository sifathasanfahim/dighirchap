import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtBDT } from "@/lib/format";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Dighir Chap" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { userId } = Route.useRouteContext();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0);
  const [deliveryFee] = useState(60);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [coupon, setCoupon] = useState("");
  const [redeemCoins, setRedeemCoins] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (data) {
        setAddress((a) => a || data.address || "");
        setPhone((p) => p || data.phone || "");
      }
      return data;
    },
  });

  const total = Math.max(0, subtotal + deliveryFee - redeemCoins);

  const placeOrder = async () => {
    if (items.length === 0) return toast.error("Cart is empty");
    if (!address || !phone) return toast.error("Address & phone required");
    setSubmitting(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_id: userId,
          subtotal,
          delivery_fee: deliveryFee,
          discount: 0,
          coins_redeemed: redeemCoins,
          total,
          coupon_code: coupon || null,
          payment_method: "cod",
          address,
          phone,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      const lines = items.map((i) => ({
        order_id: order.id,
        menu_item_id: i.id,
        name: i.name,
        qty: i.qty,
        price: i.price,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(lines);
      if (iErr) throw iErr;
      if (redeemCoins > 0) {
        await supabase.from("profiles").update({ coins: (profile.data?.coins ?? 0) - redeemCoins }).eq("id", userId);
      }
      clear();
      toast.success("Order placed!");
      navigate({ to: "/orders/$id", params: { id: order.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerShell>
      <h1 className="mb-4 text-2xl font-bold">Checkout</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-semibold">Delivery details</h2>
            <Label htmlFor="addr">Address</Label>
            <Textarea id="addr" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            <Label htmlFor="ph" className="mt-3 block">Phone</Label>
            <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Label htmlFor="nt" className="mt-3 block">Notes (optional)</Label>
            <Textarea id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-semibold">Coupon & coins</h2>
            <Label>Coupon code</Label>
            <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="WELCOME50" />
            <Label className="mt-3 block">Redeem coins ({profile.data?.coins ?? 0} available, 1 coin = ৳1)</Label>
            <Input
              type="number"
              min={0}
              max={profile.data?.coins ?? 0}
              value={redeemCoins}
              onChange={(e) => setRedeemCoins(Math.min(Number(e.target.value) || 0, profile.data?.coins ?? 0))}
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-semibold">Order summary</h2>
            {items.map((i) => (
              <div key={i.id} className="flex justify-between text-sm py-1">
                <span>{i.qty}× {i.name}</span>
                <span>{fmtBDT(i.qty * i.price)}</span>
              </div>
            ))}
            <div className="mt-3 border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{fmtBDT(subtotal)}</span></div>
              <div className="flex justify-between"><span>Delivery</span><span>{fmtBDT(deliveryFee)}</span></div>
              {redeemCoins > 0 && <div className="flex justify-between text-primary"><span>Coins</span><span>-{fmtBDT(redeemCoins)}</span></div>}
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{fmtBDT(total)}</span></div>
            </div>
            <div className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm">💵 Cash on Delivery</div>
            <Button className="mt-4 w-full" size="lg" onClick={placeOrder} disabled={submitting}>
              {submitting ? "Placing..." : `Place order — ${fmtBDT(total)}`}
            </Button>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}

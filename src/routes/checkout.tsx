import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { placeGuestOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Dighir Chap" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0);
  const deliveryFee = 60;
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [coupon, setCoupon] = useState("");
  const [redeemCoins, setRedeemCoins] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const guestOrderFn = useServerFn(placeGuestOrder);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAuthLoaded(true);
    });
  }, []);

  const profile = useQuery({
    enabled: !!userId,
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      if (data) {
        setAddress((a) => a || data.address || "");
        setPhone((p) => p || data.phone || "");
        setGuestName((n) => n || data.full_name || "");
      }
      return data;
    },
  });

  const rules = useQuery({
    queryKey: ["loyalty-rules-public"],
    queryFn: async () =>
      (await supabase.from("loyalty_rules").select("redeem_rate").eq("id", 1).maybeSingle()).data,
  });
  const redeemRate = Number(rules.data?.redeem_rate ?? 1);

  const tiers = useQuery({
    queryKey: ["loyalty-tiers"],
    queryFn: async () =>
      (await (supabase as any).from("loyalty_tiers").select("name, discount_pct, active")).data ?? [],
  });
  const tierName = (profile.data?.tier ?? "bronze") as string;
  const tierDiscountPct = Number(
    tiers.data?.find((t: any) => t.active && String(t.name).toLowerCase() === tierName.toLowerCase())
      ?.discount_pct ?? 0,
  );
  const tierDiscount = Math.round((subtotal * tierDiscountPct) / 100);
  const coinsValue = redeemCoins * redeemRate;
  const total = Math.max(0, subtotal + deliveryFee - tierDiscount - coinsValue);

  const placeOrder = async () => {
    if (items.length === 0) return toast.error("Cart is empty");
    if (!address || !phone) return toast.error("Address & phone required");
    if (!userId && !guestName.trim()) return toast.error("Please enter your name");
    setSubmitting(true);
    try {
      if (userId) {
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
          await supabase
            .from("profiles")
            .update({ coins: (profile.data?.coins ?? 0) - redeemCoins })
            .eq("id", userId);
        }
        clear();
        sfx.success();
        toast.success("Order placed!");
        navigate({ to: "/orders/$id", params: { id: order.id } });
      } else {
        const res = await guestOrderFn({
          data: {
            guest_name: guestName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            notes: notes.trim() || null,
            coupon_code: coupon.trim() || null,
            items: items.map((i) => ({ menu_item_id: i.id, qty: i.qty })),
          },
        });
        clear();
        sfx.success();
        toast.success(`Order ${res.order_number} placed! We'll call you shortly.`);
        navigate({ to: "/" });
      }
    } catch (e) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerShell>
      <h1 className="mb-4 text-2xl font-bold">Checkout</h1>
      {authLoaded && !userId && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-accent/40 p-3 text-sm">
          <span>Ordering as guest — no account needed.</span>
          <Link to="/auth" search={{ redirect: "/checkout" }} className="font-semibold text-primary hover:underline">
            Sign in to earn coins →
          </Link>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-semibold">Delivery details</h2>
            {!userId && (
              <>
                <Label htmlFor="gn">Your name</Label>
                <Input id="gn" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name" />
                <Label htmlFor="addr" className="mt-3 block">Address</Label>
              </>
            )}
            {userId && <Label htmlFor="addr">Address</Label>}
            <Textarea id="addr" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            <Label htmlFor="ph" className="mt-3 block">Phone</Label>
            <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            <Label htmlFor="nt" className="mt-3 block">Notes (optional)</Label>
            <Textarea id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          {userId && (
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
          )}
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
            <Button className="mt-4 w-full" size="lg" onClick={placeOrder} disabled={submitting || !authLoaded}>
              {submitting ? "Placing..." : `Place order — ${fmtBDT(total)}`}
            </Button>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}

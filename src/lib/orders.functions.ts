import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const guestOrderSchema = z.object({
  guest_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().min(4).max(500),
  notes: z.string().trim().max(500).optional().nullable(),
  coupon_code: z.string().trim().max(40).optional().nullable(),
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        qty: z.number().int().min(1).max(50),
      }),
    )
    .min(1)
    .max(50),
});

export const placeGuestOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => guestOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Server-side price lookup — never trust client prices
    const ids = data.items.map((i) => i.menu_item_id);
    const { data: menu, error: menuErr } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, available")
      .in("id", ids);
    if (menuErr) throw new Error(menuErr.message);

    const priceMap = new Map(menu?.map((m) => [m.id, m]) ?? []);
    for (const it of data.items) {
      const m = priceMap.get(it.menu_item_id);
      if (!m || !m.available) throw new Error("An item in your cart is unavailable");
    }

    const subtotal = data.items.reduce((a, it) => {
      const p = priceMap.get(it.menu_item_id)!.price as number;
      return a + p * it.qty;
    }, 0);
    let delivery_fee = 60;
    let discount = 0;
    let coupon_code: string | null = null;

    if (data.coupon_code) {
      const code = data.coupon_code.trim().toUpperCase();
      const { data: c } = await supabaseAdmin
        .from("coupons")
        .select("code, type, value, min_order, active, expires_at")
        .eq("code", code)
        .eq("active", true)
        .maybeSingle();
      if (c && (!c.expires_at || new Date(c.expires_at) > new Date()) && subtotal >= (c.min_order ?? 0)) {
        coupon_code = c.code;
        if (c.type === "flat") discount = Math.min(Number(c.value), subtotal);
        else if (c.type === "percent") discount = Math.round((subtotal * Number(c.value)) / 100);
        else if (c.type === "free_delivery") delivery_fee = 0;
      }
    }

    const total = Math.max(0, subtotal + delivery_fee - discount);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: null,
        guest_name: data.guest_name,
        subtotal,
        delivery_fee,
        discount,
        coins_redeemed: 0,
        total,
        coupon_code,
        payment_method: "cod",
        address: data.address,
        phone: data.phone,
        notes: data.notes || null,
      })
      .select("id, order_number, total")
      .single();
    if (error) throw new Error(error.message);

    const lines = data.items.map((it) => {
      const m = priceMap.get(it.menu_item_id)!;
      return {
        order_id: order.id,
        menu_item_id: it.menu_item_id,
        name: m.name as string,
        qty: it.qty,
        price: m.price as number,
      };
    });
    const { error: iErr } = await supabaseAdmin.from("order_items").insert(lines);
    if (iErr) throw new Error(iErr.message);

    return { id: order.id as string, order_number: order.order_number as string, total: order.total as number };
  });

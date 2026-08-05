
-- 1. app_settings: restrict public read
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated can read app settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.app_settings FROM anon;

-- 2. notifications: broadcast rows must be untargeted announcements
DROP POLICY IF EXISTS "notifications_select_own_or_broadcast" ON public.notifications;
DROP POLICY IF EXISTS "User reads own notifications" ON public.notifications;
CREATE POLICY "notifications_select_own_or_broadcast"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (is_broadcast = true AND user_id IS NULL));

-- 3. orders: split staff vs rider update
DROP POLICY IF EXISTS "Staff updates any order" ON public.orders;
CREATE POLICY "Staff updates any order"
  ON public.orders FOR UPDATE TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Rider updates assigned order"
  ON public.orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.riders r WHERE r.id = orders.rider_id AND r.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.riders r WHERE r.id = orders.rider_id AND r.profile_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.enforce_rider_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.riders r WHERE r.id = OLD.rider_id AND r.profile_id = auth.uid()) THEN
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.rider_id IS DISTINCT FROM OLD.rider_id
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.discount IS DISTINCT FROM OLD.discount
       OR NEW.coins_redeemed IS DISTINCT FROM OLD.coins_redeemed
       OR NEW.coins_earned IS DISTINCT FROM OLD.coins_earned
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.coupon_code IS DISTINCT FROM OLD.coupon_code
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.order_number IS DISTINCT FROM OLD.order_number
       OR NEW.address IS DISTINCT FROM OLD.address
       OR NEW.phone IS DISTINCT FROM OLD.phone
       OR NEW.guest_name IS DISTINCT FROM OLD.guest_name THEN
      RAISE EXCEPTION 'Riders may only update delivery status and location';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_rider_order_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_rider_guard ON public.orders;
CREATE TRIGGER trg_orders_rider_guard
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rider_order_update();

-- 4. promo_banners: only active rows public
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.promo_banners;
CREATE POLICY "Anyone can view active banners"
  ON public.promo_banners FOR SELECT USING (active = true OR is_staff(auth.uid()));

-- 5. Revoke EXECUTE on internal SECURITY DEFINER / trigger functions
REVOKE ALL ON FUNCTION public.assign_order_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_loyalty_on_delivery() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_notifications() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

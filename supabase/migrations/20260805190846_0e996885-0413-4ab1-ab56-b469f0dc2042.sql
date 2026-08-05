
-- categories
DROP POLICY IF EXISTS "Anyone reads active categories" ON public.categories;
CREATE POLICY "Anon reads active categories" ON public.categories FOR SELECT TO anon USING (active);
CREATE POLICY "Auth reads categories" ON public.categories FOR SELECT TO authenticated USING (active OR is_staff(auth.uid()));

-- menu_items
DROP POLICY IF EXISTS "Anyone reads available items" ON public.menu_items;
CREATE POLICY "Anon reads available items" ON public.menu_items FOR SELECT TO anon USING (available);
CREATE POLICY "Auth reads menu items" ON public.menu_items FOR SELECT TO authenticated USING (available OR is_staff(auth.uid()));

-- promo_banners
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.promo_banners;
CREATE POLICY "Anon views active banners" ON public.promo_banners FOR SELECT TO anon USING (active = true);
CREATE POLICY "Auth views banners" ON public.promo_banners FOR SELECT TO authenticated USING (active = true OR is_staff(auth.uid()));

-- loyalty_tiers
DROP POLICY IF EXISTS "Anyone can view active tiers" ON public.loyalty_tiers;
CREATE POLICY "Anon views active tiers" ON public.loyalty_tiers FOR SELECT TO anon USING (active = true);
CREATE POLICY "Auth views tiers" ON public.loyalty_tiers FOR SELECT TO authenticated USING (active = true OR has_role(auth.uid(), 'owner'::app_role));

-- popup_banners: restrict the public policy to anon + add authenticated equivalent
DROP POLICY IF EXISTS "Anyone can view active popup banners" ON public.popup_banners;
CREATE POLICY "Anon views active popups" ON public.popup_banners FOR SELECT TO anon USING (active = true);
CREATE POLICY "Auth views popups" ON public.popup_banners FOR SELECT TO authenticated USING (active = true OR is_staff(auth.uid()));

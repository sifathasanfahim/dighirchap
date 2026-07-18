GRANT SELECT ON public.coupons TO anon;
CREATE POLICY "Anon reads active coupons" ON public.coupons FOR SELECT TO anon
USING (active = true);
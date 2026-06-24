CREATE POLICY "Public can read menu images" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
CREATE POLICY "Staff can upload menu images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff can update menu images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'menu-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete menu images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'menu-images' AND public.is_staff(auth.uid()));
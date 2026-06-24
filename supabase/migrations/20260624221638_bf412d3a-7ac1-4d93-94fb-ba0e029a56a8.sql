CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  support_phone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO public.app_settings (id, support_phone) VALUES (1, '') ON CONFLICT DO NOTHING;
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
GRANT UPDATE, INSERT ON public.app_settings TO authenticated;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read app settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Staff can update app settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert app settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
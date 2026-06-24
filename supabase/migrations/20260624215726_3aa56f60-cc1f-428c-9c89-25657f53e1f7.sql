CREATE TABLE public.popup_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.popup_banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.popup_banners TO authenticated;
GRANT ALL ON public.popup_banners TO service_role;

ALTER TABLE public.popup_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active popup banners"
ON public.popup_banners FOR SELECT
USING (active = true);

CREATE POLICY "Staff can manage popup banners"
ON public.popup_banners FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'marketing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'marketing')
);

CREATE TRIGGER popup_banners_updated_at
BEFORE UPDATE ON public.popup_banners
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
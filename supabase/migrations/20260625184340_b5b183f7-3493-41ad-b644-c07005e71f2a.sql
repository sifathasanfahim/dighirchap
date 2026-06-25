
CREATE TABLE public.loyalty_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  min_spend NUMERIC NOT NULL DEFAULT 0,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#a78bfa',
  icon TEXT NOT NULL DEFAULT 'sparkles',
  perks TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_tiers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.loyalty_tiers TO authenticated;
GRANT ALL ON public.loyalty_tiers TO service_role;

ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tiers"
  ON public.loyalty_tiers FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can manage tiers"
  ON public.loyalty_tiers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER loyalty_tiers_updated_at
  BEFORE UPDATE ON public.loyalty_tiers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.loyalty_tiers (name, min_spend, discount_pct, color, icon, perks, sort_order) VALUES
  ('Bronze',   0,     0,  '#b45309', 'medal',    ARRAY['Welcome tier','Earn coins on every order'], 1),
  ('Silver',   5000,  3,  '#64748b', 'award',    ARRAY['3% off all orders','Priority support'],     2),
  ('Gold',     20000, 7,  '#ca8a04', 'trophy',   ARRAY['7% off all orders','Free delivery on ৳500+'], 3),
  ('Platinum', 50000, 12, '#7c3aed', 'crown',    ARRAY['12% off all orders','Free delivery','Exclusive items'], 4);

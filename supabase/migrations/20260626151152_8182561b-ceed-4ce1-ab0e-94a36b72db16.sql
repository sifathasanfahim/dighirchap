
CREATE TABLE IF NOT EXISTS public.daily_order_counters (
  day DATE PRIMARY KEY,
  last_no INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.daily_order_counters TO authenticated;
GRANT ALL ON public.daily_order_counters TO service_role;
ALTER TABLE public.daily_order_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read counters" ON public.daily_order_counters
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today DATE := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  next_no INTEGER;
BEGIN
  INSERT INTO public.daily_order_counters(day, last_no)
  VALUES (today, 1)
  ON CONFLICT (day) DO UPDATE SET last_no = public.daily_order_counters.last_no + 1
  RETURNING last_no INTO next_no;

  NEW.order_number := 'DC-' || to_char(today, 'YYYY') || '-' || lpad(next_no::text, 4, '0');
  RETURN NEW;
END;
$$;

ALTER TABLE public.orders ALTER COLUMN order_number DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;

DROP TRIGGER IF EXISTS trg_assign_order_number ON public.orders;
CREATE TRIGGER trg_assign_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_order_number();

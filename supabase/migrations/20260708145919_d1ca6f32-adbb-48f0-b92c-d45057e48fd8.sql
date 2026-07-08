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

  NEW.order_number := 'DC-' || to_char(today, 'YYMMDD') || '-' || lpad(next_no::text, 4, '0');
  RETURN NEW;
END;
$$;

-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('owner','manager','cashier','marketing','rider_manager','rider','customer');
CREATE TYPE public.order_status AS ENUM ('pending','confirmed','preparing','ready','picked_up','delivered','cancelled');
CREATE TYPE public.loyalty_tier AS ENUM ('bronze','silver','gold','platinum');
CREATE TYPE public.coupon_type AS ENUM ('percent','flat','free_delivery');
CREATE TYPE public.complaint_status AS ENUM ('open','in_progress','resolved','closed');

-- =========================
-- Generic updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  coins INTEGER NOT NULL DEFAULT 0,
  lifetime_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  tier public.loyalty_tier NOT NULL DEFAULT 'bronze',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner','manager','cashier','marketing','rider_manager')
  );
$$;

-- Profiles policies
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Staff update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- user_roles policies
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

-- =========================
-- Auto-create profile + customer role on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- CATEGORIES
-- =========================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "Anyone reads active categories" ON public.categories FOR SELECT
  USING (active OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- MENU ITEMS
-- =========================
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_menu_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "Anyone reads available items" ON public.menu_items FOR SELECT
  USING (available OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage menu" ON public.menu_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- RIDERS
-- =========================
CREATE TABLE public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_location_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.riders TO authenticated;
GRANT ALL ON public.riders TO service_role;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_riders_updated BEFORE UPDATE ON public.riders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "Rider reads self, staff reads all, customers read assigned" ON public.riders FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'rider_manager'));
CREATE POLICY "Rider updates self" ON public.riders FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Staff manage riders" ON public.riders FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- COUPONS
-- =========================
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type public.coupon_type NOT NULL,
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "Authenticated reads active coupons" ON public.coupons FOR SELECT TO authenticated
  USING (active OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- ORDERS
-- =========================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('DC-' || to_char(now(),'YYMMDD') || '-' || lpad(floor(random()*100000)::text,5,'0')),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  coins_redeemed INTEGER NOT NULL DEFAULT 0,
  coins_earned INTEGER NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Customer reads own orders" ON public.orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid()
    OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.riders r WHERE r.id = orders.rider_id AND r.profile_id = auth.uid()));
CREATE POLICY "Customer creates own order" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Staff updates any order" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.riders r WHERE r.id = orders.rider_id AND r.profile_id = auth.uid()))
  WITH CHECK (true);

-- =========================
-- ORDER ITEMS
-- =========================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read items via order" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
    AND (o.customer_id = auth.uid() OR public.is_staff(auth.uid())
      OR EXISTS (SELECT 1 FROM public.riders r WHERE r.id = o.rider_id AND r.profile_id = auth.uid()))));
CREATE POLICY "Insert items on own order" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()));

-- =========================
-- COMPLAINTS
-- =========================
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'open',
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_complaints_updated BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "Customer reads own complaints" ON public.complaints FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Customer files complaint" ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Staff manages complaints" ON public.complaints FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- LOYALTY RULES (singleton)
-- =========================
CREATE TABLE public.loyalty_rules (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  coins_per_100 INTEGER NOT NULL DEFAULT 5,
  redeem_rate NUMERIC(6,2) NOT NULL DEFAULT 1.00, -- 1 coin = 1 BDT discount
  silver_threshold NUMERIC(10,2) NOT NULL DEFAULT 5000,
  gold_threshold NUMERIC(10,2) NOT NULL DEFAULT 20000,
  platinum_threshold NUMERIC(10,2) NOT NULL DEFAULT 50000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_rules TO authenticated;
GRANT ALL ON public.loyalty_rules TO service_role;
ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_loyalty_updated BEFORE UPDATE ON public.loyalty_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "Authenticated reads loyalty rules" ON public.loyalty_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner updates loyalty rules" ON public.loyalty_rules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));
INSERT INTO public.loyalty_rules (id) VALUES (1);

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "User marks own notification read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================
-- Loyalty award trigger on delivery
-- =========================
CREATE OR REPLACE FUNCTION public.award_loyalty_on_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rules public.loyalty_rules; earn INTEGER; new_spend NUMERIC; new_tier public.loyalty_tier;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    SELECT * INTO rules FROM public.loyalty_rules WHERE id = 1;
    earn := floor(NEW.total / 100) * rules.coins_per_100;
    NEW.coins_earned := earn;
    NEW.delivered_at := now();

    UPDATE public.profiles
       SET coins = coins + earn,
           lifetime_spend = lifetime_spend + NEW.total
     WHERE id = NEW.customer_id
    RETURNING lifetime_spend INTO new_spend;

    IF new_spend >= rules.platinum_threshold THEN new_tier := 'platinum';
    ELSIF new_spend >= rules.gold_threshold THEN new_tier := 'gold';
    ELSIF new_spend >= rules.silver_threshold THEN new_tier := 'silver';
    ELSE new_tier := 'bronze'; END IF;

    UPDATE public.profiles SET tier = new_tier WHERE id = NEW.customer_id;

    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.customer_id, 'Order delivered',
      'You earned ' || earn || ' coins from order ' || NEW.order_number || '.');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_orders_award_loyalty BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.award_loyalty_on_delivery();

-- =========================
-- Realtime publication
-- =========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.riders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =========================
-- Seed: categories + menu items
-- =========================
INSERT INTO public.categories (name, sort_order) VALUES
  ('Chap', 1), ('Rice & Biryani', 2), ('Kebab', 3), ('Drinks', 4), ('Desserts', 5);

INSERT INTO public.menu_items (category_id, name, description, price)
SELECT c.id, m.name, m.description, m.price FROM (VALUES
  ('Chap', 'Chicken Chap', 'Signature Dighir Chap with rich gravy', 180),
  ('Chap', 'Beef Chap', 'Slow-cooked beef chap', 250),
  ('Chap', 'Mutton Chap', 'Tender mutton chap', 320),
  ('Rice & Biryani', 'Chicken Biryani', 'Aromatic basmati biryani', 220),
  ('Rice & Biryani', 'Beef Tehari', 'Bangladeshi tehari', 240),
  ('Kebab', 'Chicken Reshmi Kebab', 'Creamy grilled kebab', 200),
  ('Kebab', 'Seekh Kebab', 'Spiced minced meat skewers', 180),
  ('Drinks', 'Borhani', 'Traditional yogurt drink', 60),
  ('Drinks', 'Coca Cola 250ml', 'Chilled cola', 30),
  ('Desserts', 'Firni', 'Rice pudding', 80)
) AS m(category, name, description, price)
JOIN public.categories c ON c.name = m.category;

INSERT INTO public.coupons (code, type, value, min_order)
VALUES ('WELCOME50', 'flat', 50, 300), ('FREESHIP', 'free_delivery', 0, 200);

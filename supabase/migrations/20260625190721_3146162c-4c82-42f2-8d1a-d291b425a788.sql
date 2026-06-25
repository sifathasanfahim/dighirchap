
-- Make notifications support broadcasts
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false;

-- Refresh policies
DROP POLICY IF EXISTS "Users see their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own_or_broadcast" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_staff" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

CREATE POLICY "notifications_select_own_or_broadcast"
ON public.notifications FOR SELECT
TO authenticated
USING (is_broadcast = true OR user_id = auth.uid());

CREATE POLICY "notifications_insert_staff"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "notifications_update_own"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Enable Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

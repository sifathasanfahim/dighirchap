-- Allow owners/staff to read push subscriptions and delete stale ones so
-- the sendPush server function can operate through the RLS-scoped client
-- (SUPABASE_SERVICE_ROLE_KEY is not exposed to the TanStack runtime).

CREATE POLICY "Staff can view all push subscriptions"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete stale push subscriptions"
ON public.push_subscriptions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.is_staff(auth.uid()));

CREATE POLICY "Staff can view all user roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.is_staff(auth.uid()));
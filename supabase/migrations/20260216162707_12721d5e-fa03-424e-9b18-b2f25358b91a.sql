-- Tighten the overly permissive RLS INSERT policy on newsletter_unsubscribes
DROP POLICY IF EXISTS "Anyone can unsubscribe" ON public.newsletter_unsubscribes;

CREATE POLICY "Anyone can unsubscribe with valid email"
ON public.newsletter_unsubscribes
FOR INSERT
TO anon, authenticated
WITH CHECK (email IS NOT NULL AND email <> '');
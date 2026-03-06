-- Allow paid subscription roles in profiles
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role = ANY (ARRAY['admin'::text, 'editor'::text, 'agent'::text, 'core'::text, 'managed'::text]));

-- Backfill any paid users created by Stripe who are missing a profile row
WITH paid_users AS (
  SELECT DISTINCT ur.user_id, ur.role::text AS role
  FROM public.user_roles ur
  WHERE ur.role IN ('core', 'managed')
), source_users AS (
  SELECT
    pu.user_id,
    au.email,
    NULLIF(au.raw_user_meta_data->>'first_name', '') AS first_name,
    NULLIF(au.raw_user_meta_data->>'last_name', '') AS last_name,
    pu.role
  FROM paid_users pu
  JOIN auth.users au ON au.id = pu.user_id
)
INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
SELECT su.user_id, su.email, su.first_name, su.last_name, su.role
FROM source_users su
LEFT JOIN public.profiles p ON p.user_id = su.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO UPDATE
SET
  email = EXCLUDED.email,
  first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
  last_name = COALESCE(public.profiles.last_name, EXCLUDED.last_name),
  role = EXCLUDED.role,
  updated_at = now();
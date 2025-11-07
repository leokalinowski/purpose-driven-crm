-- Fix missing profile for test user
INSERT INTO public.profiles (user_id, first_name, last_name, email, role)
SELECT 
  id,
  raw_user_meta_data->>'first_name',
  raw_user_meta_data->>'last_name',
  email,
  'agent'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;
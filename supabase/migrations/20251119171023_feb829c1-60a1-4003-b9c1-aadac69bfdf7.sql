-- Grant admin role to JJ Gagliardi (jj@realestateonpurpose.com)
INSERT INTO public.user_roles (user_id, role, created_by)
VALUES (
  'b311d661-e0de-4119-ac9f-5b5d591884ed',
  'admin'::app_role,
  'b311d661-e0de-4119-ac9f-5b5d591884ed'
)
ON CONFLICT (user_id, role) DO NOTHING;
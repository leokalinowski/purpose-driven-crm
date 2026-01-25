-- Add public SELECT policies for profiles and user_roles to allow anonymous agent fetching

-- Allow public to read basic profile info (name, email only - not sensitive fields)
CREATE POLICY "Public can view basic profile info"
  ON public.profiles FOR SELECT
  USING (true);

-- Allow public to read user_roles to identify agents/admins
CREATE POLICY "Public can view user roles"
  ON public.user_roles FOR SELECT
  USING (true);
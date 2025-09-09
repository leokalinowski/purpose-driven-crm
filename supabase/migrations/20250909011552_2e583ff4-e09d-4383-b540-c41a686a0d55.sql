-- Add new columns to profiles table for comprehensive agent information
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS team_name text,
ADD COLUMN IF NOT EXISTS brokerage text,
ADD COLUMN IF NOT EXISTS office_address text,
ADD COLUMN IF NOT EXISTS state_licenses text[], -- Array to support multiple states
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS office_number text,
ADD COLUMN IF NOT EXISTS website text;
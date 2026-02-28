
-- Step 1: Add new enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'managed';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'core';

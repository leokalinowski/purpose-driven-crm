-- Fix spheresync_tasks table schema issues

-- First, clean up any existing data that might have null ids
DELETE FROM public.spheresync_tasks WHERE id IS NULL;

-- Make id column NOT NULL with default and set as primary key
ALTER TABLE public.spheresync_tasks 
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

-- Add primary key constraint
ALTER TABLE public.spheresync_tasks ADD CONSTRAINT spheresync_tasks_pkey PRIMARY KEY (id);

-- Make agent_id NOT NULL (required for RLS policies)
UPDATE public.spheresync_tasks SET agent_id = gen_random_uuid() WHERE agent_id IS NULL;
ALTER TABLE public.spheresync_tasks ALTER COLUMN agent_id SET NOT NULL;

-- Make task_type NOT NULL with default
UPDATE public.spheresync_tasks SET task_type = 'call' WHERE task_type IS NULL;
ALTER TABLE public.spheresync_tasks ALTER COLUMN task_type SET NOT NULL;

-- Set proper defaults for boolean and timestamp columns
ALTER TABLE public.spheresync_tasks 
  ALTER COLUMN completed SET DEFAULT false,
  ALTER COLUMN dnc_status SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- Make sure completed is not null
UPDATE public.spheresync_tasks SET completed = false WHERE completed IS NULL;
ALTER TABLE public.spheresync_tasks ALTER COLUMN completed SET NOT NULL;

-- Make sure timestamps are not null
UPDATE public.spheresync_tasks SET created_at = now() WHERE created_at IS NULL;
UPDATE public.spheresync_tasks SET updated_at = now() WHERE updated_at IS NULL;
ALTER TABLE public.spheresync_tasks 
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- Add trigger for updated_at timestamp
CREATE TRIGGER update_spheresync_tasks_updated_at
  BEFORE UPDATE ON public.spheresync_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key constraint to contacts table
ALTER TABLE public.spheresync_tasks
ADD CONSTRAINT spheresync_tasks_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES public.contacts(id) ON DELETE CASCADE;
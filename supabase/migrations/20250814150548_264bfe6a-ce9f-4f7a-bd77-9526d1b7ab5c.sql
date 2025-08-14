-- Enhance transaction_coordination table for OpenToClose integration
ALTER TABLE public.transaction_coordination 
ADD COLUMN IF NOT EXISTS otc_deal_id text UNIQUE,
ADD COLUMN IF NOT EXISTS gci numeric,
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'ongoing';

-- Update existing records to have a status if they don't
UPDATE public.transaction_coordination 
SET status = 'ongoing' 
WHERE status IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_transaction_coordination_otc_deal_id ON public.transaction_coordination(otc_deal_id);
CREATE INDEX IF NOT EXISTS idx_transaction_coordination_status ON public.transaction_coordination(status);
CREATE INDEX IF NOT EXISTS idx_transaction_coordination_agent_date ON public.transaction_coordination(responsible_agent, closing_date);

-- Update RLS policies to ensure proper access
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transaction_coordination;
CREATE POLICY "Admins can manage all transactions" 
ON public.transaction_coordination 
FOR ALL 
USING (get_current_user_role() = 'admin');

-- Ensure agents can insert their own transactions
DROP POLICY IF EXISTS "Agents can insert their transactions" ON public.transaction_coordination;
CREATE POLICY "Agents can insert their transactions" 
ON public.transaction_coordination 
FOR INSERT 
WITH CHECK ((responsible_agent = auth.uid()) OR (get_current_user_role() = 'admin'));
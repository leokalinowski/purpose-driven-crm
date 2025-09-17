-- Add RLS policies for transaction_coordination table
ALTER TABLE transaction_coordination ENABLE ROW LEVEL SECURITY;

-- Agents can manage their own transactions
CREATE POLICY "Agents can view their own transactions" 
ON transaction_coordination 
FOR SELECT 
USING (
  (responsible_agent = auth.uid()) OR 
  (listing_agent_id = auth.uid()) OR 
  (buyer_agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

CREATE POLICY "Agents can insert their own transactions" 
ON transaction_coordination 
FOR INSERT 
WITH CHECK (
  (responsible_agent = auth.uid()) OR 
  (listing_agent_id = auth.uid()) OR 
  (buyer_agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

CREATE POLICY "Agents can update their own transactions" 
ON transaction_coordination 
FOR UPDATE 
USING (
  (responsible_agent = auth.uid()) OR 
  (listing_agent_id = auth.uid()) OR 
  (buyer_agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

CREATE POLICY "Only admins can delete transactions" 
ON transaction_coordination 
FOR DELETE 
USING (get_current_user_role() = 'admin');
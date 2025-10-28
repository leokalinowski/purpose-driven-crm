-- Force enable RLS on the 5 tables
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_csv_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_market_data ENABLE ROW LEVEL SECURITY;
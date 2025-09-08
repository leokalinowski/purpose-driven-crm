-- Add new fields to transaction_coordination table for enhanced data collection
ALTER TABLE public.transaction_coordination 
ADD COLUMN listing_agent_id uuid,
ADD COLUMN buyer_agent_id uuid,
ADD COLUMN property_type text,
ADD COLUMN square_footage integer,
ADD COLUMN bedrooms integer,
ADD COLUMN bathrooms numeric(3,1),
ADD COLUMN listing_date date,
ADD COLUMN days_on_market integer,
ADD COLUMN price_per_sqft numeric(10,2),
ADD COLUMN commission_rate numeric(5,2),
ADD COLUMN brokerage_split numeric(5,2),
ADD COLUMN transaction_type text CHECK (transaction_type IN ('buy', 'sell', 'both')),
ADD COLUMN lead_source text,
ADD COLUMN referral_source text,
ADD COLUMN milestone_dates jsonb DEFAULT '{}',
ADD COLUMN risk_factors text[],
ADD COLUMN raw_api_data jsonb,
ADD COLUMN last_synced_at timestamp with time zone DEFAULT now(),
ADD COLUMN sync_errors text[];

-- Add indexes for better query performance
CREATE INDEX idx_transaction_coordination_listing_agent ON public.transaction_coordination(listing_agent_id);
CREATE INDEX idx_transaction_coordination_buyer_agent ON public.transaction_coordination(buyer_agent_id);
CREATE INDEX idx_transaction_coordination_property_type ON public.transaction_coordination(property_type);
CREATE INDEX idx_transaction_coordination_transaction_type ON public.transaction_coordination(transaction_type);
CREATE INDEX idx_transaction_coordination_lead_source ON public.transaction_coordination(lead_source);
CREATE INDEX idx_transaction_coordination_last_synced ON public.transaction_coordination(last_synced_at);

-- Add computed column for days on market calculation
ALTER TABLE public.transaction_coordination 
ADD COLUMN computed_days_on_market integer GENERATED ALWAYS AS (
  CASE 
    WHEN listing_date IS NOT NULL AND COALESCE(closing_date, CURRENT_DATE) >= listing_date 
    THEN COALESCE(closing_date, CURRENT_DATE) - listing_date
    ELSE days_on_market
  END
) STORED;
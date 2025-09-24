-- Create CSV files storage table
CREATE TABLE newsletter_csv_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

-- Create market data cache table
CREATE TABLE newsletter_market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csv_file_id UUID REFERENCES newsletter_csv_files(id),
  zip_code TEXT NOT NULL,
  median_value NUMERIC,
  value_change TEXT,
  area_name TEXT,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create newsletter campaigns table
CREATE TABLE newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csv_file_id UUID REFERENCES newsletter_csv_files(id),
  campaign_name TEXT,
  status TEXT DEFAULT 'draft',
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_newsletter_csv_files_active ON newsletter_csv_files(is_active);
CREATE INDEX idx_newsletter_csv_files_upload_date ON newsletter_csv_files(upload_date DESC);
CREATE INDEX idx_newsletter_market_data_zip_code ON newsletter_market_data(zip_code);
CREATE INDEX idx_newsletter_market_data_csv_file_id ON newsletter_market_data(csv_file_id);
CREATE INDEX idx_newsletter_campaigns_status ON newsletter_campaigns(status);

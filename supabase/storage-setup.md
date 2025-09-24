# Storage Bucket Setup Instructions

## Create Storage Bucket for CSV Files

You need to create a storage bucket in your Supabase dashboard to store the uploaded CSV files.

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to your project dashboard
   - Go to **Storage** in the left sidebar

2. **Create New Bucket**
   - Click **"New Bucket"**
   - Name: `newsletter-csvs`
   - **Make it Public** (check the "Public bucket" option)
   - Click **"Create bucket"**

3. **Set Bucket Policies**
   - Go to **Authentication** → **Policies**
   - Create a policy for the `newsletter-csvs` bucket:
     ```sql
     -- Allow authenticated users to upload files
     CREATE POLICY "Allow authenticated uploads" ON storage.objects
     FOR INSERT WITH CHECK (
       bucket_id = 'newsletter-csvs' AND 
       auth.role() = 'authenticated'
     );

     -- Allow authenticated users to read files
     CREATE POLICY "Allow authenticated reads" ON storage.objects
     FOR SELECT USING (
       bucket_id = 'newsletter-csvs' AND 
       auth.role() = 'authenticated'
     );
     ```

### Alternative: Use SQL Editor

You can also create the bucket using the SQL Editor:

```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('newsletter-csvs', 'newsletter-csvs', true);

-- Create policies for the bucket
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'newsletter-csvs' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated reads" ON storage.objects
FOR SELECT USING (
  bucket_id = 'newsletter-csvs' AND 
  auth.role() = 'authenticated'
);
```

## Environment Variables

Make sure these environment variables are set in your Supabase project:

- `XAI_API_KEY` - Your Grok API key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for the upload function)

## Testing

Once the bucket is created, you can test the CSV upload functionality:

1. Go to **Admin Newsletter** page
2. Click **CSV Upload** tab
3. Upload a test CSV file
4. Check if it appears in the uploaded files list

## CSV File Format

Your CSV files should contain columns like:
- `zip_code` (required)
- `median_listing_price` (required)
- `median_listing_price_mom` (month-over-month change)
- `median_listing_price_yoy` (year-over-year change)
- `city` (optional)
- `state` (optional)

Example CSV structure:
```csv
zip_code,median_listing_price,median_listing_price_mom,median_listing_price_yoy,city,state
20001,685000,3.1%,2.8%,Washington,DC
20002,520000,2.8%,1.5%,Washington,DC
90210,3200000,1.8%,5.2%,Beverly Hills,CA
```

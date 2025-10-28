import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CSVRow {
  zip_code: string;
  median_listing_price: number;
  median_listing_price_mom: string;
  median_listing_price_yoy: string;
  city: string;
  state: string;
  [key: string]: any;
}

function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  
  console.log('CSV Headers found:', headers);
  
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || null;
    });
    
    // Handle multiple possible column name variations
    const zipVariations = ['zip_code', 'zip', 'postal_code', 'zipcode'];
    const priceVariations = ['median_listing_price', 'median_price', 'median_value', 'price'];
    const yoyVariations = ['median_listing_price_yoy', 'yoy_change', 'year_over_year', 'yoy'];
    
    // Find and normalize zip code
    for (const variant of zipVariations) {
      if (row[variant]) {
        row.zip_code = row[variant];
        break;
      }
    }
    
    // Find and normalize median price
    for (const variant of priceVariations) {
      if (row[variant]) {
        const cleanValue = String(row[variant]).replace(/[$,]/g, '');
        row.median_listing_price = parseFloat(cleanValue);
        break;
      }
    }
    
    // Find and normalize YoY change
    for (const variant of yoyVariations) {
      if (row[variant]) {
        row.median_listing_price_yoy = row[variant];
        break;
      }
    }
    
    rows.push(row);
  }
  
  console.log('Sample parsed row:', rows[0]);
  return rows;
}

async function processAndStoreCSVData(csvFileId: string, csvText: string, supabase: any) {
  try {
    const rows = parseCSV(csvText);
    console.log(`Processing ${rows.length} rows from CSV`);
    
    // Prepare market data for insertion
    const marketDataRows = rows.map(row => ({
      csv_file_id: csvFileId,
      zip_code: row.zip_code,
      median_value: row.median_listing_price,
      value_change: row.median_listing_price_yoy || '+0.0%',
      area_name: `${row.city || ''} ${row.state || ''}`.trim(),
      raw_data: row
    })).filter(row => row.zip_code && row.median_value);

    console.log(`Valid rows after filtering: ${marketDataRows.length}`);
    
    if (marketDataRows.length === 0) {
      throw new Error(
        'No valid data rows found in CSV. Please ensure your CSV contains columns for: ' +
        'zip_code (or zip/postal_code), median_listing_price (or median_price/price), ' +
        'and optionally median_listing_price_yoy (or yoy_change). ' +
        'Check that numeric values are properly formatted.'
      );
    }

    // Insert market data in batches
    const batchSize = 100;
    for (let i = 0; i < marketDataRows.length; i += batchSize) {
      const batch = marketDataRows.slice(i, i + batchSize);
      const { error } = await supabase
        .from('newsletter_market_data')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting batch:', error);
        throw error;
      }
    }
    
    console.log(`Successfully stored ${marketDataRows.length} market data records`);
    return marketDataRows.length;
  } catch (error) {
    console.error('Error processing CSV data:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get the current user from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Upload to Supabase Storage
    const fileName = `market-data-${Date.now()}-${file.name}`
    const fileBuffer = await file.arrayBuffer()
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('newsletter-csvs')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to upload file: ' + uploadError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Save file metadata to database
    const { data: fileRecord, error: dbError } = await supabase
      .from('newsletter_csv_files')
      .insert({
        filename: fileName,
        file_path: uploadData.path,
        file_size: file.size,
        uploaded_by: user.id
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save file metadata: ' + dbError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Process and store CSV data
    const csvText = new TextDecoder().decode(fileBuffer)
    const processedRows = await processAndStoreCSVData(fileRecord.id, csvText, supabase)

    return new Response(
      JSON.stringify({ 
        success: true, 
        file_id: fileRecord.id,
        filename: fileName,
        file_path: uploadData.path,
        processed_rows: processedRows
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Upload error:', error)
    return new Response(
      JSON.stringify({ error: 'Upload failed: ' + error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

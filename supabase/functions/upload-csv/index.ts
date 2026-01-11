import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Papa from 'https://esm.sh/papaparse@5.4.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Security constants for file validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'];
const MAX_ROWS = 50000;

interface CSVRow {
  zip_code: string;
  median_listing_price: number;
  median_listing_price_mom: string;
  median_listing_price_yoy: string;
  city: string;
  state: string;
  [key: string]: any;
}

/**
 * Sanitize CSV values to prevent formula injection attacks
 * Excel/Sheets formulas start with =, +, -, @, or tab/carriage return
 */
function sanitizeValue(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  
  // Detect and neutralize formula injection attempts
  if (str.match(/^[=+\-@\t\r]/)) {
    // Prefix with single quote to disable formula execution
    return "'" + str;
  }
  
  // Remove null bytes and other control characters
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function parseCSV(csvText: string): CSVRow[] {
  const { data, errors, meta } = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_')
  });
  
  if (errors.length > 0) {
    console.error('CSV parsing errors:', errors);
  }
  
  console.log('CSV Headers found:', meta.fields);
  console.log(`Parsed ${data.length} rows from CSV`);
  console.log('Sample parsed row:', data[0]);
  
  // Map flexible column names with sanitization
  return data.map((row: any) => {
    const mapped: any = {};
    
    // Sanitize all values from the original row
    for (const [key, value] of Object.entries(row)) {
      mapped[key] = typeof value === 'string' ? sanitizeValue(value) : value;
    }
    
    // Find and normalize zip code
    const zipVariations = ['zip_code', 'zip', 'postal_code', 'zipcode'];
    for (const variant of zipVariations) {
      if (row[variant]) {
        const zipValue = String(row[variant]).trim();
        // Validate zip code format (US 5-digit or 5+4)
        if (/^\d{5}(-\d{4})?$/.test(zipValue)) {
          mapped.zip_code = zipValue;
        } else {
          // Try to extract 5 digits
          const digits = zipValue.replace(/\D/g, '').slice(0, 5);
          if (digits.length === 5) {
            mapped.zip_code = digits;
          }
        }
        break;
      }
    }
    
    // Find and normalize median price
    const priceVariations = ['median_listing_price', 'median_listing_price_mm', 'median_list_price', 'median_price', 'median_value', 'price'];
    for (const variant of priceVariations) {
      if (row[variant] !== undefined && row[variant] !== null && row[variant] !== '') {
        const cleanValue = String(row[variant]).replace(/[$,]/g, '');
        const parsed = parseFloat(cleanValue);
        // Validate reasonable price range (avoid injection via extreme values)
        if (!isNaN(parsed) && parsed > 0 && parsed < 100000000) {
          mapped.median_listing_price = parsed;
          break;
        }
      }
    }
    
    // Find and normalize YoY change
    const yoyVariations = ['median_listing_price_yoy', 'median_listing_price_yy', 'yoy_change', 'year_over_year', 'yoy'];
    for (const variant of yoyVariations) {
      if (row[variant] !== undefined && row[variant] !== null) {
        mapped.median_listing_price_yoy = sanitizeValue(String(row[variant]));
        break;
      }
    }
    
    // Find city and state with sanitization
    mapped.city = sanitizeValue(row.city || row.zip_name || row.region_name || '');
    mapped.state = sanitizeValue(row.state || row.state_code || '');
    
    return mapped;
  });
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
      const sampleRow = rows[0] || {};
      throw new Error(
        `No valid data rows found in CSV.\n\n` +
        `Detected columns: ${Object.keys(sampleRow).join(', ')}\n\n` +
        `Required: At least one ZIP column (zip_code, zip, postal_code) ` +
        `and one price column (median_listing_price, median_price, price).\n\n` +
        `Sample row data: ${JSON.stringify(sampleRow, null, 2)}`
      );
    }

    // Insert market data in batches with improved performance
    const batchSize = 1000;
    let totalInserted = 0;

    try {
      for (let i = 0; i < marketDataRows.length; i += batchSize) {
        const batch = marketDataRows.slice(i, i + batchSize);
        const { error } = await supabase
          .from('newsletter_market_data')
          .insert(batch, { count: 'exact' });
        
        if (error) {
          console.error(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error);
          // Cleanup partial inserts on failure
          await supabase.from('newsletter_market_data').delete().eq('csv_file_id', csvFileId);
          throw new Error(`Batch insert failed: ${error.message}. All data rolled back.`);
        }
        
        totalInserted += batch.length;
        console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}: ${totalInserted}/${marketDataRows.length} rows`);
      }
    } catch (error) {
      console.error('Insert failed, cleaning up...');
      throw error;
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

    // SECURITY: Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // SECURITY: Validate file type by MIME type and extension
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.type);
    const isValidExtension = file.name.toLowerCase().endsWith('.csv');
    
    if (!isValidMime && !isValidExtension) {
      return new Response(
        JSON.stringify({ error: 'Only CSV files are allowed' }),
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

    // SECURITY: Pre-parse and validate CSV content before storage
    const fileBuffer = await file.arrayBuffer()
    const csvText = new TextDecoder().decode(fileBuffer)
    
    let parsedRows: CSVRow[];
    try {
      parsedRows = parseCSV(csvText);
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid CSV format: ' + (parseError as Error).message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // SECURITY: Validate row count
    if (parsedRows.length > MAX_ROWS) {
      return new Response(
        JSON.stringify({ error: `CSV exceeds maximum of ${MAX_ROWS} rows. Found: ${parsedRows.length}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // SECURITY: Validate required columns exist with valid data
    const validRows = parsedRows.filter(row => row.zip_code && row.median_listing_price);
    if (validRows.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'CSV must contain zip_code and median_listing_price columns with valid data',
          detected_columns: Object.keys(parsedRows[0] || {}),
          sample_row: parsedRows[0] || null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Upload to Supabase Storage (now validated)
    const fileName = `market-data-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('newsletter-csvs')
      .upload(fileName, fileBuffer, {
        contentType: 'text/csv',
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

    // Process and store CSV data (already validated)
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
      JSON.stringify({ error: 'Upload failed: ' + (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

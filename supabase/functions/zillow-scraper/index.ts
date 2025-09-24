import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZillowData {
  zip_code: string;
  median_home_value: number;
  value_change_1yr: string;
  url: string;
  scraped_at: string;
}

async function scrapeZillowData(zipCode: string): Promise<ZillowData | null> {
  try {
    console.log(`Scraping Zillow data for ZIP ${zipCode}`);
    
    // Construct the Zillow URL
    const zillowUrl = `https://www.zillow.com/home-values/${zipCode}/`;
    
    // Use a web scraping approach
    const response = await fetch(zillowUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch Zillow page: ${response.status}`);
      return null;
    }

    const html = await response.text();
    console.log(`Successfully fetched Zillow page for ZIP ${zipCode}`);

    // Parse the HTML to extract home value data
    // Look for patterns that contain the home value
    const homeValueMatch = html.match(/\$[\d,]+/g);
    const percentageMatch = html.match(/-?\d+\.\d+%/g);
    
    // Try to find the typical home value section
    const typicalValueMatch = html.match(/Typical Home Values[^$]*\$([\d,]+)/i);
    const valueChangeMatch = html.match(/1-year Value Change[^%]*(-?\d+\.\d+)%/i);
    
    let medianValue = 0;
    let valueChange = '0.0%';
    
    if (typicalValueMatch && typicalValueMatch[1]) {
      medianValue = parseInt(typicalValueMatch[1].replace(/,/g, ''));
    } else if (homeValueMatch && homeValueMatch.length > 0) {
      // Use the first reasonable home value found
      const value = homeValueMatch.find(val => {
        const numVal = parseInt(val.replace(/[\$,]/g, ''));
        return numVal > 100000 && numVal < 10000000; // Reasonable range
      });
      if (value) {
        medianValue = parseInt(value.replace(/[\$,]/g, ''));
      }
    }
    
    if (valueChangeMatch && valueChangeMatch[1]) {
      valueChange = `${valueChangeMatch[1]}%`;
    } else if (percentageMatch && percentageMatch.length > 0) {
      valueChange = percentageMatch[0];
    }

    if (medianValue === 0) {
      console.log(`No valid home value found for ZIP ${zipCode}`);
      return null;
    }

    const result: ZillowData = {
      zip_code: zipCode,
      median_home_value: medianValue,
      value_change_1yr: valueChange,
      url: zillowUrl,
      scraped_at: new Date().toISOString()
    };

    console.log(`Successfully scraped data for ZIP ${zipCode}: $${medianValue.toLocaleString()}, ${valueChange}`);
    return result;

  } catch (error) {
    console.error(`Error scraping Zillow data for ZIP ${zipCode}:`, error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { zip_code } = await req.json()
    
    if (!zip_code || !/^\d{5}$/.test(zip_code)) {
      return new Response(
        JSON.stringify({ error: 'Valid 5-digit ZIP code is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log(`Zillow scraper called for ZIP: ${zip_code}`);
    
    // Scrape real data from Zillow
    const zillowData = await scrapeZillowData(zip_code);
    
    if (!zillowData) {
      return new Response(
        JSON.stringify({ 
          error: 'Unable to scrape Zillow data for this ZIP code',
          zip_code 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: zillowData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in Zillow scraper:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

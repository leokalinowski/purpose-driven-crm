import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROK_MODELS = ['grok-2', 'grok-beta', 'grok-3-mini'];

interface MarketData {
  medianValue: number;
  valueChange: string;
  areaName: string;
  source: string;
  lastUpdated: string;
}

async function getMarketDataFromDatabase(zipCode: string): Promise<MarketData | null> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get the most recent active CSV file
    const { data: csvFile } = await supabase
      .from('newsletter_csv_files')
      .select('*')
      .eq('is_active', true)
      .order('upload_date', { ascending: false })
      .limit(1)
      .single()

    if (!csvFile) {
      throw new Error('No active CSV file found. Please upload market data before sending newsletters.')
    }

    // Get market data for the ZIP code from the active CSV
    const { data: marketData } = await supabase
      .from('newsletter_market_data')
      .select('*')
      .eq('zip_code', zipCode)
      .eq('csv_file_id', csvFile.id)
      .single()

    if (!marketData) {
      throw new Error(`No market data found for ZIP code ${zipCode} in uploaded CSV. Please ensure your CSV contains data for this ZIP code.`)
    }

    console.log(`Found market data for ZIP ${zipCode}: $${marketData.median_value}, ${marketData.value_change}`)

    return {
      medianValue: marketData.median_value,
      valueChange: marketData.value_change,
      areaName: marketData.area_name,
      source: `CSV: ${csvFile.filename}`,
      lastUpdated: marketData.created_at
    }
  } catch (error) {
    console.error('Database market data error:', error)
    return null
  }
}

async function generateProfessionalNewsletter(
  zipCode: string,
  marketData: MarketData | null,
  contactInfo: any,
  agentInfo: any
): Promise<string> {
  // CRITICAL: Refuse to generate newsletter without real CSV data
  if (!marketData) {
    throw new Error(`Cannot generate newsletter for ZIP ${zipCode} - no real market data available. Please upload CSV data for this ZIP code first.`);
  }

  try {
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('XAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: `You are a professional real estate market analyst creating personalized newsletters for homeowners.

REAL CSV MARKET DATA FOR ZIP ${zipCode}:
- Median Home Value: $${marketData.medianValue.toLocaleString()}
- 1-Year Change: ${marketData.valueChange}
- Area: ${marketData.areaName}
- Data Source: ${marketData.source}
- Last Updated: ${marketData.lastUpdated}

CRITICAL RULE: USE ONLY THIS EXACT DATA. DO NOT MODIFY, ESTIMATE, OR FABRICATE ANY NUMBERS.
If you cannot create a valuable newsletter with this data, refuse to generate content.

Create a personalized market update email that includes:

1. **Personal Greeting** using recipient's name
2. **Market Overview** with ZIP-specific data (if available)
3. **Key Insights** and local market context
4. **Professional Recommendations**
5. **Call-to-Action** for consultation

Format as clean HTML email content. Keep it concise and professional.`
          },
          {
            role: 'user',
            content: `Generate a comprehensive real estate market report email.

RECIPIENT: ${contactInfo.first_name} ${contactInfo.last_name} (${contactInfo.email})
ADDRESS: ${contactInfo.address}
AGENT: ${agentInfo.agent_name} - ${agentInfo.agent_info}

REAL CSV DATA TO USE:
- Median Home Value: $${marketData.medianValue.toLocaleString()}
- 1-Year Change: ${marketData.valueChange}
- Area: ${marketData.areaName}
- Source: ${marketData.source}
- Last Updated: ${marketData.lastUpdated}

Build your newsletter around this real data with professional analysis and insights.`
          }
        ],
        max_completion_tokens: 3000
      }),
    });

    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();
      console.error(`Grok API error: ${grokResponse.status} - ${errorText}`);
      throw new Error(`Grok API returned ${grokResponse.status}`);
    }

    const grokData = await grokResponse.json();
    return grokData.choices?.[0]?.message?.content || '';

  } catch (error) {
    console.error('Newsletter generation error:', error);
    // Do NOT use fallback templates - throw error to prevent sending emails without real data
    throw error;
  }
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { zip_code, first_name, last_name, email, address, agent_name, agent_info } = await req.json()

    console.log(`Generating newsletter for ZIP: ${zip_code}`);

    // Get real market data from CSV database
    const marketData = await getMarketDataFromDatabase(zip_code);

    console.log(`Market data lookup result for ZIP ${zip_code}:`, marketData ? 'Found data' : 'No data found');
    
    // Generate professional newsletter with Grok
    const emailContent = await generateProfessionalNewsletter(
      zip_code,
      marketData,
      { first_name, last_name, email, address },
      { agent_name, agent_info }
    );
    
    return new Response(
      JSON.stringify({ 
        success: true,
        zip_code,
        html_email: emailContent,
        real_data: marketData ? {
          median_value: marketData.medianValue,
          value_change: marketData.valueChange,
          area_name: marketData.areaName,
          source: marketData.source,
          last_updated: marketData.lastUpdated
        } : null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Function error',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
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
      Deno.env.get('SUPABASE_ANON_KEY')!
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
      console.log('No active CSV file found')
      return null
    }

    // Get market data for the ZIP code from the active CSV
    const { data: marketData } = await supabase
      .from('newsletter_market_data')
      .select('*')
      .eq('zip_code', zipCode)
      .eq('csv_file_id', csvFile.id)
      .single()

    if (!marketData) {
      console.log(`No market data found for ZIP ${zipCode}`)
      return null
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

${marketData ? `
REAL MARKET DATA FROM CSV:
- ZIP Code: ${zipCode}
- Median Home Value: $${marketData.medianValue.toLocaleString()}
- 1-Year Change: ${marketData.valueChange}
- Area: ${marketData.areaName}
- Data Source: ${marketData.source}
- Last Updated: ${marketData.lastUpdated}

USE THIS EXACT DATA - DO NOT MODIFY THESE NUMBERS
` : `
NO REAL DATA AVAILABLE - CREATE GENERAL MARKET UPDATE WITHOUT SPECIFIC NUMBERS
`}

Create a comprehensive, professional real estate newsletter that includes:

1. **Market Overview Section** with real data (if available)
2. **Detailed Market Analysis Table** with metrics
3. **Local Market Trends** and insights
4. **What This Means for Homeowners** section
5. **Professional Recommendations**
6. **Strong Call-to-Action** for the agent

Format as clean HTML with professional headings, tables, and clear sections.`
          },
          {
            role: 'user',
            content: `Generate a comprehensive real estate market report email.

RECIPIENT: ${contactInfo.first_name} ${contactInfo.last_name} (${contactInfo.email})
ADDRESS: ${contactInfo.address}
AGENT: ${agentInfo.agent_name} - ${agentInfo.agent_info}

${marketData ? `
REAL CSV DATA TO USE:
- Median Home Value: $${marketData.medianValue.toLocaleString()}
- 1-Year Change: ${marketData.valueChange}
- Area: ${marketData.areaName}
- Source: ${marketData.source}
- Last Updated: ${marketData.lastUpdated}

Build your newsletter around this real data with professional analysis.` : `
Create a general market update without specific numbers since no real data is available.`
}
`
          }
        ],
        max_completion_tokens: 4000
      }),
    });

    if (!grokResponse.ok) {
      throw new Error(`Grok API error: ${grokResponse.status}`);
    }

    const grokData = await grokResponse.json();
    return grokData.choices?.[0]?.message?.content || '';

  } catch (error) {
    console.error('Newsletter generation error:', error);
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
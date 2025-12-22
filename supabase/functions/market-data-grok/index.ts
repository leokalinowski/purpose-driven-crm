import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROK_MODELS = ['grok-4-1-fast-reasoning'];

interface MarketData {
  // Core metrics
  medianValue: number;
  valueChange: string;
  areaName: string;
  source: string;
  lastUpdated: string;
  
  // Inventory & Supply Metrics
  activeListings: number;
  activeListingsChange: string;
  newListings: number;
  totalListings: number;
  
  // Market Velocity Indicators
  medianDaysOnMarket: number;
  daysOnMarketChange: string;
  pendingListings: number;
  pendingRatio: number;
  
  // Pricing Intelligence
  averageListingPrice: number;
  pricePerSquareFoot: number;
  pricePerSqFtChange: string;
  
  // Market Pressure Indicators
  priceReducedCount: number;
  priceReducedShare: number;
  priceIncreasedCount: number;
  
  // Property Characteristics
  medianSquareFeet: number;
  
  // Period identifier
  monthDate: string;
}

function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
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

    // Extract comprehensive data from raw_data JSONB
    const rawData = marketData.raw_data || {};
    
    return {
      // Core metrics
      medianValue: marketData.median_value,
      valueChange: marketData.value_change,
      areaName: marketData.area_name,
      source: 'Realtor.com Monthly Housing Inventory Data',
      lastUpdated: marketData.created_at,
      
      // Inventory & Supply Metrics
      activeListings: rawData.active_listing_count || 0,
      activeListingsChange: formatPercentage(rawData.active_listing_count_yy),
      newListings: rawData.new_listing_count || 0,
      totalListings: rawData.total_listing_count || 0,
      
      // Market Velocity Indicators
      medianDaysOnMarket: rawData.median_days_on_market || 0,
      daysOnMarketChange: formatPercentage(rawData.median_days_on_market_yy),
      pendingListings: rawData.pending_listing_count || 0,
      pendingRatio: rawData.pending_ratio || 0,
      
      // Pricing Intelligence
      averageListingPrice: rawData.average_listing_price || 0,
      pricePerSquareFoot: rawData.median_listing_price_per_square_foot || 0,
      pricePerSqFtChange: formatPercentage(rawData.median_listing_price_per_square_foot_yy),
      
      // Market Pressure Indicators
      priceReducedCount: rawData.price_reduced_count || 0,
      priceReducedShare: rawData.price_reduced_share || 0,
      priceIncreasedCount: rawData.price_increased_count || 0,
      
      // Property Characteristics
      medianSquareFeet: rawData.median_square_feet || 0,
      
      // Period identifier
      monthDate: rawData.month_date_yyyymm || ''
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

  const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
  if (!XAI_API_KEY) {
    console.error('XAI_API_KEY is not configured');
    throw new Error('XAI_API_KEY environment variable is not set. Please configure it in Supabase secrets.');
  }

  console.log('XAI_API_KEY status: configured ✓');
  console.log(`Calling Grok API for ZIP ${zipCode}`);

  try {
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-reasoning',
        messages: [
          {
            role: 'system',
            content: `You are a professional real estate market analyst creating personalized, data-driven newsletters for homeowners.

COMPREHENSIVE MARKET DATA FOR ZIP ${zipCode} (${marketData.areaName}):

📊 PRICING METRICS:
- Median Home Value: $${marketData.medianValue.toLocaleString()}
- 1-Year Change: ${marketData.valueChange}
- Average Listing Price: $${marketData.averageListingPrice.toLocaleString()}
- Price per Square Foot: $${marketData.pricePerSquareFoot} (${marketData.pricePerSqFtChange} YoY)
- Median Property Size: ${marketData.medianSquareFeet} sq ft

📈 INVENTORY & SUPPLY:
- Active Listings: ${marketData.activeListings} (${marketData.activeListingsChange} YoY)
- New Listings: ${marketData.newListings}
- Total Market Inventory: ${marketData.totalListings}

⚡ MARKET VELOCITY & DEMAND:
- Median Days on Market: ${marketData.medianDaysOnMarket} days (${marketData.daysOnMarketChange} YoY)
- Pending Sales: ${marketData.pendingListings}
- Pending Ratio: ${(marketData.pendingRatio * 100).toFixed(1)}% (buyer demand indicator)

💰 PRICE PRESSURE INDICATORS:
- Listings with Price Reductions: ${marketData.priceReducedCount} (${(marketData.priceReducedShare * 100).toFixed(1)}% of market)
- Listings with Price Increases: ${marketData.priceIncreasedCount}

📅 Data Period: ${marketData.monthDate}
📋 Data Source: ${marketData.source}
🕒 Last Updated: ${new Date(marketData.lastUpdated).toLocaleDateString()}

CRITICAL INSTRUCTIONS:
1. USE ONLY THIS EXACT DATA - DO NOT FABRICATE OR ESTIMATE ANY NUMBERS
2. Analyze these metrics holistically to determine market conditions:
   - Is it a seller's market, buyer's market, or balanced?
   - Are homes selling quickly (low days on market) or slowly?
   - Is inventory tight (low listings) or abundant?
   - Are buyers competing (high pending ratio) or hesitant?
   - Are sellers confident (price increases) or desperate (price reductions)?

3. Provide SPECIFIC, ACTIONABLE recommendations based on the data:
   - For SELLERS: When to list, pricing strategy, market timing based on days on market and inventory
   - For BUYERS: Negotiation opportunities based on price reduction rates, competition level from pending ratio
   - For HOMEOWNERS: Property value trends, market timing insights

4. Connect multiple metrics to tell a compelling market story - don't just list numbers

5. Email structure:
   - Personal Greeting using recipient name
   - Market Overview (3-4 key headline metrics)
   - Deep Market Analysis (connect data points to reveal insights about market conditions)
   - Actionable Recommendations (specific, data-driven advice tailored to market conditions)
   - Clear Call-to-Action for consultation

Format as clean, professional HTML email. Be conversational but authoritative. Show expertise through data interpretation.`
          },
          {
            role: 'user',
            content: `Generate a highly valuable real estate market analysis email.

RECIPIENT: ${contactInfo.first_name} ${contactInfo.last_name}
ADDRESS: ${contactInfo.address}
AGENT: ${agentInfo.agent_name}
CONTACT: ${agentInfo.agent_info}

ANALYSIS REQUIREMENTS:
1. Start with warm, personalized greeting to ${contactInfo.first_name}
2. Present 3-4 headline metrics that tell the market story (choose the most impactful ones)
3. Provide deep analysis connecting:
   - Price trends (${marketData.valueChange} change) + inventory levels (${marketData.activeListings} active)
   - Days on market (${marketData.medianDaysOnMarket} days) + pending ratio (${(marketData.pendingRatio * 100).toFixed(0)}%)
   - Price reduction patterns (${(marketData.priceReducedShare * 100).toFixed(0)}% of listings) + overall demand
4. Give SPECIFIC recommendations with numbers:
   - Example: "With ${marketData.medianDaysOnMarket} days average market time and ${(marketData.pendingRatio * 100).toFixed(0)}% pending ratio, sellers should..."
   - Example: "The ${(marketData.priceReducedShare * 100).toFixed(0)}% price reduction rate indicates buyers can..."
5. End with clear, compelling call-to-action
6. Professional signature with agent contact details

Make this newsletter valuable enough that ${contactInfo.first_name} would save and reference it when making real estate decisions.`
          }
        ],
        max_completion_tokens: 3000
      }),
    });

    console.log(`Grok API response status: ${grokResponse.status}`);

    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();
      console.error(`Grok API error: ${grokResponse.status} - ${errorText}`);
      
      if (grokResponse.status === 404) {
        throw new Error('Grok API endpoint not found (404). The API endpoint or model may have changed. Please check X.AI documentation.');
      } else if (grokResponse.status === 401) {
        throw new Error('Grok API authentication failed (401). Please verify your XAI_API_KEY is correct.');
      } else {
        throw new Error(`Grok API returned ${grokResponse.status}: ${errorText}`);
      }
    }

    const grokData = await grokResponse.json();
    let emailContent = grokData.choices?.[0]?.message?.content || '';
    
    // Add compliance footer
    const complianceFooter = `
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; line-height: 1.6;">
  <p><strong>Data Source:</strong> ${marketData.source}</p>
  <p><strong>Disclaimer:</strong> This market analysis is provided for informational purposes only and should not be construed as financial, legal, or investment advice. Market data reflects past performance and may not be indicative of future results. Individual property values may vary significantly based on condition, location, and other factors.</p>
  <p><strong>License Information:</strong> ${agentInfo.agent_name} | ${agentInfo.agent_info}</p>
  <p style="margin-top: 10px; font-size: 10px;">© ${new Date().getFullYear()} ${agentInfo.agent_name}. All rights reserved.</p>
</div>
`;
    
    emailContent = emailContent + complianceFooter;
    return emailContent;

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
          last_updated: marketData.lastUpdated,
          // Include key metrics for preview
          active_listings: marketData.activeListings,
          median_days_on_market: marketData.medianDaysOnMarket,
          pending_ratio: marketData.pendingRatio,
          price_reduced_share: marketData.priceReducedShare,
          price_per_sqft: marketData.pricePerSquareFoot
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
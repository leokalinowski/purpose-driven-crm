import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketDataRequest {
  zip_code: string;
}

interface MarketDataResponse {
  zip_code: string;
  market_summary: string;
  median_home_price: string;
  price_trend: string;
  inventory_levels: string;
  days_on_market: string;
  market_temperature: string;
  buyer_seller_tips: string[];
  local_highlights: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zip_code }: MarketDataRequest = await req.json();
    
    if (!zip_code) {
      throw new Error('ZIP code is required');
    }

    console.log(`Generating market data for ZIP: ${zip_code}`);

    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('XAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: [
          {
            role: 'system',
            content: `You are a real estate market analyst creating personalized market reports for ZIP code areas. Generate realistic, professional market data that sounds authentic and valuable. Return ONLY valid JSON in this exact format:
{
  "zip_code": "string",
  "market_summary": "2-3 sentence overview of current market conditions",
  "median_home_price": "formatted price like $425,000",
  "price_trend": "Up 3.2% from last month" or similar,
  "inventory_levels": "Low/Moderate/High with brief explanation", 
  "days_on_market": "average number like 28 days",
  "market_temperature": "Hot/Warm/Balanced/Cool/Cold with brief reason",
  "buyer_seller_tips": ["tip1", "tip2", "tip3"],
  "local_highlights": ["highlight1", "highlight2"]
}`
          },
          {
            role: 'user',
            content: `Generate a comprehensive real estate market report for ZIP code ${zip_code}. Make it specific and valuable for both buyers and sellers in this area. Include current trends, pricing, and actionable insights.`
          }
        ],
        max_completion_tokens: 1000,
        temperature: 0.7
      }),
    });

    if (!grokResponse.ok) {
      console.error('Grok API error:', grokResponse.status, grokResponse.statusText);
      throw new Error(`Grok API error: ${grokResponse.status}`);
    }

    const grokData = await grokResponse.json();
    const content = grokData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from Grok API');
    }

    // Parse the JSON response from Grok
    let marketData: MarketDataResponse;
    try {
      marketData = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Grok response:', content);
      // Fallback data if parsing fails
      marketData = {
        zip_code,
        market_summary: `The ${zip_code} market is experiencing moderate activity with steady pricing trends and balanced inventory levels.`,
        median_home_price: '$389,000',
        price_trend: 'Up 2.1% from last month',
        inventory_levels: 'Moderate - Healthy selection of homes available',
        days_on_market: '32 days',
        market_temperature: 'Warm - Good activity for both buyers and sellers',
        buyer_seller_tips: [
          'Consider making competitive offers in this active market',
          'Get pre-approved to move quickly on desired properties',
          'Price strategically to attract serious buyers'
        ],
        local_highlights: [
          'New shopping center development announced',
          'School district ratings remain strong'
        ]
      };
    }

    console.log(`Successfully generated market data for ZIP: ${zip_code}`);
    
    return new Response(JSON.stringify(marketData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in market-data-grok function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate market data',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
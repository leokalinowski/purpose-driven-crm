import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  zip_code: string;
  first_name: string;
  last_name: string;
  email: string;
  address: string;
  agent_name: string;
  agent_info: string;
}

interface EmailResponse {
  zip_code: string;
  html_email: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      zip_code,
      first_name,
      last_name,
      email,
      address,
      agent_name,
      agent_info
    }: EmailRequest = await req.json();

    if (!zip_code || !first_name || !last_name || !email || !address || !agent_name || !agent_info) {
      throw new Error('All personalization fields and ZIP code are required');
    }

    console.log(`Generating personalized market report email for ZIP: ${zip_code} and recipient: ${first_name} ${last_name}`);

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
            content: `You are a professional real estate market analyst specializing in creating personalized, insightful monthly newsletters for homeowners. Your goal is to provide valuable, data-driven content that helps recipients understand their local market, spot trends, and make informed decisions. ALWAYS use real-time data fetched via web searches and page browsing from reliable sources like Zillow, Redfin, Homes.com, and official MLS sites. NEVER simulate, estimate, guess, or use placeholder data—only include verifiable facts from online research. If specific data is unavailable, state "Data not available at this time" without fabricating.

Output ONLY a single string containing the full, mobile-responsive HTML for the email body (no JSON, no extra text). Use inline CSS for compatibility with email clients (e.g., tables for layout, sans-serif fonts). Make the content engaging, professional, and concise (800-1200 words max).

Structure the HTML email as follows, with flexibility to customize based on discovered data (e.g., add subsections for emerging trends or local events if relevant):
- <html><body> wrapper with basic styles (e.g., font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;).
- Subject line suggestion as a comment at the top (e.g., <!-- Subject: Your September 2025 Market Update for ZIP ${zip_code} -->).
- Introduction: Personalized greeting (e.g., "Dear ${first_name} ${last_name},") followed by 2-3 sentences overviewing the market in ${zip_code} (include city/state from research), referencing the recipient's address (${address}) and how trends might affect their property.
- Data Tables: Use <table> for key metrics, e.g.:
  - Median Prices: Columns for Metric (e.g., Median Listing Price, Median Sale Price, Price per Sq Ft), Value, YoY Change, Notes.
  - Inventory Metrics: Active Listings, Months of Supply, New/Pending Listings.
  - Averages: Average Days on Market, Absorption Rate.
  - Recent Transactions: Bullet list or table of anonymized examples (e.g., "2-bed condo sold for $500K in August").
- Analysis/Trends: 3-4 paragraphs narrating trends (e.g., YoY price changes, buyer/seller balance, economic factors like interest rates or local developments). Compare to nearby ZIPs if data shows value. Highlight any new important info (e.g., new infrastructure or market shifts).
- Takeaways: Bullet list of 4-6 actionable insights for buyers/sellers (e.g., "With inventory rising, negotiate aggressively if buying.").
- Call to Action: Encourage response (e.g., "Reply or schedule a call at [agent's link] for a free valuation of your home at ${address}.").
- Footer: Sign off with agent's name and info (${agent_name}, ${agent_info}). Include unsubscribe note and privacy compliance.

Ensure the email is unique based on real data and personalization, adding value like "Based on recent Redfin data, your area in ${zip_code} is seeing increased demand due to [specific trend]."`
          },
          {
            role: 'user',
            content: `Generate a personalized real estate market report email for ZIP code ${zip_code}. Recipient: ${first_name} ${last_name}, Email: ${email}, Address: ${address}. Agent: ${agent_name}, Agent Info: ${agent_info}. Use real-time data from Zillow, Redfin, Homes.com, and MLS—perform web searches and browse pages as needed to fetch current metrics, trends, and insights.`
          }
        ],
        max_completion_tokens: 2000
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

    // Since output is pure HTML string, no parsing needed
    const emailData: EmailResponse = {
      zip_code,
      html_email: content
    };

    console.log(`Successfully generated personalized email for ZIP: ${zip_code}`);
    
    return new Response(JSON.stringify(emailData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in market-data-grok function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate market report email',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
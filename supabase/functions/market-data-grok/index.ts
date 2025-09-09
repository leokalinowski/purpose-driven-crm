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
  retry_attempt?: number;
  model?: string;
}

interface EmailResponse {
  zip_code: string;
  html_email: string;
  success: boolean;
  retry_attempt?: number;
  model_used?: string;
}

interface ErrorResponse {
  zip_code: string;
  success: false;
  error: string;
  retry_attempt: number;
  model_used: string;
  retryable: boolean;
}

const GROK_MODELS = ['grok-2-1212', 'grok-beta', 'grok-2'];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: any): boolean {
  // Rate limit, timeout, or temporary server errors are retryable
  const status = error.status || error.response?.status;
  return status === 429 || status === 503 || status === 502 || status >= 500;
}

async function generateEmailWithGrok(
  requestData: EmailRequest,
  model: string,
  attempt: number
): Promise<EmailResponse | ErrorResponse> {
  const {
    zip_code,
    first_name,
    last_name,
    email,
    address,
    agent_name,
    agent_info
  } = requestData;

  console.log(`Attempt ${attempt} - Generating email for ZIP: ${zip_code}, Model: ${model}`);

  try {
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('XAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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
- Call to Action: End with a warm invitation to connect (e.g., "If you have any questions about your local market or are considering making a move, I'd love to help you navigate these exciting opportunities.").

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
      const errorText = await grokResponse.text();
      console.error(`Grok API error (${model}):`, grokResponse.status, errorText);
      
      return {
        zip_code,
        success: false,
        error: `Grok API error: ${grokResponse.status} - ${errorText}`,
        retry_attempt: attempt,
        model_used: model,
        retryable: isRetryableError({ status: grokResponse.status })
      };
    }

    const grokData = await grokResponse.json();
    const content = grokData.choices?.[0]?.message?.content;
    
    if (!content) {
      return {
        zip_code,
        success: false,
        error: 'No content received from Grok API',
        retry_attempt: attempt,
        model_used: model,
        retryable: false
      };
    }

    console.log(`Successfully generated email for ZIP: ${zip_code} using ${model}`);
    
    return {
      zip_code,
      html_email: content,
      success: true,
      retry_attempt: attempt,
      model_used: model
    };

  } catch (error) {
    console.error(`Error generating email with ${model}:`, error);
    
    return {
      zip_code,
      success: false,
      error: error.message,
      retry_attempt: attempt,
      model_used: model,
      retryable: isRetryableError(error)
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: EmailRequest = await req.json();
    const {
      zip_code,
      first_name,
      last_name,
      email,
      address,
      agent_name,
      agent_info,
      retry_attempt = 1,
      model
    } = requestData;

    if (!zip_code || !first_name || !last_name || !email || !address || !agent_name || !agent_info) {
      throw new Error('All personalization fields and ZIP code are required');
    }

    // Use specified model or default sequence
    const modelToUse = model || GROK_MODELS[0];
    
    // Add exponential backoff delay for retries
    if (retry_attempt > 1) {
      const delay_ms = Math.pow(2, retry_attempt - 1) * 1000; // 1s, 2s, 4s...
      console.log(`Retry attempt ${retry_attempt}, waiting ${delay_ms}ms`);
      await delay(delay_ms);
    }

    const result = await generateEmailWithGrok(requestData, modelToUse, retry_attempt);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 500
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
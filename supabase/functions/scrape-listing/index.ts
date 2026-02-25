import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Firecrawl not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'AI gateway not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Scrape the URL with Firecrawl
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping listing URL:', formattedUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(JSON.stringify({ success: false, error: 'Failed to scrape listing page' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    if (!markdown) {
      return new Response(JSON.stringify({ success: false, error: 'No content found on page' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Extract structured data using Lovable AI with tool calling
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You extract real estate listing data from scraped web pages. Extract the property details accurately.'
          },
          {
            role: 'user',
            content: `Extract the property listing details from this page content:\n\n${markdown.substring(0, 8000)}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_listing',
            description: 'Extract structured listing data from a property page',
            parameters: {
              type: 'object',
              properties: {
                price: { type: 'string', description: 'Listed price formatted with $ and commas, e.g. "$475,000"' },
                address: { type: 'string', description: 'Street address only, e.g. "123 Oak Street"' },
                city: { type: 'string', description: 'City and state, e.g. "Austin, TX"' },
                beds: { type: 'number', description: 'Number of bedrooms' },
                baths: { type: 'number', description: 'Number of bathrooms' },
                sqft: { type: 'string', description: 'Square footage formatted with commas, e.g. "1,850"' },
                image_url: { type: 'string', description: 'URL of the main property photo if found, or empty string' },
              },
              required: ['price', 'address', 'city', 'beds', 'baths', 'sqft'],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_listing' } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        const t = await aiResponse.text();
        console.error('AI rate limited:', t);
        return new Response(JSON.stringify({ success: false, error: 'AI rate limited, try again shortly' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        const t = await aiResponse.text();
        console.error('AI credits exhausted:', t);
        return new Response(JSON.stringify({ success: false, error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);

      // Fallback to regex extraction
      const listing = regexExtract(markdown, formattedUrl);
      if (listing) {
        return new Response(JSON.stringify({ success: true, listing }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Failed to extract listing data' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      // Fallback to regex
      const listing = regexExtract(markdown, formattedUrl);
      if (listing) {
        return new Response(JSON.stringify({ success: true, listing }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: false, error: 'Could not extract listing data' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // Try to get image from scrape metadata if AI didn't find one
    let imageUrl = extracted.image_url || '';
    if (!imageUrl) {
      const ogImage = scrapeData.data?.metadata?.ogImage || scrapeData.metadata?.ogImage;
      if (ogImage) imageUrl = ogImage;
    }

    const listing = {
      image_url: imageUrl,
      price: extracted.price || 'N/A',
      address: extracted.address || 'Unknown Address',
      city: extracted.city || '',
      beds: extracted.beds || 0,
      baths: extracted.baths || 0,
      sqft: extracted.sqft || 'N/A',
    };

    console.log('Successfully extracted listing:', listing.address);

    return new Response(JSON.stringify({ success: true, listing }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('scrape-listing error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function regexExtract(markdown: string, url: string): Record<string, any> | null {
  try {
    const priceMatch = markdown.match(/\$[\d,]+(?:\.\d{2})?/);
    const bedsMatch = markdown.match(/(\d+)\s*(?:bed|bd|bedroom)/i);
    const bathsMatch = markdown.match(/(\d+(?:\.\d)?)\s*(?:bath|ba|bathroom)/i);
    const sqftMatch = markdown.match(/([\d,]+)\s*(?:sq\s*ft|sqft|square\s*feet)/i);

    if (!priceMatch) return null;

    return {
      image_url: '',
      price: priceMatch[0],
      address: 'Property Listing',
      city: '',
      beds: bedsMatch ? parseInt(bedsMatch[1]) : 0,
      baths: bathsMatch ? parseFloat(bathsMatch[1]) : 0,
      sqft: sqftMatch ? sqftMatch[1] : 'N/A',
    };
  } catch {
    return null;
  }
}

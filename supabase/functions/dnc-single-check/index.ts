import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

interface DNCApiResponse {
  nationalDNC: boolean;
  stateDNC: boolean; 
  dma: boolean;
  litigator: boolean;
  isDNC: boolean;
  success: boolean;
}

function parseXMLResponse(xmlText: string): DNCApiResponse {
  const nationalDNC = xmlText.includes('<national_dnc>Y</national_dnc>');
  const stateDNC = xmlText.includes('<state_dnc>Y</state_dnc>');
  const dma = xmlText.includes('<dma>Y</dma>');
  const litigator = xmlText.includes('<litigator>Y</litigator>');
  const success = xmlText.includes('<RESPONSECODE>OK</RESPONSECODE>');
  
  const isDNC = nationalDNC || stateDNC || dma || litigator;
  
  return { nationalDNC, stateDNC, dma, litigator, isDNC, success };
}

async function fetchWithRetry(url: string, maxRetries = 1): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) return response;
      if (attempt < maxRetries) {
        console.warn(`DNC API attempt ${attempt + 1} failed (${response.status}), retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw new Error(`DNC API request failed: ${response.status}`);
    } catch (error) {
      if (attempt < maxRetries && (error as Error).name !== 'AbortError') {
        console.warn(`DNC API attempt ${attempt + 1} error, retrying...`, error);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('DNC API request failed after retries');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, contactId } = await req.json();

    if (!phone || !contactId) {
      return new Response(
        JSON.stringify({ error: 'Phone number and contact ID are required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify JWT - caller must be authenticated
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller identity
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the contact belongs to this user (RLS will enforce this too, but explicit check)
    const { data: contactData, error: contactError } = await supabase
      .from('contacts')
      .select('id, agent_id')
      .eq('id', contactId)
      .single();

    if (contactError || !contactData) {
      return new Response(
        JSON.stringify({ error: 'Contact not found or access denied', success: false }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get DNC API key
    const dncApiKey = Deno.env.get('DNC_API_KEY');
    if (!dncApiKey) {
      console.error('DNC_API_KEY not found in environment variables');
      return new Response(
        JSON.stringify({ error: 'DNC API key not configured', success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
    const phoneDigits = phone.replace(/\D/g, '');
    let normalizedPhone = phoneDigits;
    
    if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) {
      normalizedPhone = phoneDigits.substring(1);
    } else if (phoneDigits.length === 10) {
      normalizedPhone = phoneDigits;
    } else {
      console.error(`Invalid phone format: ${phone} (${phoneDigits.length} digits)`);
      return new Response(
        JSON.stringify({ error: `Phone must be 10 or 11 digits, got ${phoneDigits.length}`, success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking DNC for contact ${contactId}, phone: ${normalizedPhone}`);

    // Call DNC API with retry and timeout
    const dncApiUrl = `https://api.realvalidation.com/rpvWebService/DNCLookup.php?phone=${normalizedPhone}&token=${dncApiKey}`;
    
    const dncResponse = await fetchWithRetry(dncApiUrl);
    const xmlResponse = await dncResponse.text();
    console.log(`DNC API Response: ${xmlResponse}`);

    const result = parseXMLResponse(xmlResponse);
    console.log(`DNC Result:`, { contactId, isDNC: result.isDNC, success: result.success });

    if (!result.success) {
      // Don't update dnc_last_checked on API failure
      throw new Error('DNC API returned error response');
    }

    // Update contact - only set dnc_last_checked on successful check
    const { data: updateData, error: updateError } = await supabase
      .from('contacts')
      .update({ 
        dnc: result.isDNC,
        dnc_last_checked: new Date().toISOString()
      })
      .eq('id', contactId)
      .select();

    if (updateError) {
      console.error('Failed to update contact DNC status:', updateError);
      throw new Error('Failed to update contact DNC status');
    }

    if (!updateData || updateData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Contact not found or access denied', success: false }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, contactId, phone, isDNC: result.isDNC,
        nationalDNC: result.nationalDNC, stateDNC: result.stateDNC,
        dma: result.dma, litigator: result.litigator
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('DNC check error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

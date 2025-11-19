import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  
  return {
    nationalDNC,
    stateDNC,
    dma,
    litigator,
    isDNC,
    success
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, contactId } = await req.json();

    if (!phone || !contactId) {
      return new Response(
        JSON.stringify({ 
          error: 'Phone number and contact ID are required',
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get DNC API key from environment
    const dncApiKey = Deno.env.get('DNC_API_KEY');
    if (!dncApiKey) {
      console.error('DNC_API_KEY not found in environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'DNC API key not configured',
          success: false 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Normalize phone number (handle both 10 and 11 digit formats)
    const phoneDigits = phone.replace(/\D/g, '');
    let normalizedPhone = phoneDigits;
    
    if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) {
      normalizedPhone = phoneDigits.substring(1); // Remove US country code
    } else if (phoneDigits.length === 10) {
      normalizedPhone = phoneDigits; // Already 10 digits
    } else {
      console.error(`Invalid phone format: ${phone} (${phoneDigits.length} digits after normalization)`);
      return new Response(
        JSON.stringify({ 
          error: `Phone number must be 10 or 11 digits, got ${phoneDigits.length} digits`,
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Checking DNC status for contact ${contactId}, phone: ${phone} (normalized: ${normalizedPhone})`);

    // Call the DNC API with normalized phone (corrected endpoint)
    const dncApiUrl = `https://api.realvalidation.com/rpvWebService/DNCLookup.php?phone=${normalizedPhone}&token=${dncApiKey}`;
    
    console.log(`Calling DNC API: ${dncApiUrl.replace(dncApiKey, 'REDACTED')}`);
    
    const dncResponse = await fetch(dncApiUrl);
    if (!dncResponse.ok) {
      console.error(`DNC API HTTP Error: ${dncResponse.status} - ${dncResponse.statusText}`);
      throw new Error(`DNC API request failed: ${dncResponse.status}`);
    }

    const xmlResponse = await dncResponse.text();
    console.log(`DNC API Raw XML Response: ${xmlResponse}`);

    const result = parseXMLResponse(xmlResponse);
    console.log(`DNC Check Parsed Result:`, {
      contactId,
      phone: normalizedPhone,
      nationalDNC: result.nationalDNC,
      stateDNC: result.stateDNC,
      dma: result.dma,
      litigator: result.litigator,
      isDNC: result.isDNC,
      success: result.success
    });

    if (!result.success) {
      throw new Error('DNC API returned error response');
    }

    // Create Supabase client with user's JWT (RLS enforced)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      },
    });

    // Update the contact's DNC status with RLS enforced
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

    // Check if update actually affected any rows (RLS check)
    if (!updateData || updateData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Contact not found or access denied',
          success: false 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (result.isDNC) {
      console.log(`Flagged contact ${contactId} (phone: ${phone}) as DNC`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        contactId,
        phone,
        isDNC: result.isDNC,
        nationalDNC: result.nationalDNC,
        stateDNC: result.stateDNC,
        dma: result.dma,
        litigator: result.litigator
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('DNC check error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
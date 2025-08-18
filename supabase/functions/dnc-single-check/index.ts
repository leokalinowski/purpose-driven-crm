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

    console.log(`Checking DNC status for contact ${contactId}, phone: ${phone}`);

    // Call the DNC API
    const dncApiUrl = `https://www.realvalidation.com/api/realvalidation.php?customer=${dncApiKey}&phone=${phone}`;
    
    const dncResponse = await fetch(dncApiUrl);
    if (!dncResponse.ok) {
      throw new Error(`DNC API request failed: ${dncResponse.status}`);
    }

    const xmlResponse = await dncResponse.text();
    console.log(`DNC API Response: ${xmlResponse}`);

    const result = parseXMLResponse(xmlResponse);
    console.log(`DNC Check Result: nationalDNC=${result.nationalDNC}, stateDNC=${result.stateDNC}, dma=${result.dma}, litigator=${result.litigator}, isDNC=${result.isDNC}`);

    if (!result.success) {
      throw new Error('DNC API returned error response');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update the contact's DNC status
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ 
        dnc: result.isDNC,
        dnc_last_checked: new Date().toISOString()
      })
      .eq('id', contactId);

    if (updateError) {
      console.error('Failed to update contact DNC status:', updateError);
      throw new Error('Failed to update contact DNC status');
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
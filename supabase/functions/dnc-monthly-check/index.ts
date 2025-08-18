import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseXMLResponse(xmlText: string): DNCApiResponse {
  try {
    // Helper function to extract XML tag content using regex
    const getTagContent = (tagName: string): string | null => {
      const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'i');
      const match = xmlText.match(regex);
      return match ? match[1].trim() : null;
    };

    // Log the raw response for debugging
    console.log('DNC API Response:', xmlText);

    const responseCode = getTagContent('RESPONSECODE');
    
    if (responseCode !== 'OK') {
      const responseMsg = getTagContent('RESPONSEMSG') || 'Unknown error';
      return {
        isOK: false,
        isDNC: false,
        error: `API Response: ${responseCode} - ${responseMsg}`,
        rawResponse: xmlText
      };
    }

    // Check DNC flags - flag as DNC if ANY of these are "Y"
    const nationalDNC = getTagContent('national_dnc') === 'Y';
    const stateDNC = getTagContent('state_dnc') === 'Y';
    const dma = getTagContent('dma') === 'Y';
    const litigator = getTagContent('litigator') === 'Y';
    
    const isDNC = nationalDNC || stateDNC || dma || litigator;

    console.log(`DNC Check Result: nationalDNC=${nationalDNC}, stateDNC=${stateDNC}, dma=${dma}, litigator=${litigator}, isDNC=${isDNC}`);

    return {
      isOK: true,
      isDNC,
      rawResponse: xmlText
    };
  } catch (error) {
    console.error('XML parsing error:', error);
    return {
      isOK: false,
      isDNC: false,
      error: `XML parsing failed: ${error.message}`,
      rawResponse: xmlText
    };
  }
}

interface Contact {
  id: string;
  phone: string | null;
  agent_id: string;
}

interface DNCApiResponse {
  isOK: boolean;
  isDNC: boolean;
  error?: string;
  rawResponse?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse request body to check for force recheck
  let requestData = {};
  try {
    const body = await req.text();
    if (body) {
      requestData = JSON.parse(body);
    }
  } catch (error) {
    console.log('No JSON body provided, using defaults');
  }

  const forceRecheck = (requestData as any)?.forceRecheck || false;
  console.log(`Starting DNC check automation... Force recheck: ${forceRecheck}`);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const dncApiKey = Deno.env.get('DNC_API_KEY');
    
    if (!dncApiKey) {
      throw new Error('DNC_API_KEY not configured');
    }

    console.log(`Using DNC API Key: ${dncApiKey.substring(0, 8)}...${dncApiKey.substring(dncApiKey.length - 4)}`);
    
    // Test API with the provided phone number
    console.log('Testing API with phone 4432201181...');
    try {
      const testResponse = await fetch(`https://api.realvalidation.com/rpvWebService/DNCLookup.php?phone=4432201181&token=${dncApiKey}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Real Estate DNC Checker/1.0'
        }
      });
      
      if (testResponse.ok) {
        const testXml = await testResponse.text();
        console.log('Test API Response:', testXml);
        const testResult = parseXMLResponse(testXml);
        console.log('Test API Parsed Result:', testResult);
      } else {
        console.error(`Test API call failed: ${testResponse.status} ${testResponse.statusText}`);
      }
    } catch (testError) {
      console.error('Test API call error:', testError);
    }

    // Get cutoff date (30 days ago) - only used if not forcing recheck
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    if (forceRecheck) {
      console.log('Force recheck enabled: checking ALL contacts with phone numbers');
    } else {
      console.log(`Checking contacts not checked since: ${cutoffDate}`);
    }

    // Get all agents
    const { data: agents, error: agentsError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('role', 'agent');

    if (agentsError) {
      throw new Error(`Failed to fetch agents: ${agentsError.message}`);
    }

    console.log(`Found ${agents?.length || 0} agents to process`);

    let totalChecked = 0;
    let totalFlagged = 0;
    let totalErrors = 0;

    // Process each agent
    for (const agent of agents || []) {
      console.log(`Processing agent: ${agent.user_id}`);
      
      let agentChecked = 0;
      let agentFlagged = 0;
      let agentErrors: string[] = [];

      try {
        // Get contacts that need DNC checking for this agent
        let contacts, contactsError;
        
        if (forceRecheck) {
          // Force recheck: get ALL contacts with phone numbers
          const result = await supabase
            .from('contacts')
            .select('id, phone, agent_id, dnc, dnc_last_checked')
            .eq('agent_id', agent.user_id)
            .not('phone', 'is', null)
            .not('phone', 'eq', '');
          contacts = result.data;
          contactsError = result.error;
          console.log(`Query: ALL contacts for agent ${agent.user_id} WHERE phone IS NOT NULL AND phone != '' (FORCE RECHECK)`);
        } else {
          // Normal check: only contacts that haven't been checked or are older than 30 days
          const result = await supabase
            .from('contacts')
            .select('id, phone, agent_id, dnc, dnc_last_checked')
            .eq('agent_id', agent.user_id)
            .or(`dnc_last_checked.is.null,dnc_last_checked.lt.${cutoffDate}`)
            .not('phone', 'is', null)
            .not('phone', 'eq', '');
          contacts = result.data;
          contactsError = result.error;
          console.log(`Query: contacts for agent ${agent.user_id} WHERE (dnc_last_checked IS NULL OR dnc_last_checked < '${cutoffDate}') AND phone IS NOT NULL AND phone != ''`);
        }

        if (contactsError) {
          const errorMsg = `Failed to fetch contacts for agent ${agent.user_id}: ${contactsError.message}`;
          console.error(errorMsg);
          agentErrors.push(errorMsg);
          continue;
        }

        console.log(`Found ${contacts?.length || 0} contacts to check for agent ${agent.user_id}`);

        if (!contacts || contacts.length === 0) {
          // Log empty run for this agent
          await supabase.from('dnc_logs').insert({
            agent_id: agent.user_id,
            checked_count: 0,
            flagged_count: 0,
            errors: null
          });
          continue;
        }

        // Process contacts in batches of 100 to avoid overwhelming the API
        const batchSize = 100;
        for (let i = 0; i < contacts.length; i += batchSize) {
          const batch = contacts.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i/batchSize) + 1} for agent ${agent.user_id} (${batch.length} contacts)`);

          // Process each contact in the batch
          for (const contact of batch) {
            try {
              // Add small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));

              // Validate phone number format (10 digits only)
              const phoneDigits = contact.phone.replace(/\D/g, '');
              if (phoneDigits.length !== 10) {
                throw new Error(`Invalid phone format: ${contact.phone}`);
              }

              // Call RealValidation DNC API
              const response = await fetch(`https://api.realvalidation.com/rpvWebService/DNCLookup.php?phone=${phoneDigits}&token=${dncApiKey}`, {
                method: 'GET',
                headers: {
                  'User-Agent': 'Real Estate DNC Checker/1.0'
                }
              });

              if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
              }

              const xmlText = await response.text();
              const result = parseXMLResponse(xmlText);
              
              if (!result.isOK) {
                throw new Error(`API error: ${result.error || 'Unknown error'}`);
              }

              const isDNC = result.isDNC;

              // Update contact record
              const { error: updateError } = await supabase
                .from('contacts')
                .update({
                  dnc: isDNC,
                  dnc_last_checked: new Date().toISOString()
                })
                .eq('id', contact.id);

              if (updateError) {
                const errorMsg = `Failed to update contact ${contact.id}: ${updateError.message}`;
                console.error(errorMsg);
                agentErrors.push(errorMsg);
                totalErrors++;
              } else {
                agentChecked++;
                totalChecked++;
                
                if (isDNC) {
                  agentFlagged++;
                  totalFlagged++;
                  console.log(`Flagged contact ${contact.id} (phone: ${contact.phone}) as DNC`);
                }
              }

            } catch (error) {
              const errorMsg = `Error checking contact ${contact.id} (phone: ${contact.phone}): ${error.message}`;
              console.error(errorMsg);
              agentErrors.push(errorMsg);
              totalErrors++;

              // Still update the last_checked date even if API call failed
              try {
                await supabase
                  .from('contacts')
                  .update({ dnc_last_checked: new Date().toISOString() })
                  .eq('id', contact.id);
              } catch (updateError) {
                console.error(`Failed to update last_checked for contact ${contact.id}: ${updateError.message}`);
              }
            }
          }

          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        const errorMsg = `Error processing agent ${agent.user_id}: ${error.message}`;
        console.error(errorMsg);
        agentErrors.push(errorMsg);
      }

      // Log results for this agent
      const { error: logError } = await supabase.from('dnc_logs').insert({
        agent_id: agent.user_id,
        checked_count: agentChecked,
        flagged_count: agentFlagged,
        errors: agentErrors.length > 0 ? agentErrors.join('; ') : null
      });

      if (logError) {
        console.error(`Failed to log results for agent ${agent.user_id}: ${logError.message}`);
      }

      console.log(`Agent ${agent.user_id} completed: ${agentChecked} checked, ${agentFlagged} flagged, ${agentErrors.length} errors`);
    }

    const summary = `DNC check completed: ${totalChecked} contacts checked, ${totalFlagged} flagged as DNC, ${totalErrors} errors`;
    console.log(summary);

    return new Response(JSON.stringify({
      success: true,
      summary,
      stats: {
        totalChecked,
        totalFlagged,
        totalErrors,
        agentsProcessed: agents?.length || 0
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('DNC check automation failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
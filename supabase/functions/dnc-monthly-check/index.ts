import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

function parseXMLResponse(xmlText: string): DNCApiResponse {
  try {
    const getTagContent = (tagName: string): string | null => {
      const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'i');
      const match = xmlText.match(regex);
      return match ? match[1].trim() : null;
    };

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
      error: `XML parsing failed: ${(error as Error).message}`,
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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[DNC Check] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Check for cron job source
  const cronJobHeader = req.headers.get('X-Cron-Job');
  const sourceHeader = req.headers.get('source');
  const isCronJob = cronJobHeader === 'true' || sourceHeader === 'pg_cron';

  // Authentication check
  const authHeader = req.headers.get('Authorization');
  
  let callerUserId: string | null = null;
  let callerRole: string | null = null;

  if (isCronJob) {
    console.log('[DNC Check] Cron job detected, skipping auth');
    callerRole = 'admin'; // Cron jobs run as admin
  } else {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[DNC Check] No authorization header provided');
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify user via getClaims
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('[DNC Check] Authentication failed:', claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    callerUserId = claimsData.claims.sub as string;

    // Get user role from user_roles table (authoritative source)
    const { data: roleData, error: roleError } = await supabaseAuth
      .rpc('get_current_user_role');

    if (roleError) {
      console.error('[DNC Check] Role check failed:', roleError.message);
      return new Response(
        JSON.stringify({ error: "Failed to verify user role" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    callerRole = roleData;
    console.log(`[DNC Check] Authenticated user: ${callerUserId}, role: ${callerRole}`);
  }

  // Parse request body
  let requestData: Record<string, unknown> = {};
  try {
    const body = await req.text();
    if (body) {
      requestData = JSON.parse(body);
    }
  } catch (error) {
    console.log('[DNC Check] No JSON body provided, using defaults');
  }

  const forceRecheck = requestData?.forceRecheck || false;
  const specificAgentId = requestData?.agentId as string | null || null;

  // Authorization logic:
  // - Admins can check any agent or all agents
  // - Non-admins can only check their own contacts (agentId must match their user ID)
  if (callerRole !== 'admin') {
    if (!specificAgentId) {
      // Non-admin trying to run global batch - not allowed
      console.error(`[DNC Check] Non-admin user ${callerUserId} tried to run global batch`);
      return new Response(
        JSON.stringify({ error: "Admin access required for global DNC check. Agents can only check their own contacts." }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (specificAgentId !== callerUserId) {
      // Non-admin trying to check another agent's contacts
      console.error(`[DNC Check] User ${callerUserId} tried to check agent ${specificAgentId}'s contacts`);
      return new Response(
        JSON.stringify({ error: "You can only run DNC checks on your own contacts" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }

  console.log(`[DNC Check] Starting automation... Force recheck: ${forceRecheck}, Specific agent: ${specificAgentId || 'all'}`);

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const dncApiKey = Deno.env.get('DNC_API_KEY');
    
    if (!dncApiKey) {
      console.error('[DNC Check] DNC_API_KEY not configured');
      throw new Error('DNC_API_KEY not configured');
    }

    console.log(`[DNC Check] Using DNC API Key: ${dncApiKey.substring(0, 8)}...${dncApiKey.substring(dncApiKey.length - 4)}`);

    // Get cutoff date (30 days ago) - only used if not forcing recheck
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    if (forceRecheck) {
      console.log('[DNC Check] Force recheck enabled: checking ALL contacts with phone numbers');
    } else {
      console.log(`[DNC Check] Checking contacts not checked since: ${cutoffDate}`);
    }

    // Get agents to process - use user_roles table (authoritative source)
    let agentUserIds: string[] = [];
    
    if (specificAgentId) {
      // Process only the specified agent - verify they exist in user_roles
      const { data: roleCheck, error: roleCheckError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('user_id', specificAgentId)
        .in('role', ['agent', 'admin', 'editor', 'managed', 'core'])
        .limit(1);

      if (roleCheckError) {
        console.error('[DNC Check] Failed to verify agent role:', roleCheckError.message);
        throw new Error(`Failed to verify agent: ${roleCheckError.message}`);
      }

      if (!roleCheck || roleCheck.length === 0) {
        console.error(`[DNC Check] Agent ${specificAgentId} not found in user_roles`);
        throw new Error(`Agent not found or has no role assigned`);
      }

      agentUserIds = [specificAgentId];
      console.log(`[DNC Check] Processing specific agent: ${specificAgentId}`);
    } else {
      // Process all agents - get from user_roles table
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['agent', 'admin']);

      if (rolesError) {
        console.error('[DNC Check] Failed to fetch agents from user_roles:', rolesError.message);
        throw new Error(`Failed to fetch agents: ${rolesError.message}`);
      }

      agentUserIds = [...new Set(allRoles?.map(r => r.user_id) || [])];
      console.log(`[DNC Check] Processing all agents and admins: ${agentUserIds.length} found`);
    }

    console.log(`[DNC Check] Found ${agentUserIds.length} agent(s) to process`);

    let totalChecked = 0;
    let totalFlagged = 0;
    let totalErrors = 0;

    // Process each agent
    for (const agentId of agentUserIds) {
      console.log(`[DNC Check] Processing agent: ${agentId}`);
      
      let agentChecked = 0;
      let agentFlagged = 0;
      const agentErrors: string[] = [];

      try {
        // Get contacts that need DNC checking for this agent
        let contacts, contactsError;
        
        if (forceRecheck) {
          const result = await supabase
            .from('contacts')
            .select('id, phone, agent_id, dnc, dnc_last_checked')
            .eq('agent_id', agentId)
            .eq('dnc', false)
            .not('phone', 'is', null)
            .not('phone', 'eq', '');
          contacts = result.data;
          contactsError = result.error;
          console.log(`[DNC Check] Query: ALL non-DNC contacts for agent ${agentId} (FORCE RECHECK)`);
        } else {
          const result = await supabase
            .from('contacts')
            .select('id, phone, agent_id, dnc, dnc_last_checked')
            .eq('agent_id', agentId)
            .eq('dnc', false)
            .or(`dnc_last_checked.is.null,dnc_last_checked.lt.${cutoffDate}`)
            .not('phone', 'is', null)
            .not('phone', 'eq', '');
          contacts = result.data;
          contactsError = result.error;
          console.log(`[DNC Check] Query: non-DNC contacts for agent ${agentId} needing check`);
        }

        if (contactsError) {
          const errorMsg = `Failed to fetch contacts for agent ${agentId}: ${contactsError.message}`;
          console.error(`[DNC Check] ${errorMsg}`);
          agentErrors.push(errorMsg);
          continue;
        }

        console.log(`[DNC Check] Found ${contacts?.length || 0} contacts to check for agent ${agentId}`);

        if (!contacts || contacts.length === 0) {
          await supabase.from('dnc_logs').insert({
            agent_id: agentId,
            checked_count: 0,
            flagged_count: 0,
            errors: null
          });
          continue;
        }

        // Process contacts in batches of 50
        const batchSize = 50;
        for (let i = 0; i < contacts.length; i += batchSize) {
          const batch = contacts.slice(i, i + batchSize);
          console.log(`[DNC Check] Processing batch ${Math.floor(i/batchSize) + 1} for agent ${agentId} (${batch.length} contacts)`);

          for (const contact of batch) {
            try {
              await new Promise(resolve => setTimeout(resolve, 50));

              const phoneDigits = contact.phone.replace(/\D/g, '');
              let normalizedPhone = phoneDigits;
              
              if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) {
                normalizedPhone = phoneDigits.substring(1);
              }
              
              if (normalizedPhone.length !== 10) {
                throw new Error(`Invalid phone format: ${contact.phone} (normalized to ${normalizedPhone})`);
              }

              const response = await fetch(`https://api.realvalidation.com/rpvWebService/DNCLookup.php?phone=${normalizedPhone}&token=${dncApiKey}`, {
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

              // Only update dnc_last_checked on SUCCESSFUL API response
              const { error: updateError } = await supabase
                .from('contacts')
                .update({
                  dnc: isDNC,
                  dnc_last_checked: new Date().toISOString()
                })
                .eq('id', contact.id);

              if (updateError) {
                const errorMsg = `Failed to update contact ${contact.id}: ${updateError.message}`;
                console.error(`[DNC Check] ${errorMsg}`);
                agentErrors.push(errorMsg);
                totalErrors++;
              } else {
                agentChecked++;
                totalChecked++;
                
                if (isDNC) {
                  agentFlagged++;
                  totalFlagged++;
                  console.log(`[DNC Check] Flagged contact ${contact.id} (phone: ${contact.phone}) as DNC`);
                }
              }

            } catch (error) {
              const errorMsg = `Error checking contact ${contact.id} (phone: ${contact.phone}): ${(error as Error).message}`;
              console.error(`[DNC Check] ${errorMsg}`);
              agentErrors.push(errorMsg);
              totalErrors++;

              // FIX: Do NOT update dnc_last_checked on API failure
              // This ensures the contact will be rechecked on the next run
              console.log(`[DNC Check] Skipping dnc_last_checked update for contact ${contact.id} due to API failure - will retry on next run`);
            }
          }

          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        const errorMsg = `Error processing agent ${agentId}: ${(error as Error).message}`;
        console.error(`[DNC Check] ${errorMsg}`);
        agentErrors.push(errorMsg);
      }

      // Log results for this agent
      const { error: logError } = await supabase.from('dnc_logs').insert({
        agent_id: agentId,
        checked_count: agentChecked,
        flagged_count: agentFlagged,
        errors: agentErrors.length > 0 ? agentErrors.join('; ') : null
      });

      if (logError) {
        console.error(`[DNC Check] Failed to log results for agent ${agentId}: ${logError.message}`);
      }

      console.log(`[DNC Check] Agent ${agentId} completed: ${agentChecked} checked, ${agentFlagged} flagged, ${agentErrors.length} errors`);
    }

    const summary = `DNC check completed: ${totalChecked} contacts checked, ${totalFlagged} flagged as DNC, ${totalErrors} errors`;
    console.log(`[DNC Check] ${summary}`);

    return new Response(JSON.stringify({
      success: true,
      summary,
      stats: {
        totalChecked,
        totalFlagged,
        totalErrors,
        agentsProcessed: agentUserIds.length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DNC Check] Automation failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const webhookData = await req.json()
    
    console.log('Received OpenToClose webhook:', JSON.stringify(webhookData, null, 2))

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Process webhook based on event type
    const { event_type, deal_id, deal_data } = webhookData

    if (!deal_id || !deal_data) {
      throw new Error('Invalid webhook data: missing deal_id or deal_data')
    }

    let action = 'unknown'

    switch (event_type) {
      case 'deal.created':
      case 'deal.updated':
        action = 'upsert'
        break
      case 'deal.deleted':
        action = 'delete'
        break
      case 'deal.status_changed':
        action = 'update_status'
        break
      default:
        console.log('Unhandled event type:', event_type)
        return new Response(
          JSON.stringify({ message: 'Event type not handled', event_type }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    if (action === 'delete') {
      // Delete transaction
      const { error } = await supabase
        .from('transaction_coordination')
        .delete()
        .eq('otc_deal_id', deal_id)

      if (error) {
        throw error
      }

      console.log('Deleted transaction:', deal_id)

    } else if (action === 'update_status') {
      // Update just the status
      const { error } = await supabase
        .from('transaction_coordination')
        .update({
          status: deal_data.status || 'ongoing',
          transaction_stage: deal_data.stage || 'under_contract',
          updated_at: new Date().toISOString()
        })
        .eq('otc_deal_id', deal_id)

      if (error) {
        throw error
      }

      console.log('Updated transaction status:', deal_id)

    } else {
    // Map agent from deal data - handle multiple possible agent field formats
      let agentId = null
      
      // Try multiple possible agent email fields from OpenToClose
      const agentEmail = deal_data.agent_email || 
                        deal_data.listing_agent?.email || 
                        deal_data.buyer_agent?.email ||
                        deal_data.responsible_agent?.email ||
                        deal_data.agent?.email;
      
      if (agentEmail) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', agentEmail)
          .single()
        
        if (profile) {
          agentId = profile.user_id
        }
      }

      // If no agent found by email, try to find by team association
      if (!agentId) {
        const teamName = deal_data.team?.name || deal_data.organization?.name || 
                        deal_data.office?.name || deal_data.brokerage?.name;
        
        if (teamName && (
          teamName.toLowerCase().includes('real estate on purpose') ||
          teamName.toLowerCase().includes('reop')
        )) {
          // For team deals without specific agent mapping, use the first admin agent
          const { data: adminProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('role', 'admin')
            .single()
          
          if (adminProfile) {
            agentId = adminProfile.user_id
          }
        }
      }

      if (!agentId) {
        console.warn('Could not find agent for deal:', deal_id, 'agent_email:', agentEmail)
        // For now, skip records without agent mapping
        return new Response(
          JSON.stringify({ message: 'Agent not found for deal', deal_id, agent_email: agentEmail }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Transform webhook data to our transaction format with proper field mapping
      const transactionData = {
        responsible_agent: agentId,
        otc_deal_id: deal_id,
        client_name: deal_data.client_name || deal_data.buyer_name || deal_data.seller_name || 
                    `${deal_data.first_name || ''} ${deal_data.last_name || ''}`.trim() || null,
        property_address: deal_data.property_address || deal_data.address || 
                         deal_data.property?.address || deal_data.listing?.address || null,
        sale_price: parseFloat(deal_data.sale_price || deal_data.sales_amount || 
                              deal_data.price || deal_data.purchase_price || 0) || null,
        gci: parseFloat(deal_data.gci || deal_data.commission || 
                       deal_data.agent_commission || 0) || null,
        status: (deal_data.status === 'closed' || deal_data.stage === 'closed') ? 'closed' : 'ongoing',
        transaction_stage: (deal_data.status === 'closed' || deal_data.stage === 'closed') ? 'closed' : 'under_contract',
        contract_date: deal_data.contract_date || deal_data.contract_executed_date || 
                      deal_data.under_contract_date || null,
        closing_date: deal_data.closing_date || deal_data.settlement_date || 
                     deal_data.close_date || null,
        updated_at: new Date().toISOString(),
      }

      // Upsert transaction
      const { error } = await supabase
        .from('transaction_coordination')
        .upsert(transactionData, {
          onConflict: 'otc_deal_id',
          ignoreDuplicates: false
        })

      if (error) {
        throw error
      }

      console.log('Processed transaction:', deal_id, action)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${event_type} for deal ${deal_id}`,
        action
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
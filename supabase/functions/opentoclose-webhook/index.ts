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
      // Map agent from deal data (this would need to be customized based on your OTC setup)
      // For now, we'll try to find the agent by email or other identifier
      let agentId = null
      
      if (deal_data.agent_email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', deal_data.agent_email)
          .single()
        
        if (profile) {
          agentId = profile.user_id
        }
      }

      if (!agentId) {
        console.warn('Could not find agent for deal:', deal_id)
        // For demo purposes, we'll skip this record
        return new Response(
          JSON.stringify({ message: 'Agent not found for deal', deal_id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Transform webhook data to our transaction format
      const transactionData = {
        responsible_agent: agentId,
        otc_deal_id: deal_id,
        client_name: deal_data.client_name || null,
        property_address: deal_data.property_address || null,
        sale_price: deal_data.sale_price || null,
        gci: deal_data.gci || null,
        status: deal_data.status || 'ongoing',
        transaction_stage: deal_data.stage || 'under_contract',
        contract_date: deal_data.contract_date || null,
        closing_date: deal_data.closing_date || null,
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
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
    const { agentId } = await req.json()
    
    if (!agentId) {
      throw new Error('Agent ID is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get OpenToClose API key
    const otcApiKey = Deno.env.get('OPENTOCLOSE_API_KEY')
    if (!otcApiKey) {
      throw new Error('OpenToClose API key not configured')
    }

    console.log('Starting OpenToClose sync for agent:', agentId)

    // Fetch deals from OpenToClose API
    let otcDeals = []
    
    try {
      console.log('Calling OpenToClose API...')
      
      // Real OpenToClose API call
      const response = await fetch('https://app2.opentoclose.com/api/v2/deals', {
        headers: {
          'Authorization': `Bearer ${otcApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        console.error('OpenToClose API error:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`OpenToClose API returned ${response.status}: ${response.statusText}`)
      }

      const apiData = await response.json()
      console.log('OpenToClose API response received:', apiData?.data?.length || 0, 'deals')
      
      // Filter for "Real Estate on Purpose" team only
      // Note: Adjust the filter field based on OpenToClose API response structure
      otcDeals = (apiData?.data || []).filter(deal => {
        // Filter by team name, organization, or any team identifier field
        // This will need to be adjusted based on the actual OpenToClose API response structure
        const teamName = deal?.team?.name || deal?.organization?.name || deal?.company?.name
        return teamName && teamName.toLowerCase().includes('real estate on purpose')
      })
      
      console.log('Filtered deals for Real Estate on Purpose:', otcDeals.length)
      
    } catch (error) {
      console.error('Failed to fetch from OpenToClose API:', error)
      
      // Fallback to empty array if API fails
      otcDeals = []
      
      // Log the error but don't fail completely
      console.log('Continuing with empty dataset due to API error')
    }

    // Map OpenToClose stages to our valid database values
    const mapTransactionStage = (otcStage) => {
      const stageMapping = {
        'under_contract': 'under_contract',
        'pending': 'under_contract', 
        'contract': 'under_contract',
        'closed': 'under_contract', // Map closed to under_contract as our default
        'active': 'under_contract',
        'listing': 'under_contract'
      }
      
      return stageMapping[otcStage?.toLowerCase()] || 'under_contract'
    }

    let syncedCount = 0
    let errorCount = 0

    // Process each deal from OpenToClose
    for (const deal of otcDeals) {
      try {
        // Transform OTC data to our transaction format
        const transactionData = {
          responsible_agent: agentId,
          otc_deal_id: deal.id || deal.deal_id || deal._id,
          client_name: deal.client_name || deal.buyer_name || deal.seller_name || `${deal.first_name || ''} ${deal.last_name || ''}`.trim(),
          property_address: deal.property_address || deal.address || deal.property?.address,
          sale_price: parseFloat(deal.sale_price || deal.price || deal.listing_price || 0),
          gci: parseFloat(deal.gci || deal.commission || deal.agent_commission || 0),
          status: deal.status === 'closed' ? 'closed' : 'ongoing',
          transaction_stage: mapTransactionStage(deal.transaction_stage || deal.stage || deal.status),
          contract_date: deal.contract_date || deal.contract_executed_date || deal.offer_accepted_date,
          closing_date: deal.closing_date || deal.settlement_date || deal.close_date,
          updated_at: new Date().toISOString(),
        }

        // Upsert transaction (insert or update if exists)
        const { error } = await supabase
          .from('transaction_coordination')
          .upsert(transactionData, {
            onConflict: 'otc_deal_id',
            ignoreDuplicates: false
          })

        if (error) {
          console.error('Error upserting transaction:', error)
          console.error('Transaction data that failed:', JSON.stringify(transactionData, null, 2))
          errorCount++
        } else {
          syncedCount++
          console.log('Successfully synced transaction:', deal.id || deal.deal_id || deal._id)
        }

      } catch (error) {
        console.error('Error processing deal:', deal.id || deal.deal_id || deal._id, error)
        console.error('Deal data that failed processing:', JSON.stringify(deal, null, 2))
        errorCount++
      }
    }

    console.log(`Sync completed. Synced: ${syncedCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${syncedCount} transactions`,
        syncedCount,
        errorCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Sync error:', error)
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
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
      
      // Real OpenToClose API call with correct endpoint and authentication
      const response = await fetch('https://api.opentoclose.com/v1/deals', {
        headers: {
          'X-API-Key': otcApiKey,
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
      
      // Log the full API response structure for debugging
      console.log('Full API response structure:', JSON.stringify(apiData, null, 2))
      
      // Filter by team name, organization, or any team identifier field
      otcDeals = (apiData?.data || []).filter(deal => {
        // Check multiple possible team/organization fields
        const teamName = deal?.team?.name || deal?.organization?.name || deal?.company?.name || 
                         deal?.agent?.team || deal?.listing_agent?.team || deal?.buyer_agent?.team ||
                         deal?.office?.name || deal?.brokerage?.name
        
        console.log('Deal team info:', {
          dealId: deal?.id,
          teamName,
          fullDeal: JSON.stringify(deal, null, 2)
        })
        
        if (teamName) {
          return teamName.toLowerCase().includes('real estate on purpose') || 
                 teamName.toLowerCase().includes('reop') ||
                 teamName.toLowerCase().includes('real estate on purpose')
        }
        
        // If no team filtering available, return all deals for now
        return true
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
    const mapTransactionStage = (otcStage, status) => {
      const stageMapping = {
        'under_contract': 'under_contract',
        'pending': 'under_contract', 
        'contract': 'under_contract',
        'closed': 'closed', // Properly map closed deals to closed status
        'active': 'under_contract',
        'listing': 'under_contract',
        'sold': 'closed',
        'complete': 'closed',
        'settlement': 'closed'
      }
      
      // If status indicates closed, map to closed regardless of stage
      if (status && status.toLowerCase() === 'closed') {
        return 'closed'
      }
      
      return stageMapping[otcStage?.toLowerCase()] || 'under_contract'
    }

    let syncedCount = 0
    let errorCount = 0

    // Process each deal from OpenToClose
    for (const deal of otcDeals) {
      try {
        // Log deal structure for debugging
        console.log('Processing deal:', JSON.stringify(deal, null, 2))
        
        // Transform OTC data to our transaction format
        const transactionData = {
          responsible_agent: agentId,
          otc_deal_id: deal.id || deal.deal_id || deal._id,
          client_name: deal.client_name || deal.buyer_name || deal.seller_name || 
                      `${deal.first_name || ''} ${deal.last_name || ''}`.trim() ||
                      `${deal.buyer?.first_name || ''} ${deal.buyer?.last_name || ''}`.trim() ||
                      `${deal.seller?.first_name || ''} ${deal.seller?.last_name || ''}`.trim(),
          property_address: deal.property_address || deal.address || deal.property?.address || 
                           deal.listing?.address || deal.property?.street_address,
          sale_price: parseFloat(deal.sale_price || deal.price || deal.listing_price || 
                                deal.purchase_price || deal.contract_price || 0),
          gci: parseFloat(deal.gci || deal.commission || deal.agent_commission || 
                         deal.total_commission || deal.gross_commission || 0),
          status: (deal.status === 'closed' || deal.stage === 'closed' || deal.transaction_stage === 'closed') ? 'closed' : 'ongoing',
          transaction_stage: mapTransactionStage(deal.transaction_stage || deal.stage || deal.status, deal.status),
          contract_date: deal.contract_date || deal.contract_executed_date || deal.offer_accepted_date ||
                        deal.under_contract_date || deal.agreement_date,
          closing_date: deal.closing_date || deal.settlement_date || deal.close_date ||
                       deal.scheduled_closing_date || deal.actual_closing_date,
          updated_at: new Date().toISOString(),
        }
        
        console.log('Mapped transaction data:', JSON.stringify(transactionData, null, 2))

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
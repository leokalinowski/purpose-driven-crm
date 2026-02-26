import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function mapTransactionStage(otcStage: string | undefined, status: string | undefined): string {
  const stageMapping: Record<string, string> = {
    'under_contract': 'under_contract',
    'pending': 'under_contract',
    'contract': 'under_contract',
    'closed': 'closed',
    'active': 'under_contract',
    'listing': 'under_contract',
    'sold': 'closed',
    'complete': 'closed',
    'settlement': 'closed',
  }
  if (status && status.toLowerCase() === 'closed') return 'closed'
  return stageMapping[otcStage?.toLowerCase() || ''] || 'under_contract'
}

function mapDealToTransaction(deal: any, agentId: string) {
  return {
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
    listing_agent_id: deal.listing_agent?.id || deal.listing_agent_id,
    buyer_agent_id: deal.buyer_agent?.id || deal.buying_agent?.id || deal.buyer_agent_id,
    property_type: deal.property_type || deal.property?.type || deal.listing?.property_type,
    square_footage: parseInt(deal.square_footage || deal.property?.square_feet || deal.sqft || 0) || null,
    bedrooms: parseInt(deal.bedrooms || deal.property?.bedrooms || deal.beds || 0) || null,
    bathrooms: parseFloat(deal.bathrooms || deal.property?.bathrooms || deal.baths || 0) || null,
    listing_date: deal.listing_date || deal.list_date || deal.date_listed,
    days_on_market: parseInt(deal.days_on_market || deal.dom || 0) || null,
    price_per_sqft: deal.price_per_sqft || deal.price_per_square_foot ||
      (deal.sale_price && deal.square_footage ? parseFloat(deal.sale_price) / parseInt(deal.square_footage) : null),
    commission_rate: parseFloat(deal.commission_rate || deal.commission_percentage || 0) || null,
    brokerage_split: parseFloat(deal.brokerage_split || deal.split_percentage || 0) || null,
    transaction_type: deal.transaction_type || deal.side ||
      (deal.listing_agent?.id === agentId ? 'sell' : deal.buyer_agent?.id === agentId ? 'buy' : 'both'),
    lead_source: deal.lead_source || deal.source || deal.referral_source,
    referral_source: deal.referral_source || deal.referred_by,
    milestone_dates: {
      inspection_date: deal.inspection_date,
      appraisal_date: deal.appraisal_date,
      financing_contingency_date: deal.financing_contingency_date,
      title_search_date: deal.title_search_date,
      final_walkthrough_date: deal.final_walkthrough_date,
      settlement_date: deal.settlement_date || deal.closing_date,
      ...(deal.milestone_dates || {}),
    },
    risk_factors: [
      ...(deal.financing_contingency ? ['financing_contingency'] : []),
      ...(deal.inspection_contingency ? ['inspection_contingency'] : []),
      ...(deal.appraisal_contingency ? ['appraisal_contingency'] : []),
      ...(deal.sale_of_home_contingency ? ['sale_of_home_contingency'] : []),
      ...(deal.risk_factors || []),
    ],
    raw_api_data: deal,
    last_synced_at: new Date().toISOString(),
    sync_errors: [],
    updated_at: new Date().toISOString(),
  }
}

async function fetchOtcDeals(otcApiKey: string): Promise<any[]> {
  try {
    const response = await fetch('https://api.opentoclose.com/v1/deals', {
      headers: {
        'X-API-Key': otcApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })
    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenToClose API error:', response.status, errorText)
      throw new Error(`OpenToClose API returned ${response.status}: ${response.statusText}`)
    }
    const apiData = await response.json()
    console.log('OTC API returned', apiData?.data?.length || 0, 'deals')
    return apiData?.data || []
  } catch (error) {
    console.error('Failed to fetch from OTC API:', error)
    return []
  }
}

async function syncAgentDeals(supabase: any, agentId: string, deals: any[]) {
  let syncedCount = 0
  let errorCount = 0
  const errors: string[] = []

  for (const deal of deals) {
    try {
      const txData = mapDealToTransaction(deal, agentId)
      const { error } = await supabase
        .from('transaction_coordination')
        .upsert(txData, { onConflict: 'otc_deal_id', ignoreDuplicates: false })
      if (error) {
        console.error('Upsert error:', error)
        errors.push(`Deal ${deal.id}: ${error.message}`)
        errorCount++
      } else {
        syncedCount++
      }
    } catch (error: any) {
      errors.push(`Deal ${deal.id}: ${error.message}`)
      errorCount++
    }
  }
  return { syncedCount, errorCount, errors }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const mode = body.mode || 'single'
    const agentId = body.agentId

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const otcApiKey = Deno.env.get('OPENTOCLOSE_API_KEY')
    if (!otcApiKey) throw new Error('OpenToClose API key not configured')

    // Fetch all deals from OTC once
    const allDeals = await fetchOtcDeals(otcApiKey)

    if (mode === 'team') {
      // Team mode: sync all agents
      console.log('Starting team-wide OTC sync')

      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['agent', 'admin'])

      if (roleErr) throw roleErr

      const agentIds = (roleRows || []).map((r: any) => r.user_id)
      console.log('Syncing for', agentIds.length, 'agents')

      const results: Record<string, any> = {}
      let totalSynced = 0
      let totalErrors = 0

      for (const aid of agentIds) {
        // For now, assign all deals to each agent (OTC doesn't filter by agent)
        // In production, you'd filter deals by agent name/email match
        const result = await syncAgentDeals(supabase, aid, allDeals)
        results[aid] = result
        totalSynced += result.syncedCount
        totalErrors += result.errorCount
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'team',
          agentCount: agentIds.length,
          totalSynced,
          totalErrors,
          results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } else {
      // Single agent mode (original behavior)
      if (!agentId) throw new Error('Agent ID is required for single mode')
      console.log('Starting OTC sync for agent:', agentId)

      const result = await syncAgentDeals(supabase, agentId, allDeals)

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'single',
          message: `Synced ${result.syncedCount} transactions`,
          ...result,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
  } catch (error: any) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

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

    // Mock OpenToClose API call (replace with actual API endpoint)
    // For now, we'll create some sample data to demonstrate the integration
    const mockOtcData = [
      {
        id: 'otc_deal_001',
        client_name: 'John & Jane Smith',
        property_address: '123 Main St, Anytown, ST 12345',
        sale_price: 450000,
        gci: 13500,
        status: 'ongoing',
        transaction_stage: 'under_contract',
        contract_date: new Date().toISOString().split('T')[0],
        closing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      },
      {
        id: 'otc_deal_002',
        client_name: 'Bob Johnson',
        property_address: '456 Oak Ave, Somewhere, ST 67890',
        sale_price: 325000,
        gci: 9750,
        status: 'closed',
        transaction_stage: 'closed',
        contract_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 45 days ago
        closing_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days ago
      }
    ]

    // In a real implementation, you would make an API call like this:
    // const response = await fetch('https://app2.opentoclose.com/api/deals', {
    //   headers: {
    //     'Authorization': `Bearer ${otcApiKey}`,
    //     'Content-Type': 'application/json'
    //   }
    // })
    // const otcDeals = await response.json()

    let syncedCount = 0
    let errorCount = 0

    // Process each deal from OpenToClose
    for (const deal of mockOtcData) {
      try {
        // Transform OTC data to our transaction format
        const transactionData = {
          responsible_agent: agentId,
          otc_deal_id: deal.id,
          client_name: deal.client_name,
          property_address: deal.property_address,
          sale_price: deal.sale_price,
          gci: deal.gci,
          status: deal.status,
          transaction_stage: deal.transaction_stage,
          contract_date: deal.contract_date,
          closing_date: deal.closing_date,
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
          errorCount++
        } else {
          syncedCount++
          console.log('Successfully synced transaction:', deal.id)
        }

      } catch (error) {
        console.error('Error processing deal:', deal.id, error)
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
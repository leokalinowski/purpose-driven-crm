import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OTC_BASE = 'https://api.opentoclose.com/v1'

// --- Helpers ---

function getFieldValue(property: any, key: string): string | null {
  if (!property?.field_values) return null
  const field = property.field_values.find((f: any) => f.key === key)
  const val = field?.value?.toString().trim()
  return val || null
}

function extractAgentFromNotes(notes: string | null): string | null {
  if (!notes) return null
  // Pattern: "RA: Agent Name" (REOP Agent)
  const match = notes.match(/RA:\s*([^<\n]+)/i)
  return match ? match[1].trim() : null
}

function mapStage(status: string | null): string {
  if (!status) return 'under_contract'
  const s = status.toLowerCase()
  if (s.includes('closed') || s.includes('settled')) return 'closed'
  return 'under_contract'
}

function mapStatus(status: string | null): string {
  if (!status) return 'ongoing'
  return status.toLowerCase().includes('closed') ? 'closed' : 'ongoing'
}

function mapTransactionType(clientType: string | null): string {
  if (!clientType) return 'both'
  const t = clientType.toLowerCase()
  if (t.includes('buyer') || t.includes('buy')) return 'buy'
  if (t.includes('seller') || t.includes('sell') || t.includes('list')) return 'sell'
  return 'both'
}

function buildAddress(property: any): string {
  const parts = [
    getFieldValue(property, 'property_address'),
    getFieldValue(property, 'property_city'),
    getFieldValue(property, 'property_state'),
    getFieldValue(property, 'property_zip'),
  ].filter(Boolean)
  return parts.join(', ') || 'Unknown'
}

function mapPropertyToTransaction(property: any, agentId: string) {
  const contractStatus = getFieldValue(property, 'contract_status')
  const listingStatus = getFieldValue(property, 'listing_status')
  const effectiveStatus = contractStatus || listingStatus

  return {
    responsible_agent: agentId,
    otc_deal_id: String(property.id),
    client_name: getFieldValue(property, 'contract_title') || 'Unknown',
    property_address: buildAddress(property),
    sale_price: parseFloat(getFieldValue(property, 'purchase_amount') || getFieldValue(property, 'listing_price') || '0') || 0,
    gci: parseFloat(getFieldValue(property, 'total_commission_amount') || getFieldValue(property, 'commission_amount') || '0') || 0,
    status: mapStatus(effectiveStatus),
    transaction_stage: mapStage(effectiveStatus),
    transaction_type: mapTransactionType(getFieldValue(property, 'contract_client_type')),
    contract_date: getFieldValue(property, 'contract_date') || getFieldValue(property, 'ratification_date'),
    closing_date: getFieldValue(property, 'closing_date') || getFieldValue(property, 'settlement_date'),
    listing_date: getFieldValue(property, 'listing_date') || getFieldValue(property, 'mls_active_date'),
    property_type: getFieldValue(property, 'property_type'),
    lead_source: getFieldValue(property, 'referred_by'),
    commission_rate: parseFloat(getFieldValue(property, 'total_commission_percentage') || '0') || null,
    milestone_dates: {
      emd_due: getFieldValue(property, 'emd_due'),
      contingency_ends_hi: getFieldValue(property, 'contingency_ends_hi'),
      contingency_ends_financing: getFieldValue(property, 'contingency_ends_financing'),
      contingency_ends_appraisal: getFieldValue(property, 'contingency_ends_appraisal'),
      final_walkthrough: getFieldValue(property, 'final_walkthough_date'),
      settlement_date: getFieldValue(property, 'settlement_date'),
    },
    raw_api_data: { id: property.id, team_user_name: property.team_user_name, created: property.created },
    last_synced_at: new Date().toISOString(),
    sync_errors: [],
    updated_at: new Date().toISOString(),
  }
}

// --- OTC API ---

async function otcFetch(path: string, apiToken: string): Promise<any> {
  const separator = path.includes('?') ? '&' : '?'
  const url = `${OTC_BASE}${path}${separator}api_token=${apiToken}`
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`OTC API error [${path}]:`, response.status, errorText)
    throw new Error(`OTC API ${response.status}: ${response.statusText}`)
  }
  return response.json()
}

async function fetchAllProperties(apiToken: string): Promise<any[]> {
  const all: any[] = []
  let offset = 0
  const limit = 50

  while (true) {
    const data = await otcFetch(`/properties?limit=${limit}&offset=${offset}`, apiToken)
    const props = data?.data || data || []
    if (!Array.isArray(props) || props.length === 0) break
    all.push(...props)
    console.log(`Fetched ${all.length} properties so far`)
    if (props.length < limit) break
    offset += limit
  }
  console.log('Total OTC properties:', all.length)
  return all
}

// --- Agent Map ---

async function buildAgentMap(supabase: any): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, email')

  for (const p of profiles || []) {
    const full = `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase()
    if (full) map.set(full, p.user_id)
    if (p.first_name) map.set(p.first_name.toLowerCase(), p.user_id)
    if (p.email) map.set(p.email.toLowerCase(), p.user_id)
  }
  return map
}

function matchAgent(property: any, agentMap: Map<string, string>): string | null {
  // 1. Try agent_name from OTC top-level
  if (property.agent_name) {
    const m = agentMap.get(property.agent_name.toLowerCase())
    if (m) return m
  }
  
  // 2. Try extracting from important_notes "RA: Agent Name"
  const notesAgent = extractAgentFromNotes(getFieldValue(property, 'important_notes'))
  if (notesAgent) {
    const m = agentMap.get(notesAgent.toLowerCase())
    if (m) return m
    // Try first name only
    const first = notesAgent.split(' ')[0]
    if (first) {
      const fm = agentMap.get(first.toLowerCase())
      if (fm) return fm
    }
  }

  // 3. Try listing_agent field value
  const listingAgent = getFieldValue(property, 'listing_agent')
  if (listingAgent) {
    const m = agentMap.get(listingAgent.toLowerCase())
    if (m) return m
  }

  return null
}

// --- Sync ---

async function syncProperties(supabase: any, properties: any[], agentMap: Map<string, string>) {
  let synced = 0, errors = 0, skipped = 0
  const errorList: string[] = []
  const unmatched = new Set<string>()

  for (const prop of properties) {
    try {
      const agentId = matchAgent(prop, agentMap)
      if (!agentId) {
        const desc = extractAgentFromNotes(getFieldValue(prop, 'important_notes'))
          || prop.agent_name || prop.team_user_name || `property ${prop.id}`
        unmatched.add(desc)
        skipped++
        continue
      }

      const tx = mapPropertyToTransaction(prop, agentId)
      const { error } = await supabase
        .from('transaction_coordination')
        .upsert(tx, { onConflict: 'otc_deal_id', ignoreDuplicates: false })

      if (error) {
        errorList.push(`${prop.id}: ${error.message}`)
        errors++
      } else {
        synced++
      }
    } catch (e: any) {
      errorList.push(`${prop.id}: ${e.message}`)
      errors++
    }
  }

  return { syncedCount: synced, errorCount: errors, skippedCount: skipped, errors: errorList, unmatchedAgents: [...unmatched] }
}

// --- Handler ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const mode = body.mode || 'single'

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const apiKey = Deno.env.get('OPENTOCLOSE_API_KEY')
    if (!apiKey) throw new Error('OpenToClose API key not configured')

    // --- DISCOVER ---
    if (mode === 'discover') {
      const raw = await otcFetch('/properties?limit=3', apiKey)
      const props = raw?.data || raw || []
      let agents = null
      try { agents = await otcFetch('/agents', apiKey) } catch (_) {}

      // Sample contacts for first property
      let contacts = null
      if (props[0]?.id) {
        try { contacts = await otcFetch(`/properties/${props[0].id}/contacts`, apiKey) } catch (_) {}
      }

      const contactSummary = (contacts?.data || contacts || []).map((c: any) => ({
        name: `${c.contact?.first_name || ''} ${c.contact?.last_name || ''}`.trim(),
        role: c.contact_role?.title || 'unknown',
        email: c.contact?.email,
      }))

      return new Response(JSON.stringify({
        success: true, mode: 'discover',
        propertyCount: props.length,
        topLevelKeys: props[0] ? Object.keys(props[0]).filter((k: string) => k !== 'field_values') : [],
        sampleProperty: props[0] ? { id: props[0].id, team_user_name: props[0].team_user_name, agent_id: props[0].agent_id, agent_name: props[0].agent_name } : null,
        fieldKeys: props[0]?.field_values?.map((f: any) => ({ key: f.key, label: f.label, sampleValue: f.value })).filter((f: any) => f.sampleValue) || [],
        contactRoles: contactSummary,
        agents,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- SYNC ---
    const allProperties = await fetchAllProperties(apiKey)
    const agentMap = await buildAgentMap(supabase)
    console.log(`Starting ${mode} sync: ${allProperties.length} properties, ${agentMap.size} agent mappings`)

    const result = await syncProperties(supabase, allProperties, agentMap)
    console.log(`Sync done: ${result.syncedCount} synced, ${result.skippedCount} skipped, ${result.errorCount} errors`)
    if (result.unmatchedAgents.length > 0) {
      console.log('Unmatched:', result.unmatchedAgents.join(' | '))
    }

    return new Response(JSON.stringify({
      success: true, mode,
      totalProperties: allProperties.length,
      ...result,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

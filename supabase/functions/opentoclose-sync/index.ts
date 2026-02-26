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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '')
}

function extractAgentFromNotes(notes: string | null): string | null {
  if (!notes) return null
  // Replace <br> and <br/> with newlines before stripping other tags
  const withNewlines = notes.replace(/<br\s*\/?>/gi, '\n')
  // Strip remaining HTML tags
  const stripped = withNewlines.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
  const match = stripped.match(/RA:\s*([^\n]+)/i)
  if (!match) return null
  // Clean up extra spaces and trim
  return match[1].trim().replace(/\s+/g, ' ')
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

function parseCommissionDollar(val: string | null): number {
  if (!val) return 0
  // Extract dollar amount from patterns like "2.5% ($26,000)" or "$26,000"
  const dollarMatch = val.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (dollarMatch) return parseFloat(dollarMatch[1].replace(/,/g, '')) || 0
  // Try as plain number
  return parseFloat(val.replace(/[^0-9.]/g, '')) || 0
}

function mapPropertyToTransaction(property: any, agentId: string, clientName: string | null) {
  const contractStatus = getFieldValue(property, 'contract_status')
  const listingStatus = getFieldValue(property, 'listing_status')
  const effectiveStatus = contractStatus || listingStatus

  // Determine representation to pick the right commission field
  const representation = getFieldValue(property, 'contract_client_type') || ''
  const repLower = representation.toLowerCase()
  
  let gci = 0
  // Try explicit GCI fields first
  gci = parseFloat(getFieldValue(property, 'gci') || getFieldValue(property, 'gci_amount') || '0') || 0
  
  // If no explicit GCI, parse from commission fields based on representation
  if (gci === 0) {
    if (repLower.includes('buyer') || repLower.includes('buy')) {
      gci = parseCommissionDollar(getFieldValue(property, 'seller_to_buyer_broker'))
    } else if (repLower.includes('seller') || repLower.includes('sell') || repLower.includes('list')) {
      gci = parseCommissionDollar(getFieldValue(property, 'seller_to_listing_broker'))
    }
    // If still 0, try both
    if (gci === 0) {
      gci = parseCommissionDollar(getFieldValue(property, 'seller_to_listing_broker'))
        || parseCommissionDollar(getFieldValue(property, 'seller_to_buyer_broker'))
    }
  }

  return {
    responsible_agent: agentId,
    otc_deal_id: String(property.id),
    client_name: clientName || getFieldValue(property, 'buyer_name') || getFieldValue(property, 'seller_name') || 'Unknown',
    property_address: buildAddress(property),
    sale_price: parseFloat(getFieldValue(property, 'purchase_amount') || getFieldValue(property, 'listing_price') || '0') || 0,
    gci,
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
    if (all.length % 500 === 0) console.log(`Fetched ${all.length} properties so far`)
    if (props.length < limit) break
    offset += limit
    // Rate limit: OTC allows ~1 req/sec
    await new Promise(r => setTimeout(r, 1200))
  }
  console.log('Total OTC properties:', all.length)
  return all
}

// --- Agent Map (full-name matching only) ---

interface ProfileEntry {
  userId: string
  fullName: string
  lastName: string
}

async function loadProfiles(supabase: any): Promise<ProfileEntry[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, email')

  return (profiles || []).map((p: any) => ({
    userId: p.user_id,
    fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
    lastName: (p.last_name || '').trim(),
  })).filter((p: ProfileEntry) => p.fullName.length > 0)
}

function matchAgentByName(raName: string, profiles: ProfileEntry[]): { userId: string; matchedName: string } | null {
  const normRA = normalize(raName)
  
  // 1. Exact full-name match (normalized)
  for (const p of profiles) {
    if (normalize(p.fullName) === normRA) {
      return { userId: p.userId, matchedName: p.fullName }
    }
  }

  // 2. Full name contained in RA string or vice versa
  for (const p of profiles) {
    const normFull = normalize(p.fullName)
    if (normRA.includes(normFull) || normFull.includes(normRA)) {
      return { userId: p.userId, matchedName: p.fullName }
    }
  }

  // 3. Last-name match (only if last name is 4+ chars to avoid false positives)
  for (const p of profiles) {
    if (p.lastName.length >= 4 && normalize(p.lastName) === normRA.slice(-normalize(p.lastName).length)) {
      return { userId: p.userId, matchedName: p.fullName }
    }
  }

  return null
}

// --- Filter & Sync ---

function isREOPProperty(property: any): { isReop: boolean; raName: string | null } {
  const notes = getFieldValue(property, 'important_notes') || property.important_notes || ''
  const raName = extractAgentFromNotes(notes)
  return { isReop: !!raName, raName }
}

async function syncProperties(supabase: any, properties: any[], profiles: ProfileEntry[]) {
  let synced = 0, errors = 0, skippedNoRA = 0, skippedNoMatch = 0
  const errorList: string[] = []
  const unmatchedNames = new Map<string, number>()

  for (const prop of properties) {
    try {
      const { isReop, raName } = isREOPProperty(prop)
      
      // Skip non-REOP properties
      if (!isReop || !raName) {
        skippedNoRA++
        continue
      }

      // Match RA name to Hub profile
      const match = matchAgentByName(raName, profiles)
      if (!match) {
        unmatchedNames.set(raName, (unmatchedNames.get(raName) || 0) + 1)
        skippedNoMatch++
        continue
      }

      const tx = mapPropertyToTransaction(prop, match.userId, null)
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

  const unmatchedAgents = [...unmatchedNames.entries()].map(([name, count]) => `${name} (${count})`)

  return { 
    syncedCount: synced, errorCount: errors, 
    skippedNoRA, skippedNoMatch,
    errors: errorList, unmatchedAgents 
  }
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
      // Fetch a batch of properties to analyze
      const raw = await otcFetch('/properties?limit=50', apiKey)
      const props = raw?.data || raw || []

      // Find REOP vs non-REOP samples
      const reopSamples: any[] = []
      const nonReopSamples: any[] = []
      for (const p of props) {
        const { isReop, raName } = isREOPProperty(p)
        const summary = {
          id: p.id,
          team_user_name: p.team_user_name,
          agent_name: p.agent_name,
          important_notes: getFieldValue(p, 'important_notes'),
          contract_status: getFieldValue(p, 'contract_status'),
          contract_title: getFieldValue(p, 'contract_title'),
          property_address: buildAddress(p),
          purchase_amount: getFieldValue(p, 'purchase_amount'),
          gci: getFieldValue(p, 'gci'),
          gci_amount: getFieldValue(p, 'gci_amount'),
          commission_amount: getFieldValue(p, 'commission_amount'),
          total_commission_amount: getFieldValue(p, 'total_commission_amount'),
          agent_commission: getFieldValue(p, 'agent_commission'),
          seller_to_buyer_broker: getFieldValue(p, 'seller_to_buyer_broker'),
          seller_to_listing_broker: getFieldValue(p, 'seller_to_listing_broker'),
          buyer_name: getFieldValue(p, 'buyer_name'),
          seller_name: getFieldValue(p, 'seller_name'),
          raName,
        }
        if (isReop && reopSamples.length < 5) reopSamples.push(summary)
        if (!isReop && nonReopSamples.length < 3) nonReopSamples.push(summary)
      }

      // Load profiles for matching test
      const profiles = await loadProfiles(supabase)
      const matchResults = reopSamples.map(s => {
        const match = s.raName ? matchAgentByName(s.raName, profiles) : null
        return { raName: s.raName, matched: match?.matchedName || 'NO MATCH', userId: match?.userId || null }
      })

      // All field keys from first property
      const fieldKeys = props[0]?.field_values?.map((f: any) => ({ 
        key: f.key, label: f.label, sampleValue: f.value 
      })).filter((f: any) => f.sampleValue) || []

      return new Response(JSON.stringify({
        success: true, mode: 'discover',
        totalFetched: props.length,
        reopCount: props.filter((p: any) => isREOPProperty(p).isReop).length,
        reopSamples,
        nonReopSamples,
        matchResults,
        hubProfiles: profiles.map(p => p.fullName),
        fieldKeys,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- SYNC ---
    const allProperties = await fetchAllProperties(apiKey)
    const profiles = await loadProfiles(supabase)
    console.log(`Starting sync: ${allProperties.length} properties, ${profiles.length} profiles`)

    const result = await syncProperties(supabase, allProperties, profiles)
    console.log(`Sync done: ${result.syncedCount} synced, ${result.skippedNoRA} skipped (no RA), ${result.skippedNoMatch} skipped (no match), ${result.errorCount} errors`)
    if (result.unmatchedAgents.length > 0) {
      console.log('Unmatched REOP agents:', result.unmatchedAgents.join(' | '))
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

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
  const withNewlines = notes.replace(/<br\s*\/?>/gi, '\n')
  const stripped = withNewlines.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
  const match = stripped.match(/RA:\s*([^\n]+)/i)
  if (!match) return null
  return match[1].trim().replace(/\s+/g, ' ')
}

function extractClientFromNotes(notes: string | null): string | null {
  if (!notes) return null
  const withNewlines = notes.replace(/<br\s*\/?>/gi, '\n')
  const stripped = withNewlines.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  const lines = stripped.split('\n').map(l => l.trim()).filter(Boolean)
  let foundRA = false
  for (const line of lines) {
    if (/^RA:/i.test(line)) { foundRA = true; continue }
    // Skip lines starting with "-" (bullet points like "- built 2023")
    if (line.startsWith('-')) continue
    if (foundRA && line.length > 2 && !/^(Title|Buyer|Seller|SentriLock|lockbox|occupied|vacant)/i.test(line)) {
      return line.replace(/\s+/g, ' ').substring(0, 100)
    }
  }
  return null
}

function mapStage(contractStatus: string | null, closingDate: string | null): string {
  if (closingDate) {
    const closeDate = new Date(closingDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (closeDate <= today) return 'closed'
  }
  
  if (!contractStatus) return 'under_contract'
  const s = contractStatus.toLowerCase()
  
  if (s.includes('closed') || s.includes('settled') || s.includes('archive') || s.includes('post-occ') || s.includes('compliance only')) return 'closed'
  if (s.includes('listing') && !s.includes('complete')) return 'listing'
  if (s.includes('listing-complete') || s.includes('listing complete')) return 'closed'
  if (s.includes('on hold')) return 'on_hold'
  
  return 'under_contract'
}

function mapStatus(contractStatus: string | null, closingDate: string | null): string {
  const stage = mapStage(contractStatus, closingDate)
  return stage === 'closed' ? 'closed' : 'ongoing'
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

function parseCommission(val: string | null, salePrice: number): number {
  if (!val) return 0
  const dollarMatch = val.match(/\$\s*([\d,]+(?:\.\d+)?)/)
  if (dollarMatch) {
    const amount = parseFloat(dollarMatch[1].replace(/,/g, '')) || 0
    if (amount > 0) return amount
  }
  const pctMatch = val.match(/([\d.]+)\s*%/)
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]) || 0
    if (pct > 0 && pct < 100 && salePrice > 0) {
      return (pct / 100) * salePrice
    }
    return pct
  }
  const num = parseFloat(val.replace(/[^0-9.]/g, '')) || 0
  if (num > 0 && num < 100 && salePrice > 10000) {
    return (num / 100) * salePrice
  }
  return num
}

function extractCommissionRate(val: string | null): number | null {
  if (!val) return null
  const pctMatch = val.match(/([\d.]+)\s*%/)
  if (pctMatch) return parseFloat(pctMatch[1]) || null
  const num = parseFloat(val.replace(/[^0-9.]/g, '')) || 0
  if (num > 0 && num < 100) return num
  return null
}

// --- TEAM FILTER: Use team_name field instead of RA: notes ---

function isREOPProperty(property: any): boolean {
  const teamName = getFieldValue(property, 'team_name')
  if (!teamName) return false
  return teamName.toLowerCase().includes('real estate on purpose')
}

// --- Get agent name: prefer agent_name field, fallback to RA: in notes ---

function getAgentName(property: any): string | null {
  const agentName = getFieldValue(property, 'agent_name')
  if (agentName && agentName.length > 1) return agentName
  
  // Fallback: extract from notes
  const notes = getFieldValue(property, 'important_notes') || property.important_notes || ''
  return extractAgentFromNotes(notes)
}

function mapPropertyToTransaction(property: any, agentId: string | null, otcAgentName: string | null) {
  const contractStatus = getFieldValue(property, 'contract_status')
  const listingStatus = getFieldValue(property, 'listing_status')
  const effectiveStatus = contractStatus || listingStatus

  const closingDate = getFieldValue(property, 'closing_date') || getFieldValue(property, 'settlement_date')
  const contractDate = getFieldValue(property, 'contract_date') || getFieldValue(property, 'ratification_date')
  const listingDate = getFieldValue(property, 'listing_date') || getFieldValue(property, 'mls_active_date')

  const salePrice = parseFloat(getFieldValue(property, 'purchase_amount') || getFieldValue(property, 'listing_price') || '0') || 0

  const representation = getFieldValue(property, 'contract_client_type') || ''
  const repLower = representation.toLowerCase()
  
  let gci = 0
  gci = parseFloat(getFieldValue(property, 'gci') || getFieldValue(property, 'gci_amount') || '0') || 0
  if (gci > 0 && gci < 100 && salePrice > 10000) {
    gci = (gci / 100) * salePrice
  }
  if (gci === 0) {
    if (repLower.includes('buyer') || repLower.includes('buy')) {
      gci = parseCommission(getFieldValue(property, 'seller_to_buyer_broker'), salePrice)
    } else if (repLower.includes('seller') || repLower.includes('sell') || repLower.includes('list')) {
      gci = parseCommission(getFieldValue(property, 'seller_to_listing_broker'), salePrice)
    }
    if (gci === 0) {
      gci = parseCommission(getFieldValue(property, 'seller_to_listing_broker'), salePrice)
        || parseCommission(getFieldValue(property, 'seller_to_buyer_broker'), salePrice)
    }
  }

  let commissionRate: number | null = null
  if (repLower.includes('buyer') || repLower.includes('buy')) {
    commissionRate = extractCommissionRate(getFieldValue(property, 'seller_to_buyer_broker'))
  } else if (repLower.includes('seller') || repLower.includes('sell') || repLower.includes('list')) {
    commissionRate = extractCommissionRate(getFieldValue(property, 'seller_to_listing_broker'))
  }
  if (!commissionRate) {
    commissionRate = extractCommissionRate(getFieldValue(property, 'total_commission_percentage'))
      || extractCommissionRate(getFieldValue(property, 'seller_to_listing_broker'))
      || extractCommissionRate(getFieldValue(property, 'seller_to_buyer_broker'))
  }

  const notes = getFieldValue(property, 'important_notes') || property.important_notes || ''
  const extractedClient = extractClientFromNotes(notes)
  const finalClientName = extractedClient 
    || getFieldValue(property, 'buyer_name') 
    || getFieldValue(property, 'seller_name')
    || getFieldValue(property, 'client_name')
    || getFieldValue(property, 'primary_client')
    || getFieldValue(property, 'contact_name')
    || null

  return {
    responsible_agent: agentId,
    otc_deal_id: String(property.id),
    client_name: finalClientName,
    property_address: buildAddress(property),
    sale_price: salePrice,
    gci,
    status: mapStatus(effectiveStatus, closingDate),
    transaction_stage: mapStage(effectiveStatus, closingDate),
    transaction_type: mapTransactionType(getFieldValue(property, 'contract_client_type')),
    contract_date: contractDate,
    closing_date: closingDate,
    listing_date: listingDate,
    property_type: getFieldValue(property, 'property_type'),
    lead_source: getFieldValue(property, 'referred_by'),
    commission_rate: commissionRate,
    milestone_dates: {
      emd_due: getFieldValue(property, 'emd_due'),
      contingency_ends_hi: getFieldValue(property, 'contingency_ends_hi'),
      contingency_ends_financing: getFieldValue(property, 'contingency_ends_financing'),
      contingency_ends_appraisal: getFieldValue(property, 'contingency_ends_appraisal'),
      final_walkthrough: getFieldValue(property, 'final_walkthough_date'),
      settlement_date: getFieldValue(property, 'settlement_date'),
    },
    raw_api_data: {
      id: property.id,
      team_user_name: property.team_user_name,
      created: property.created,
      contract_status: effectiveStatus,
      representation: representation,
      otc_agent_name: otcAgentName,
      referral_amount: getFieldValue(property, 'referral_amount'),
      scalable_tc_fee: getFieldValue(property, 'scalable_tc_fee'),
      agent_admin_fee: getFieldValue(property, 'agent_admin_fee'),
      raw_gci: getFieldValue(property, 'gci') || getFieldValue(property, 'gci_amount'),
      raw_seller_to_listing: getFieldValue(property, 'seller_to_listing_broker'),
      raw_seller_to_buyer: getFieldValue(property, 'seller_to_buyer_broker'),
      brokerage: getFieldValue(property, 'brokerage'),
      team_name: getFieldValue(property, 'team_name'),
    },
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
    await new Promise(r => setTimeout(r, 1200))
  }
  console.log('Total OTC properties:', all.length)
  return all
}

// --- Agent Map ---

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
  
  for (const p of profiles) {
    if (normalize(p.fullName) === normRA) {
      return { userId: p.userId, matchedName: p.fullName }
    }
  }

  for (const p of profiles) {
    const normFull = normalize(p.fullName)
    if (normRA.includes(normFull) || normFull.includes(normRA)) {
      return { userId: p.userId, matchedName: p.fullName }
    }
  }

  for (const p of profiles) {
    if (p.lastName.length >= 4 && normalize(p.lastName) === normRA.slice(-normalize(p.lastName).length)) {
      return { userId: p.userId, matchedName: p.fullName }
    }
  }

  return null
}

// --- Filter & Sync ---

async function syncProperties(supabase: any, properties: any[], profiles: ProfileEntry[]) {
  let synced = 0, errors = 0, skippedNotREOP = 0
  const errorList: string[] = []
  const unmatchedNames = new Map<string, number>()
  const matchedNames = new Map<string, number>()

  for (const prop of properties) {
    try {
      // FILTER: Only sync properties where team_name = "Real Estate on Purpose"
      if (!isREOPProperty(prop)) {
        skippedNotREOP++
        continue
      }

      // Get agent name from agent_name field (primary) or RA: notes (fallback)
      const otcAgentName = getAgentName(prop)
      
      // Try to match against Hub profiles
      let agentId: string | null = null
      if (otcAgentName) {
        const match = matchAgentByName(otcAgentName, profiles)
        if (match) {
          agentId = match.userId
          matchedNames.set(match.matchedName, (matchedNames.get(match.matchedName) || 0) + 1)
        } else {
          unmatchedNames.set(otcAgentName, (unmatchedNames.get(otcAgentName) || 0) + 1)
        }
      }

      // Sync ALL REOP properties regardless of agent match
      const tx = mapPropertyToTransaction(prop, agentId, otcAgentName)
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
  const matchedAgents = [...matchedNames.entries()].map(([name, count]) => `${name} (${count})`)

  return { 
    syncedCount: synced, errorCount: errors, 
    skippedNotREOP,
    errors: errorList, unmatchedAgents, matchedAgents
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
      const allProps: any[] = []
      for (let offset = 0; offset < 200; offset += 50) {
        const raw = await otcFetch(`/properties?limit=50&offset=${offset}`, apiKey)
        const batch = raw?.data || raw || []
        if (!Array.isArray(batch) || batch.length === 0) break
        allProps.push(...batch)
        if (batch.length < 50) break
        await new Promise(r => setTimeout(r, 1200))
      }

      const reopSamples: any[] = []
      const nonReopSamples: any[] = []
      const statusValues = new Set<string>()
      const teamNameValues = new Set<string>()
      
      for (const p of allProps) {
        const isReop = isREOPProperty(p)
        const contractStatus = getFieldValue(p, 'contract_status')
        const teamName = getFieldValue(p, 'team_name')
        const agentName = getFieldValue(p, 'agent_name')
        if (contractStatus) statusValues.add(contractStatus)
        if (teamName) teamNameValues.add(teamName)
        
        const summary = {
          id: p.id,
          team_user_name: p.team_user_name,
          team_name: teamName,
          agent_name: agentName,
          important_notes_raw: (getFieldValue(p, 'important_notes') || '').substring(0, 200),
          contract_status: contractStatus,
          listing_status: getFieldValue(p, 'listing_status'),
          property_address: buildAddress(p),
          purchase_amount: getFieldValue(p, 'purchase_amount'),
          listing_price: getFieldValue(p, 'listing_price'),
          gci: getFieldValue(p, 'gci'),
          gci_amount: getFieldValue(p, 'gci_amount'),
          seller_to_buyer_broker: getFieldValue(p, 'seller_to_buyer_broker'),
          seller_to_listing_broker: getFieldValue(p, 'seller_to_listing_broker'),
          contract_client_type: getFieldValue(p, 'contract_client_type'),
          referral_amount: getFieldValue(p, 'referral_amount'),
          closing_date: getFieldValue(p, 'closing_date'),
          settlement_date: getFieldValue(p, 'settlement_date'),
          contract_date: getFieldValue(p, 'contract_date'),
          isReop,
        }
        if (isReop && reopSamples.length < 15) reopSamples.push(summary)
        if (!isReop && nonReopSamples.length < 3) nonReopSamples.push(summary)
      }

      const profiles = await loadProfiles(supabase)
      const matchResults = reopSamples.map(s => {
        const otcAgent = s.agent_name || extractAgentFromNotes(s.important_notes_raw)
        const match = otcAgent ? matchAgentByName(otcAgent, profiles) : null
        return { 
          otcAgentName: otcAgent, 
          matched: match?.matchedName || 'NO MATCH', 
          userId: match?.userId || null,
          teamName: s.team_name,
        }
      })

      const fieldKeys = allProps[0]?.field_values?.map((f: any) => ({ 
        key: f.key, label: f.label, sampleValue: f.value 
      })).filter((f: any) => f.sampleValue) || []

      return new Response(JSON.stringify({
        success: true, mode: 'discover',
        totalFetched: allProps.length,
        reopCount: allProps.filter((p: any) => isREOPProperty(p)).length,
        reopSamples,
        nonReopSamples,
        matchResults,
        hubProfiles: profiles.map(p => p.fullName),
        fieldKeys,
        contractStatusValues: [...statusValues],
        teamNameValues: [...teamNameValues],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- SYNC ---
    const allProperties = await fetchAllProperties(apiKey)
    const profiles = await loadProfiles(supabase)
    console.log(`Starting sync: ${allProperties.length} properties, ${profiles.length} profiles`)

    const result = await syncProperties(supabase, allProperties, profiles)
    console.log(`Sync done: ${result.syncedCount} synced, ${result.skippedNotREOP} skipped (not REOP), ${result.errorCount} errors`)
    if (result.unmatchedAgents.length > 0) {
      console.log('Unmatched REOP agents (synced but no Hub match):', result.unmatchedAgents.join(' | '))
    }
    if (result.matchedAgents.length > 0) {
      console.log('Matched agents:', result.matchedAgents.join(' | '))
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

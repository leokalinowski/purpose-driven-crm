// ============================================================
// Pipeline Stage Definitions — single source of truth
// Used by PipelineBoard, OpportunityDetailDrawer, AddOpportunityDialog
// ============================================================

export type PipelineType = 'buyer' | 'seller' | 'referral';

export interface PipelineStage {
  key: string;
  label: string;
  pipelineType: PipelineType;
  /** Tailwind classes for the column background + border */
  color: string;
  /** Hex for the card left-border accent */
  accent: string;
  description: string;
  /** Whether landing here marks a deal as won/lost */
  terminal?: 'won' | 'lost';
}

// ── Buyer Stages ───────────────────────────────────────────────────��──────────
export const BUYER_STAGES: PipelineStage[] = [
  { key: 'new_lead',        label: 'New Lead',         pipelineType: 'buyer',  color: 'bg-slate-50 border-slate-200',   accent: '#94a3b8', description: 'Just entered the system' },
  { key: 'nurturing',       label: 'Nurturing',        pipelineType: 'buyer',  color: 'bg-purple-50 border-purple-200', accent: '#a855f7', description: 'Long-term — not yet active' },
  { key: 'active_search',   label: 'Active Search',    pipelineType: 'buyer',  color: 'bg-blue-50 border-blue-200',     accent: '#3b82f6', description: 'Pre-approved, actively searching' },
  { key: 'showing',         label: 'Showing',          pipelineType: 'buyer',  color: 'bg-yellow-50 border-yellow-200', accent: '#eab308', description: 'Actively touring properties' },
  { key: 'offer_submitted', label: 'Offer Out',        pipelineType: 'buyer',  color: 'bg-orange-50 border-orange-200', accent: '#f97316', description: 'Offer submitted, awaiting response' },
  { key: 'under_contract',  label: 'Under Contract',   pipelineType: 'buyer',  color: 'bg-amber-50 border-amber-200',   accent: '#f59e0b', description: 'Mutual acceptance, in escrow' },
  { key: 'closed_won',      label: 'Closed — Bought',  pipelineType: 'buyer',  color: 'bg-green-50 border-green-200',   accent: '#22c55e', description: 'Transaction complete', terminal: 'won' },
  { key: 'lost',            label: 'Lost',             pipelineType: 'buyer',  color: 'bg-red-50 border-red-200',       accent: '#ef4444', description: 'Chose another agent or no longer buying', terminal: 'lost' },
];

// ── Seller Stages ─────────────────────────────────────────────────────────────
export const SELLER_STAGES: PipelineStage[] = [
  { key: 'new_lead',        label: 'New Lead',         pipelineType: 'seller', color: 'bg-slate-50 border-slate-200',   accent: '#94a3b8', description: 'Just entered the system' },
  { key: 'nurturing',       label: 'Nurturing',        pipelineType: 'seller', color: 'bg-purple-50 border-purple-200', accent: '#a855f7', description: 'Long-term — not yet active' },
  { key: 'pre_listing',     label: 'Pre-Listing',      pipelineType: 'seller', color: 'bg-sky-50 border-sky-200',       accent: '#0ea5e9', description: 'Preparing for listing appointment' },
  { key: 'listing_appt',    label: 'Listing Appt',     pipelineType: 'seller', color: 'bg-blue-50 border-blue-200',     accent: '#3b82f6', description: 'Listing presentation scheduled' },
  { key: 'listed_active',   label: 'Listed — Active',  pipelineType: 'seller', color: 'bg-yellow-50 border-yellow-200', accent: '#eab308', description: 'On the market' },
  { key: 'offer_received',  label: 'Offer Received',   pipelineType: 'seller', color: 'bg-orange-50 border-orange-200', accent: '#f97316', description: 'Offer in hand, negotiating' },
  { key: 'under_contract',  label: 'Under Contract',   pipelineType: 'seller', color: 'bg-teal-50 border-teal-200',     accent: '#14b8a6', description: 'Mutual acceptance, in escrow' },
  { key: 'closed_won',      label: 'Closed — Sold',    pipelineType: 'seller', color: 'bg-green-50 border-green-200',   accent: '#22c55e', description: 'Transaction complete', terminal: 'won' },
  { key: 'lost',            label: 'Lost',             pipelineType: 'seller', color: 'bg-red-50 border-red-200',       accent: '#ef4444', description: 'Did not get the listing', terminal: 'lost' },
];

// ── Referral Stages ───────────────────────────────────────────────────────────
export const REFERRAL_STAGES: PipelineStage[] = [
  { key: 'referral_received', label: 'Received',      pipelineType: 'referral', color: 'bg-blue-50 border-blue-200',   accent: '#3b82f6', description: 'Referral just received' },
  { key: 'contacted',         label: 'Contacted',     pipelineType: 'referral', color: 'bg-yellow-50 border-yellow-200', accent: '#eab308', description: 'First contact made' },
  { key: 'active',            label: 'Active',        pipelineType: 'referral', color: 'bg-green-50 border-green-200', accent: '#22c55e', description: 'Actively working deal' },
  { key: 'referral_sent',     label: 'Sent Out',      pipelineType: 'referral', color: 'bg-purple-50 border-purple-200', accent: '#a855f7', description: 'Referral sent to another agent' },
  { key: 'closed_won',        label: 'Closed',        pipelineType: 'referral', color: 'bg-teal-50 border-teal-200',   accent: '#14b8a6', description: 'Deal closed, fee collected', terminal: 'won' },
  { key: 'lost',              label: 'Lost',          pipelineType: 'referral', color: 'bg-red-50 border-red-200',     accent: '#ef4444', description: 'Referral lost', terminal: 'lost' },
];

// ── Helpers ──────────────────────────────────���────────────────────────────────

export function getStagesForType(type: PipelineType | 'all'): PipelineStage[] {
  switch (type) {
    case 'buyer':   return BUYER_STAGES;
    case 'seller':  return SELLER_STAGES;
    case 'referral': return REFERRAL_STAGES;
    case 'all': {
      // Deduplicate by key, buyer takes precedence for shared keys (new_lead, etc.)
      const seen = new Set<string>();
      const all: PipelineStage[] = [];
      for (const s of [...BUYER_STAGES, ...SELLER_STAGES, ...REFERRAL_STAGES]) {
        if (!seen.has(s.key)) { seen.add(s.key); all.push(s); }
      }
      return all;
    }
  }
}

export function getStageByKey(key: string, type?: PipelineType): PipelineStage | undefined {
  const pool = type ? getStagesForType(type) : getStagesForType('all');
  return pool.find(s => s.key === key);
}

export function getStageLabel(key: string, type?: PipelineType): string {
  return getStageByKey(key, type)?.label ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getStageColor(key: string, type?: PipelineType): string {
  return getStageByKey(key, type)?.color ?? 'bg-muted border-border';
}

export function getStageAccent(key: string, type?: PipelineType): string {
  return getStageByKey(key, type)?.accent ?? '#94a3b8';
}

export function getNextStage(key: string, type: PipelineType): string | null {
  const stages = getStagesForType(type).filter(s => !s.terminal);
  const idx = stages.findIndex(s => s.key === key);
  if (idx === -1 || idx >= stages.length - 1) return null;
  return stages[idx + 1].key;
}

/** Returns the pipeline_type string from opportunity_type */
export function pipelineTypeFromOpportunityType(opportunityType: string): PipelineType {
  if (['seller', 'landlord'].includes(opportunityType)) return 'seller';
  if (['referral_out', 'referral_in'].includes(opportunityType)) return 'referral';
  return 'buyer';
}

/** Color class for type badges */
export function pipelineTypeBadgeClass(type: PipelineType): string {
  switch (type) {
    case 'buyer':   return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'seller':  return 'bg-green-100 text-green-800 border-green-200';
    case 'referral': return 'bg-purple-100 text-purple-800 border-purple-200';
  }
}

export const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  buyer:        'Buyer',
  seller:       'Seller',
  referral_out: 'Referral Out',
  referral_in:  'Referral In',
  landlord:     'Landlord',
  tenant:       'Tenant',
  investor:     'Investor',
};

// ── Meta-stages — unified 4-column board ─────────────────────────────────────
// Phase 3 of the AI-first Hub: collapse 8+ per-type stages into 4 meta-stages.
// The fine-grained `stage` column on opportunities is preserved (shown as a
// sub-status pill on each card and editable via the Move-to-stage dropdown).

export type MetaStage = 'nurturing' | 'active' | 'pending' | 'closed';

export interface MetaStageDef {
  key: MetaStage;
  label: string;
  description: string;
  accent: string;                 // card left-border + accent dot
  color: string;                  // Tailwind bg/border for the column
  order: number;
}

export const META_STAGES: MetaStageDef[] = [
  { key: 'nurturing', order: 0, label: 'Nurturing', description: 'Long-term relationship, not yet transacting',  accent: '#a855f7', color: 'bg-purple-50/40 border-purple-200' },
  { key: 'active',    order: 1, label: 'Active',    description: 'Actively working with this client',             accent: '#3b82f6', color: 'bg-blue-50/40 border-blue-200' },
  { key: 'pending',   order: 2, label: 'Pending',   description: 'Offer out or under contract, awaiting close',   accent: '#f97316', color: 'bg-orange-50/40 border-orange-200' },
  { key: 'closed',    order: 3, label: 'Closed',    description: 'Deal complete',                                 accent: '#22c55e', color: 'bg-green-50/40 border-green-200' },
];

/** Map every specific stage key (all pipeline types) to its meta-stage. */
export const STAGE_TO_META: Record<string, MetaStage> = {
  // Nurturing — early / dormant
  new_lead:           'nurturing',
  nurturing:          'nurturing',
  referral_received:  'nurturing',
  // Active — working the deal
  active_search:      'active',
  showing:            'active',
  pre_listing:        'active',
  listing_appt:       'active',
  listed_active:      'active',
  contacted:          'active',
  active:             'active',
  referral_sent:      'active',
  // Pending — negotiated, awaiting close
  offer_submitted:    'pending',
  offer_received:     'pending',
  under_contract:     'pending',
  // Closed
  closed_won:         'closed',
  // `lost` is intentionally NOT mapped — filtered out of the board by default
};

/**
 * Default specific sub-stage to use when dragging a card INTO a meta-stage.
 * Keyed by pipeline_type so a buyer card dropped in Pending becomes `offer_submitted`,
 * a seller card becomes `offer_received`, etc.
 */
export const META_STAGE_DEFAULT_SUB: Record<PipelineType, Record<MetaStage, string>> = {
  buyer:    { nurturing: 'nurturing',          active: 'active_search', pending: 'offer_submitted', closed: 'closed_won' },
  seller:   { nurturing: 'nurturing',          active: 'pre_listing',   pending: 'offer_received',  closed: 'closed_won' },
  referral: { nurturing: 'referral_received',  active: 'active',        pending: 'referral_sent',   closed: 'closed_won' },
};

export function getMetaStageForKey(stageKey: string | null | undefined): MetaStage | null {
  if (!stageKey) return null;
  return STAGE_TO_META[stageKey] ?? null;
}

/** Default sub-stage when the user drops a card into a meta-column. */
export function defaultSubStage(meta: MetaStage, pipelineType: PipelineType): string {
  return META_STAGE_DEFAULT_SUB[pipelineType][meta];
}

/** Human label for a specific stage — falls back to title-casing the key. */
export function subStageLabel(stageKey: string | null | undefined, pipelineType?: PipelineType): string {
  if (!stageKey) return '—';
  return getStageLabel(stageKey, pipelineType);
}

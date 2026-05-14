// ============================================================
// Pipeline Stage Definitions — single source of truth
//
// Adopted Pam's flat 7-stage model (April 10, 2026 brief). All
// opportunities — regardless of buyer/seller/referral — flow through
// the same 7 stages. The opportunity_type field is preserved as an
// independent card badge but no longer drives separate stage tracks.
//
// `lost` is a special 8th terminal stage, off the kanban by default
// (filter-accessible). `null` stage = sphere-only opportunity (in the
// opportunities table but not on the board).
// ============================================================

export type PipelineType = 'buyer' | 'seller' | 'referral';

export type StageKey =
  | 'conversation_active'
  | 'opportunity_identified'
  | 'consultation_completed'
  | 'client_secured'
  | 'active_opportunity'
  | 'under_contract'
  | 'closed'
  | 'lost';

export interface PipelineStage {
  key: StageKey;
  /** Sentence-case label for badges, dropdowns, detail card */
  label: string;
  /** Short, all-caps label for kanban column headers */
  shortLabel: string;
  /** Tailwind column background + border */
  color: string;
  /** Hex accent for card left-border + dots */
  accent: string;
  description: string;
  /** When set, this is a final state */
  terminal?: 'won' | 'lost';
  /** When true, hidden from the default kanban board (filterable) */
  offBoard?: boolean;
}

// ── The 7 (+1) stages ──────────────────────────────────────────────────────
// Ordering: top-of-funnel → close. Color progression cool → warm → green
// mirrors momentum / closeness to GCI. `lost` is terminal and off-board.

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    key: 'conversation_active',
    label: 'Conversation active',
    shortLabel: 'CONVERSATION ACTIVE',
    color: 'bg-slate-50 border-slate-200',
    accent: '#94a3b8',
    description: 'First chat — just entered the pipeline',
  },
  {
    key: 'opportunity_identified',
    label: 'Opportunity identified',
    shortLabel: 'OPPORTUNITY',
    color: 'bg-blue-50 border-blue-200',
    accent: '#3b82f6',
    description: 'Confirmed real buyer/seller intent',
  },
  {
    key: 'consultation_completed',
    label: 'Consultation completed',
    shortLabel: 'CONSULT DONE',
    color: 'bg-sky-50 border-sky-200',
    accent: '#0ea5e9',
    description: 'Buyer consult or listing presentation done',
  },
  {
    key: 'client_secured',
    label: 'Client secured',
    shortLabel: 'CLIENT SECURED',
    color: 'bg-yellow-50 border-yellow-200',
    accent: '#eab308',
    description: 'Buyer rep or listing agreement signed',
  },
  {
    key: 'active_opportunity',
    label: 'Active opportunity',
    shortLabel: 'ACTIVE',
    color: 'bg-orange-50 border-orange-200',
    accent: '#f97316',
    description: 'Buyer touring or listing live on the market',
  },
  {
    key: 'under_contract',
    label: 'Under contract',
    shortLabel: 'UNDER CONTRACT',
    color: 'bg-amber-50 border-amber-200',
    accent: '#f59e0b',
    description: 'Offer accepted, in escrow',
  },
  {
    key: 'closed',
    label: 'Closed',
    shortLabel: 'CLOSED',
    color: 'bg-green-50 border-green-200',
    accent: '#22c55e',
    description: 'Transaction complete',
    terminal: 'won',
  },
  {
    key: 'lost',
    label: 'Lost',
    shortLabel: 'LOST',
    color: 'bg-red-50 border-red-200',
    accent: '#ef4444',
    description: 'Dead lead or withdrew',
    terminal: 'lost',
    offBoard: true,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** All stages including off-board (used by stage pickers, history). */
export function getAllStages(): PipelineStage[] {
  return PIPELINE_STAGES;
}

/** Stages that render as kanban columns (excludes `lost`). */
export function getBoardStages(): PipelineStage[] {
  return PIPELINE_STAGES.filter((s) => !s.offBoard);
}

export function getStageByKey(key: string | null | undefined): PipelineStage | undefined {
  if (!key) return undefined;
  return PIPELINE_STAGES.find((s) => s.key === key);
}

/** Sentence-case label (for badges, dropdowns, detail card). */
export function getStageLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return (
    getStageByKey(key)?.label ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** All-caps short label (for kanban column headers). */
export function getStageShortLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return getStageByKey(key)?.shortLabel ?? getStageLabel(key).toUpperCase();
}

export function getStageColor(key: string | null | undefined): string {
  return getStageByKey(key)?.color ?? 'bg-muted border-border';
}

export function getStageAccent(key: string | null | undefined): string {
  return getStageByKey(key)?.accent ?? '#94a3b8';
}

/** Next non-terminal stage in the canonical order, or null when at the end. */
export function getNextStage(key: string): StageKey | null {
  const flow = PIPELINE_STAGES.filter((s) => !s.terminal);
  const idx = flow.findIndex((s) => s.key === key);
  if (idx === -1 || idx >= flow.length - 1) return null;
  return flow[idx + 1].key;
}

// ── opportunity_type → PipelineType mapping (kept for the type BADGE) ─────
// The opportunity_type column still distinguishes buyer/seller/referral
// for card badges + filters. Stages are no longer type-specific.

export function pipelineTypeFromOpportunityType(opportunityType: string | null | undefined): PipelineType {
  if (!opportunityType) return 'buyer';
  if (['seller', 'landlord'].includes(opportunityType)) return 'seller';
  if (['referral_out', 'referral_in'].includes(opportunityType)) return 'referral';
  if (!['buyer', 'tenant', 'investor'].includes(opportunityType)) {
    console.warn(
      `[pipelineStages] Unknown opportunity_type "${opportunityType}" — defaulting to buyer badge. ` +
        `Add to pipelineTypeFromOpportunityType() to silence.`,
    );
  }
  return 'buyer';
}

export function getEffectivePipelineType(opp: {
  pipeline_type?: string | null;
  opportunity_type?: string | null;
}): PipelineType {
  if (opp.pipeline_type === 'buyer' || opp.pipeline_type === 'seller' || opp.pipeline_type === 'referral') {
    return opp.pipeline_type;
  }
  return pipelineTypeFromOpportunityType(opp.opportunity_type ?? 'buyer');
}

export function pipelineTypeBadgeClass(type: PipelineType): string {
  switch (type) {
    case 'buyer':    return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'seller':   return 'bg-green-100 text-green-800 border-green-200';
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

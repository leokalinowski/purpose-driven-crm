import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { getStageByKey } from '@/config/pipelineStages';

// ── Module-level cache ──────────────────────────────────────────────────
// Pipeline data is referenced by the Dashboard hero, the Modules row, and
// the Pipeline board — each previously triggered its own fetch on mount
// and flashed the loading state on every navigation back to `/`. We cache
// the last fetched payload per user with a short TTL so subsequent mounts
// hydrate instantly. Mutations (stage moves, create/update/delete) bust
// the cache by re-fetching with `force: true`.

const PIPELINE_CACHE_TTL_MS = 60_000;

interface PipelineCacheEntry {
  opportunities: Opportunity[];
  fetchedAt: number;
}
const pipelineCache = new Map<string, PipelineCacheEntry>();

export interface Opportunity {
  id: string;
  agent_id: string;
  contact_id: string;
  // ── Classification ────────────────────────────────────────────────────────
  // `stage` is nullable since the Pam migration — NULL = sphere-only
  // opportunity (in the table but not on the kanban board).
  stage: string | null;
  opportunity_type: string;     // buyer | seller | referral_out | referral_in | landlord | tenant | investor
  pipeline_type: string | null; // generated: buyer | seller | referral
  title: string | null;
  // ── Core ─────────────────────────────────────────────────────────────────
  deal_value: number | null;
  expected_close_date: string | null;
  actual_close_date: string | null;
  notes: string | null;
  // ── Property ──────────────────────────────────────────────────────────────
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  property_type: string | null;
  property_beds: number | null;
  property_baths: number | null;
  property_sqft: number | null;
  property_year_built: number | null;
  property_mls_number: string | null;
  property_url: string | null;
  // ── Financial ─────────────────────────────────────────────────────────────
  list_price: number | null;
  offer_price: number | null;
  sale_price: number | null;
  commission_pct: number | null;
  commission_amount: number | null;
  gci_estimated: number | null;
  gci_actual: number | null;
  referral_fee_pct: number | null;
  referral_agent_name: string | null;
  referral_brokerage: string | null;
  // ── Timeline ──────────────────────────────────────────────────────────────
  first_contact_date: string | null;
  target_move_date: string | null;
  listing_appointment_date: string | null;
  offer_date: string | null;
  contract_date: string | null;
  inspection_date: string | null;
  appraisal_date: string | null;
  loan_contingency_removal: string | null;
  closing_date_scheduled: string | null;
  // ── AI ────────────────────────────────────────────────────────────────────
  ai_deal_probability: number | null;
  ai_summary: string | null;
  ai_suggested_next_action: string | null;
  ai_risk_flags: string[] | null;
  ai_scored_at: string | null;
  next_step_title: string | null;
  next_step_due_date: string | null;
  confidence: string | null;
  last_activity_date: string | null;
  /**
   * Server-managed: set by the `generate-agent-intelligence` edge function on
   * its nightly run when the opportunity has had no activity within the
   * stage-specific stale threshold. Read-only on the client — DO NOT include
   * in any update payload (saveDeal strips it via the COMPUTED_OR_JOINED set).
   */
  is_stale: boolean;
  stale_since: string | null;
  /**
   * Server-managed: reset to 0 by the `trg_log_opportunity_stage_change`
   * BEFORE-UPDATE trigger whenever `stage` changes. Increments are also
   * trigger-driven. Read-only on the client.
   */
  days_in_current_stage: number;
  // ── Status ────────────────────────────────────────────────────────────────
  outcome: string | null;
  lost_reason: string | null;
  lost_reason_notes: string | null;
  on_hold_until: string | null;
  priority: number;
  // ── Timestamps ───────────────────────────────────────────────────────────
  created_at: string;
  updated_at: string;
  // ── Contact (joined) ──────────────────────────────────────────────────────
  contact?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    zip_code: string;
    dnc: boolean;
    dnc_last_checked: string;
    tags: string[];
    notes: string;
    category: string;
    // Pipeline profile
    contact_type: string | null;
    pipeline_active: boolean;
    pipeline_stage_summary: string | null;
    relationship_strength: number | null;
    move_timeline: string | null;
    buyer_pre_approval_status: string | null;
    buyer_price_min: number | null;
    buyer_price_max: number | null;
    buyer_lender_name: string | null;
    buyer_loan_type: string | null;
    seller_listing_timeline: string | null;
    seller_estimated_value: number | null;
    motivation_score: number | null;
    life_event: string | null;
  };
}

export interface PipelineMetrics {
  pipelineValue: number;
  /** Win rate is null when no opportunity has reached a terminal outcome yet. */
  winRate: number | null;
  avgCloseTime: number;
  totalOpportunities: number;
  closedDeals: number;
  stageBreakdown: Record<string, number>;
  // AI-enhanced
  totalGciEstimated: number;
  avgDealProbability: number | null;
  staleCount: number;
}

// Pure metrics calculator — kept at module scope so the cached-state
// initializer in usePipeline() can rebuild PipelineMetrics from a cached
// opportunities array without re-running the network query.
function computeMetricsForCache(data: Opportunity[]): PipelineMetrics {
  const isClosedWon = (o: Opportunity) => o.stage === 'closed';
  const isLost = (o: Opportunity) => o.stage === 'lost' || o.outcome === 'lost' || o.outcome === 'withdrawn';
  const active = data.filter((o) => !isClosedWon(o) && !isLost(o));
  const closed = data.filter(isClosedWon);
  const lost = data.filter(isLost);
  const pipelineValue = active.reduce((s, o) => s + (o.deal_value ?? 0), 0);
  const totalGciEstimated = active.reduce((s, o) => s + (o.gci_estimated ?? 0), 0);
  const decided = closed.length + lost.length;
  const winRate = decided > 0 ? (closed.length / decided) * 100 : null;
  const closedWithDates = closed.filter((o) => o.actual_close_date);
  const avgCloseTime =
    closedWithDates.length > 0
      ? closedWithDates.reduce(
          (s, o) =>
            s +
            (new Date(o.actual_close_date!).getTime() - new Date(o.created_at).getTime()),
          0,
        ) / closedWithDates.length / (1000 * 60 * 60 * 24)
      : 0;
  const stageBreakdown = data.reduce((acc, o) => {
    acc[o.stage as string] = (acc[o.stage as string] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const scored = active.filter((o) => o.ai_deal_probability != null);
  const avgDealProbability =
    scored.length > 0
      ? Math.round(scored.reduce((s, o) => s + (o.ai_deal_probability ?? 0), 0) / scored.length)
      : null;
  const staleCount = active.filter((o) => o.is_stale).length;
  return {
    pipelineValue,
    winRate,
    avgCloseTime,
    totalOpportunities: data.length,
    closedDeals: closed.length,
    stageBreakdown,
    totalGciEstimated,
    avgDealProbability,
    staleCount,
  };
}

export function usePipeline() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Hydrate from the module cache on first render so navigations back to
  // the Dashboard within the TTL skip the loading flash entirely.
  const cached = user?.id ? pipelineCache.get(user.id) : undefined;
  const cacheIsFresh = cached ? Date.now() - cached.fetchedAt < PIPELINE_CACHE_TTL_MS : false;

  const [opportunities, setOpportunities] = useState<Opportunity[]>(cached?.opportunities ?? []);
  // Track which unmapped stages we've already warned about per session, so the
  // Phase 1.4 toast doesn't re-fire on every re-fetch. Cleared automatically
  // when the agent navigates away (hook unmount).
  const warnedUnmappedStages = useRef<Set<string>>(new Set());
  const [metrics, setMetrics] = useState<PipelineMetrics>(() =>
    cached ? computeMetricsForCache(cached.opportunities) : {
      pipelineValue: 0,
      winRate: null,
      avgCloseTime: 0,
      totalOpportunities: 0,
      closedDeals: 0,
      stageBreakdown: {},
      totalGciEstimated: 0,
      avgDealProbability: null,
      staleCount: 0,
    },
  );
  // Loading is false when we already have a fresh cached snapshot — the
  // background re-fetch is silent. Stale cache still shows data while a
  // refresh happens, but `loading` stays true so consumers can decide.
  const [loading, setLoading] = useState(!cacheIsFresh);

  const fetchOpportunities = async (opts: { force?: boolean } = {}) => {
    // No user (logout, pre-auth, or token expiry): clear data and stop the
    // skeleton. Returning early without resetting loading was leaving the
    // Pipeline board stuck in its 4-column shimmer forever for unauthenticated
    // visitors — flagged in the Pipeline UX audit as Must Fix #1.
    if (!user?.id) {
      setOpportunities([]);
      setLoading(false);
      return;
    }
    // Cache hit and not a forced refresh — skip network, keep state.
    const entry = pipelineCache.get(user.id);
    if (!opts.force && entry && Date.now() - entry.fetchedAt < PIPELINE_CACHE_TTL_MS) {
      setOpportunities(entry.opportunities);
      calculateMetrics(entry.opportunities);
      setLoading(false);
      return;
    }
    // Only show the loading skeleton when we have nothing to render yet.
    // A stale cache stays visible while the background refetch runs.
    if (!entry) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          contact:contacts(
            first_name, last_name, email, phone,
            address_1, address_2, city, state, zip_code,
            dnc, dnc_last_checked, tags, notes, category,
            contact_type, pipeline_active, pipeline_stage_summary,
            relationship_strength, move_timeline,
            buyer_pre_approval_status, buyer_price_min, buyer_price_max,
            buyer_lender_name, buyer_loan_type,
            seller_listing_timeline, seller_estimated_value,
            motivation_score, life_event
          )
        `)
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const data_ = (data || []) as Opportunity[];
      pipelineCache.set(user.id, { opportunities: data_, fetchedAt: Date.now() });
      setOpportunities(data_);
      calculateMetrics(data_);

      // Detect unrecognized stages (drift from the canonical 7 + lost).
      // Sphere-only rows (stage = null) are expected and silent. Log once
      // per session per value so the dev console catches schema drift
      // without spamming the agent.
      for (const o of data_) {
        if (o.stage && !getStageByKey(o.stage) && !warnedUnmappedStages.current.has(o.stage)) {
          console.warn(
            `[usePipeline] Stage "${o.stage}" is not a recognized pipeline stage; row hidden from board.`,
          );
          warnedUnmappedStages.current.add(o.stage);
        }
      }
    } catch (error: any) {
      console.error('Failed to load pipeline:', error);
      toast({ title: 'Error', description: 'Failed to load pipeline data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (data: Opportunity[]) => {
    setMetrics(computeMetricsForCache(data));
  };

  const updateStage = async (opportunityId: string, newStage: string) => {
    if (!user) return;
    const opp = opportunities.find(o => o.id === opportunityId);
    const previousStage = opp?.stage;

    // Optimistic update — moves the card instantly
    setOpportunities(prev =>
      prev.map(o => o.id === opportunityId ? { ...o, stage: newStage } : o)
    );

    try {
      const updateData: any = { stage: newStage, updated_at: new Date().toISOString() };
      if (newStage === 'closed') updateData.actual_close_date = new Date().toISOString();
      if (newStage === 'lost') updateData.outcome = 'lost';

      // Phase 4.1: chain `.select()` so we can detect 0-row updates. Without
      // this, supabase.update() returned `error: null` even when RLS blocked
      // the row — the optimistic flip stuck for ~3s and then snapped back via
      // the next refetch with no error toast. With the select, RLS denial
      // returns an empty data array, which we treat as an explicit failure.
      const { data: updated, error } = await supabase
        .from('opportunities')
        .update(updateData)
        .eq('id', opportunityId)
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error(
          'Update affected 0 rows. This is usually an RLS policy denying the change — ' +
          'either you don\'t own this opportunity or its row was deleted.',
        );
      }

      // Playbook task generation — silently fire-and-forget. The
      // `pipeline-stage-tasks` edge function currently returns 403 on every
      // call (auth bug to fix in the function itself, not here). The previous
      // toast that surfaced the failure was misread as the drag itself
      // failing — strictly noise from the agent's POV. Console.warn is enough
      // until the function is repaired.
      const pipelineType = opp?.pipeline_type ?? 'buyer';
      supabase.functions
        .invoke('pipeline-stage-tasks', {
          body: { opportunity_id: opportunityId, new_stage: newStage, pipeline_type: pipelineType, agent_id: user.id },
        })
        .catch(e => console.warn('[pipeline-stage-tasks] failed (non-fatal):', e));

      // Re-fetch in background to sync computed columns (days_in_current_stage,
      // is_stale flags, etc.) that the BEFORE-UPDATE trigger resets.
      fetchOpportunities({ force: true });
    } catch (error: any) {
      // Phase 4.3: don't trust local state for the revert. The optimistic
      // setOpportunities above already mutated the array, so re-deriving the
      // "previous" stage from the now-stale `prev` snapshot is unreliable.
      // Force a fresh fetch from server truth. The toast must precede the
      // fetch so the agent sees the error, but the visual revert happens
      // when the fetch lands.
      toast({
        title: 'Failed to update stage',
        description: error?.message ?? 'Unknown error. The card snapped back to its previous position.',
        variant: 'destructive',
      });
      // Best-effort optimistic revert in case the refetch is slow.
      if (previousStage) {
        setOpportunities(prev =>
          prev.map(o => o.id === opportunityId ? { ...o, stage: previousStage } : o)
        );
      }
      await fetchOpportunities({ force: true });
    }
  };

  const createOpportunity = async (data: Partial<Opportunity>) => {
    if (!user?.id) return false;
    try {
      const { error } = await supabase.from('opportunities').insert({
        contact_id: data.contact_id,
        stage: data.stage || 'conversation_active',
        opportunity_type: (data as any).opportunity_type || 'buyer',
        title: (data as any).title ?? null,
        deal_value: data.deal_value ?? 0,
        expected_close_date: data.expected_close_date ?? null,
        notes: data.notes ?? null,
        commission_pct: (data as any).commission_pct ?? null,
        agent_id: user.id,
      });
      if (error) throw error;
      await fetchOpportunities({ force: true });
      toast({ title: 'Opportunity created' });
      return true;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const updateOpportunity = async (opportunityId: string, data: Partial<Opportunity>) => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', opportunityId);
      if (error) throw error;
      await fetchOpportunities({ force: true });
      toast({ title: 'Opportunity updated' });
      return true;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const deleteOpportunity = async (opportunityId: string) => {
    try {
      const { error } = await supabase.from('opportunities').delete().eq('id', opportunityId);
      if (error) throw error;
      await fetchOpportunities({ force: true });
      toast({ title: 'Opportunity deleted' });
      return true;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const updateContact = async (contactId: string, contactData: any) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ ...contactData, updated_at: new Date().toISOString() })
        .eq('id', contactId);
      if (error) throw error;
      if (contactData.phone) {
        supabase.functions.invoke('dnc-single-check', { body: { contactId } }).catch(() => {});
      }
      await fetchOpportunities({ force: true });
      toast({ title: 'Contact updated' });
      return true;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const refreshAIScores = async (opportunityId?: string) => {
    if (!user) return;
    try {
      const body: any = { agent_id: user.id };
      if (opportunityId) body.opportunity_id = opportunityId;
      const { error } = await supabase.functions.invoke('pipeline-score-opportunities', { body });
      if (error) throw error;
      await fetchOpportunities({ force: true });
      toast({ title: 'AI scores refreshed' });
    } catch (err: any) {
      toast({ title: 'Error', description: 'AI scoring failed: ' + err.message, variant: 'destructive' });
    }
  };

  useEffect(() => { fetchOpportunities(); }, [user?.id]);

  return {
    opportunities,
    metrics,
    loading,
    updateStage,
    createOpportunity,
    updateOpportunity,
    deleteOpportunity,
    updateContact,
    refreshAIScores,
    // Public refresh always bypasses the cache — the manual refresh
    // button and any consumer that calls .refresh() expects fresh data.
    refresh: () => fetchOpportunities({ force: true }),
  };
}

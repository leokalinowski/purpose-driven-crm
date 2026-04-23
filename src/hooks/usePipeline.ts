import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Opportunity {
  id: string;
  agent_id: string;
  contact_id: string;
  // ── Classification ────────────────────────────────────────────────────────
  stage: string;
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
  is_stale: boolean;
  stale_since: string | null;
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
  winRate: number;
  avgCloseTime: number;
  totalOpportunities: number;
  closedDeals: number;
  stageBreakdown: Record<string, number>;
  // AI-enhanced
  totalGciEstimated: number;
  avgDealProbability: number | null;
  staleCount: number;
}

export function usePipeline() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    pipelineValue: 0,
    winRate: 0,
    avgCloseTime: 0,
    totalOpportunities: 0,
    closedDeals: 0,
    stageBreakdown: {},
    totalGciEstimated: 0,
    avgDealProbability: null,
    staleCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchOpportunities = async () => {
    if (!user?.id) return;
    setLoading(true);
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
      setOpportunities(data_);
      calculateMetrics(data_);
    } catch (error: any) {
      console.error('Failed to load pipeline:', error);
      toast({ title: 'Error', description: 'Failed to load pipeline data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (data: Opportunity[]) => {
    const active = data.filter(o => !o.actual_close_date && o.outcome !== 'lost' && o.outcome !== 'withdrawn');
    const closed = data.filter(o => o.stage === 'closed_won' || o.actual_close_date);
    const pipelineValue = active.reduce((s, o) => s + (o.deal_value ?? 0), 0);
    const totalGciEstimated = active.reduce((s, o) => s + (o.gci_estimated ?? 0), 0);
    const winRate = data.length > 0 ? (closed.length / data.length) * 100 : 0;

    const closedWithDates = closed.filter(o => o.actual_close_date);
    const avgCloseTime = closedWithDates.length > 0
      ? closedWithDates.reduce((s, o) => s + (new Date(o.actual_close_date!).getTime() - new Date(o.created_at).getTime()), 0)
        / closedWithDates.length / (1000 * 60 * 60 * 24)
      : 0;

    const stageBreakdown = data.reduce((acc, o) => {
      acc[o.stage] = (acc[o.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const scored = active.filter(o => o.ai_deal_probability != null);
    const avgDealProbability = scored.length > 0
      ? Math.round(scored.reduce((s, o) => s + (o.ai_deal_probability ?? 0), 0) / scored.length)
      : null;

    const staleCount = active.filter(o => o.is_stale).length;

    setMetrics({ pipelineValue, winRate, avgCloseTime, totalOpportunities: data.length, closedDeals: closed.length, stageBreakdown, totalGciEstimated, avgDealProbability, staleCount });
  };

  const updateStage = async (opportunityId: string, newStage: string) => {
    if (!user) return;
    try {
      const opp = opportunities.find(o => o.id === opportunityId);
      const updateData: any = { stage: newStage, updated_at: new Date().toISOString() };
      if (newStage === 'closed_won') updateData.actual_close_date = new Date().toISOString();
      if (newStage === 'lost') updateData.outcome = 'lost';

      const { error } = await supabase.from('opportunities').update(updateData).eq('id', opportunityId);
      if (error) throw error;

      // Fire playbook task generation (non-fatal)
      try {
        const pipelineType = opp?.pipeline_type ?? 'buyer';
        await supabase.functions.invoke('pipeline-stage-tasks', {
          body: { opportunity_id: opportunityId, new_stage: newStage, pipeline_type: pipelineType, agent_id: user.id },
        });
      } catch (e) {
        console.warn('Playbook task generation failed (non-fatal):', e);
      }

      await fetchOpportunities();
      toast({ title: 'Stage updated', description: `Moved to ${newStage.replace(/_/g, ' ')}` });
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to update stage', variant: 'destructive' });
    }
  };

  const createOpportunity = async (data: Partial<Opportunity>) => {
    if (!user?.id) return false;
    try {
      const { error } = await supabase.from('opportunities').insert({
        contact_id: data.contact_id,
        stage: data.stage || 'new_lead',
        opportunity_type: (data as any).opportunity_type || 'buyer',
        title: (data as any).title ?? null,
        deal_value: data.deal_value ?? 0,
        expected_close_date: data.expected_close_date ?? null,
        notes: data.notes ?? null,
        commission_pct: (data as any).commission_pct ?? null,
        agent_id: user.id,
      });
      if (error) throw error;
      await fetchOpportunities();
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
      await fetchOpportunities();
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
      await fetchOpportunities();
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
      await fetchOpportunities();
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
      await fetchOpportunities();
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
    refresh: fetchOpportunities,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ContactOpportunitySummary {
  id: string;
  title: string | null;
  opportunity_type: string;
  pipeline_type: string | null;
  stage: string;
  deal_value: number | null;
  gci_estimated: number | null;
  outcome: string | null;
  created_at: string;
  actual_close_date: string | null;
  ai_deal_probability: number | null;
  ai_suggested_next_action: string | null;
}

export function useContactOpportunities(contactId: string | null) {
  const [opportunities, setOpportunities] = useState<ContactOpportunitySummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOpportunities = useCallback(async () => {
    if (!contactId) { setOpportunities([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, title, opportunity_type, pipeline_type, stage, deal_value, gci_estimated, outcome, created_at, actual_close_date, ai_deal_probability, ai_suggested_next_action')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOpportunities((data ?? []) as ContactOpportunitySummary[]);
    } catch (err) {
      console.error('useContactOpportunities error:', err);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { fetchOpportunities(); }, [fetchOpportunities]);

  const activeOpportunities = opportunities.filter(o => !o.actual_close_date && o.outcome !== 'lost' && o.outcome !== 'withdrawn');
  const closedOpportunities = opportunities.filter(o => o.actual_close_date || o.outcome === 'lost' || o.outcome === 'withdrawn');

  return { opportunities, activeOpportunities, closedOpportunities, loading, refresh: fetchOpportunities };
}

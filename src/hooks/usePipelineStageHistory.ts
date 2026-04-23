import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StageHistoryEntry {
  id: string;
  opportunity_id: string;
  agent_id: string;
  from_stage: string | null;
  to_stage: string;
  pipeline_type: string;
  changed_at: string;
  days_in_from_stage: number | null;
  changed_by: string;
  notes: string | null;
}

export function usePipelineStageHistory(opportunityId: string | null) {
  const [history, setHistory] = useState<StageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!opportunityId) { setHistory([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunity_stage_history')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      setHistory((data ?? []) as StageHistoryEntry[]);
    } catch (err) {
      console.error('usePipelineStageHistory error:', err);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { history, loading, refresh: fetchHistory };
}

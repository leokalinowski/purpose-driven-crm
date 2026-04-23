import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface OpportunityActivity {
  id: string;
  opportunity_id: string;
  agent_id: string;
  activity_type: string;
  title: string | null;
  description: string | null;
  outcome: string | null;
  note: string | null;
  activity_date: string;
  created_at: string;
}

export function useOpportunityActivities(opportunityId: string | null) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<OpportunityActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!opportunityId) { setActivities([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunity_activities')
        .select('id, opportunity_id, agent_id, activity_type, title, description, outcome, note, activity_date, created_at')
        .eq('opportunity_id', opportunityId)
        .order('activity_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      setActivities((data || []) as OpportunityActivity[]);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  const logActivity = useCallback(async (data: {
    activity_type: string;
    title?: string;
    description?: string;
    outcome?: string;
    note?: string;
    activity_date?: string;
  }) => {
    if (!opportunityId || !user?.id) throw new Error('Missing opportunityId or user');
    const { error } = await supabase.from('opportunity_activities').insert({
      opportunity_id: opportunityId,
      agent_id: user.id,
      activity_type: data.activity_type,
      title: data.title ?? null,
      description: data.description ?? null,
      outcome: data.outcome ?? null,
      note: data.note ?? null,
      activity_date: data.activity_date ?? new Date().toISOString(),
    });
    if (error) throw error;
    await fetchActivities();

    // Re-score this opportunity immediately after any activity — fire and forget
    supabase.functions.invoke('pipeline-score-opportunities', {
      body: { opportunity_id: opportunityId, agent_id: user.id },
    }).catch(e => console.warn('Re-score after activity failed (non-fatal):', e));
  }, [opportunityId, user?.id, fetchActivities]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  return { activities, loading, logActivity, refresh: fetchActivities };
}

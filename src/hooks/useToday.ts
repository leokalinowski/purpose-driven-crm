import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Opportunity } from './usePipeline';

export type AttentionState = 'overdue' | 'no_next_step' | 'stale' | 'on_track';

export interface TodayOpportunity extends Opportunity {
  attention_state: AttentionState;
  contact_name: string;
}

function computeAttentionState(opp: Opportunity): AttentionState {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!opp.next_step_title) return 'no_next_step';

  if (opp.next_step_due_date) {
    const due = new Date(opp.next_step_due_date);
    if (due < today) return 'overdue';
  }

  if (!opp.last_activity_date) return 'stale';
  const daysSince = (Date.now() - new Date(opp.last_activity_date).getTime()) / 86400000;
  if (daysSince > 7) return 'stale';

  return 'on_track';
}

export function useToday() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
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
            first_name, last_name, phone, email, category,
            buyer_pre_approval_status, relationship_strength
          )
        `)
        .eq('agent_id', user.id)
        .is('actual_close_date', null)
        .or('outcome.is.null,outcome.not.in.(lost,withdrawn)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOpportunities((data || []) as Opportunity[]);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const withState: TodayOpportunity[] = opportunities.map(opp => ({
      ...opp,
      attention_state: computeAttentionState(opp),
      contact_name: opp.contact
        ? `${opp.contact.first_name ?? ''} ${opp.contact.last_name ?? ''}`.trim() || 'Unknown'
        : (opp.title ?? 'Unknown'),
    }));

    // Sort: overdue first, then no_next_step, then stale, then on_track
    const priority = { overdue: 0, no_next_step: 1, stale: 2, on_track: 3 };
    withState.sort((a, b) => priority[a.attention_state] - priority[b.attention_state]);

    return {
      needsAttention: withState.filter(o => o.attention_state === 'overdue' || o.attention_state === 'no_next_step'),
      stale: withState.filter(o => o.attention_state === 'stale'),
      onTrack: withState.filter(o => o.attention_state === 'on_track'),
      all: withState,
    };
  }, [opportunities]);

  useEffect(() => { fetchOpportunities(); }, [user?.id]);

  return { ...grouped, loading, refresh: fetchOpportunities };
}

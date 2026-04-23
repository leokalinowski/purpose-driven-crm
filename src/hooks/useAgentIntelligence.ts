import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getCurrentWeekTasks } from '@/utils/sphereSyncLogic';

export interface SphereHealthSnapshot {
  health_score: number;
  summary: string;
  key_stat: string;
  total_contacts?: number;
  contacts_never_touched?: number;
  contacts_overdue_30d?: number;
  contacts_overdue_90d?: number;
}

export interface WeeklyPriorityItem {
  contact_name: string;
  task_type: 'call' | 'text';
  priority_rank: number;
  reason: string;
  talking_points: string[];
}

export interface AgentIntelligenceSnapshot {
  id: string;
  agent_id: string;
  week_number: number;
  year: number;
  generated_at: string;
  sphere_health: SphereHealthSnapshot;
  top_opportunities: Array<{
    contact_name: string;
    stage: string;
    deal_value: number;
    days_since_update: number;
    next_action: string;
  }>;
  market_pulse: {
    summary: string;
    key_stats?: Array<{ zip: string; median_price: number; trend: string }>;
  };
  weekly_priorities: WeeklyPriorityItem[];
  coaching_context: {
    week_trend: 'improving' | 'declining' | 'steady';
    observation: string;
    avg_dials_last4?: number;
    avg_conversations_last4?: number;
  };
  model_version: string;
}

export function useAgentIntelligence() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<AgentIntelligenceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { weekNumber, isoYear } = getCurrentWeekTasks();

    supabase
      .from('agent_intelligence_snapshots')
      .select('*')
      .eq('agent_id', user.id)
      .eq('week_number', weekNumber)
      .eq('year', isoYear)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message);
        } else {
          setSnapshot(data as AgentIntelligenceSnapshot | null);
        }
        setLoading(false);
      });
  }, [user]);

  return { snapshot, loading, error };
}

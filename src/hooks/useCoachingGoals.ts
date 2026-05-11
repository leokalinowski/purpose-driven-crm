/**
 * useCoachingGoals — read + persist the agent's annual performance goals
 * (GCI, closings, conversations) on `profiles`. Drives the pace projection
 * and goal line on the Scoreboard, and gets edited from the Settings page.
 *
 * Goals are PER-AGENT and self-set. NULL = no goal set; the UI then hides
 * pace/goal-line UI rather than showing a misleading 0% progress.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CoachingGoals {
  annual_gci_goal: number | null;
  annual_closings_goal: number | null;
  annual_conversations_goal: number | null;
}

const EMPTY: CoachingGoals = {
  annual_gci_goal: null,
  annual_closings_goal: null,
  annual_conversations_goal: null,
};

export function useCoachingGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<CoachingGoals>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setGoals(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryErr } = await supabase
        .from('profiles')
        .select('annual_gci_goal, annual_closings_goal, annual_conversations_goal')
        .eq('user_id', user.id)
        .maybeSingle();
      if (queryErr) throw queryErr;
      setGoals({
        annual_gci_goal: data?.annual_gci_goal == null ? null : Number(data.annual_gci_goal),
        annual_closings_goal: data?.annual_closings_goal == null ? null : Number(data.annual_closings_goal),
        annual_conversations_goal: data?.annual_conversations_goal == null ? null : Number(data.annual_conversations_goal),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const save = useCallback(
    async (next: Partial<CoachingGoals>): Promise<boolean> => {
      if (!user?.id) return false;
      try {
        const patch: Record<string, number | null> = {};
        if ('annual_gci_goal' in next) patch.annual_gci_goal = next.annual_gci_goal ?? null;
        if ('annual_closings_goal' in next) patch.annual_closings_goal = next.annual_closings_goal ?? null;
        if ('annual_conversations_goal' in next) patch.annual_conversations_goal = next.annual_conversations_goal ?? null;
        const { error: updErr } = await supabase
          .from('profiles')
          .update(patch)
          .eq('user_id', user.id);
        if (updErr) throw updErr;
        setGoals((prev) => ({ ...prev, ...next }));
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [user?.id],
  );

  return { goals, loading, error, refresh: fetch, save };
}

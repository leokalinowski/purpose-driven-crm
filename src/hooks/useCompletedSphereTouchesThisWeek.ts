/**
 * useCompletedSphereTouchesThisWeek — counts spheresync tasks completed
 * in the current Mon–Sun window, by `completed_at`. Distinct from
 * `useSphereSyncTasks()` which scopes to this week's *assigned* tasks
 * (filter on `week_number`/`year`). This hook catches catch-up
 * completions — a task assigned to an earlier week but finished this
 * week — so the dashboard "Sphere touches" KPI agrees with the Recent
 * Activity feed.
 */

import { useEffect, useState } from 'react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CompletedSphereTouches {
  calls: number;
  texts: number;
  total: number;
  loading: boolean;
}

export function useCompletedSphereTouchesThisWeek(): CompletedSphereTouches {
  const { user } = useAuth();
  const [state, setState] = useState<CompletedSphereTouches>({
    calls: 0,
    texts: 0,
    total: 0,
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const { data, error } = await supabase
        .from('spheresync_tasks')
        .select('task_type')
        .eq('agent_id', user.id)
        .eq('completed', true)
        .gte('completed_at', weekStart)
        .lte('completed_at', weekEnd);
      if (cancelled) return;
      if (error) {
        console.warn('[useCompletedSphereTouchesThisWeek]', error.message);
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const rows = data ?? [];
      const calls = rows.filter((r) => r.task_type === 'call').length;
      const texts = rows.filter((r) => r.task_type === 'text').length;
      setState({ calls, texts, total: calls + texts, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return state;
}

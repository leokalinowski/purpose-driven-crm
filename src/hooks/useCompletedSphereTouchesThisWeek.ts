/**
 * useCompletedSphereTouchesThisWeek — counts spheresync tasks completed
 * in the current Mon–Sun window, by `completed_at`. Distinct from
 * `useSphereSyncTasks()` which scopes to this week's *assigned* tasks
 * (filter on `week_number`/`year`). This hook catches catch-up
 * completions — a task assigned to an earlier week but finished this
 * week — so the dashboard "Sphere touches" KPI agrees with the Recent
 * Activity feed.
 *
 * Also exposes `touchedContactIds` — the set of `lead_id`s the agent
 * has touched this week — so the Database page can filter to
 * "already touched this week" rows.
 */

import { useEffect, useMemo, useState } from 'react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CompletedSphereTouches {
  calls: number;
  texts: number;
  total: number;
  loading: boolean;
  /** Set of contact (lead_id) UUIDs touched this week — useful for
   *  filtering a contact list to "already touched". Empty until loaded. */
  touchedContactIds: Set<string>;
}

const EMPTY_SET: Set<string> = new Set();

export function useCompletedSphereTouchesThisWeek(): CompletedSphereTouches {
  const { user } = useAuth();
  const [state, setState] = useState<{
    calls: number;
    texts: number;
    total: number;
    loading: boolean;
    leadIds: string[];
  }>({
    calls: 0,
    texts: 0,
    total: 0,
    loading: true,
    leadIds: [],
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
        .select('task_type, lead_id')
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
      const leadIds = rows
        .map((r) => r.lead_id as string | null)
        .filter((id): id is string => !!id);
      setState({ calls, texts, total: calls + texts, loading: false, leadIds });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Build the Set lazily so consumers that only read counts don't pay for it.
  const touchedContactIds = useMemo(
    () => (state.leadIds.length > 0 ? new Set(state.leadIds) : EMPTY_SET),
    [state.leadIds],
  );

  return {
    calls: state.calls,
    texts: state.texts,
    total: state.total,
    loading: state.loading,
    touchedContactIds,
  };
}

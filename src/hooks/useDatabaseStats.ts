/**
 * useDatabaseStats — server-side COUNT queries for the Database page stat tiles.
 *
 * Replaces the previous derivation from `allContacts.filter(...)` which had
 * two correctness bugs:
 *   1. `allContacts` was search-filtered, so during search the deltas
 *      (e.g. "+12 this month") shrank to match the search subset and reported
 *      misleading numbers.
 *   2. `allContacts` was capped at 5,000 rows, silently truncating counts
 *      for agents with larger spheres.
 *
 * Each tile now runs an independent COUNT query against the full contact set
 * for the agent. Five parallel `head: true` count queries; no row data is
 * fetched. Cheap and unaffected by search/page state.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DatabaseStats {
  totalContacts: number;
  pastClients: number;
  noTouch90d: number;      // last_activity_date IS NULL OR < 90d ago
  recentNew: number;       // created_at > 30d ago
}

// `contact_type` values that count as "past clients." Substring matching on
// `'past'` was brittle (would match `'broadcast'`, miss casing variants).
// This whitelist is the intentional set; expand if new values are added.
const PAST_CLIENT_TYPES = ['past_client', 'past_buyer', 'past_seller'];

export function useDatabaseStats() {
  const { user } = useAuth();
  const agentId = user?.id;

  const query = useQuery<DatabaseStats>({
    queryKey: ['database-stats', agentId],
    enabled: !!agentId,
    staleTime: 60_000,
    queryFn: async (): Promise<DatabaseStats> => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

      // Run all four counts in parallel. Each `head: true` returns count only,
      // no row data — minimal payload, RLS-bounded by the existing policy.
      // The prior `hotLeads` count was sourced from `priority_score >= 60`
      // (System A) and is gone — the Database "Priorities" tile now reads
      // from `usePrioritizedQueue` client-side so the count matches the
      // SphereSync Priorities tab exactly.
      const [totalRes, pastRes, noTouchRes, recentRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', agentId!),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', agentId!)
          .in('contact_type', PAST_CLIENT_TYPES),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', agentId!)
          .or(`last_activity_date.is.null,last_activity_date.lt.${ninetyDaysAgo}`),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', agentId!)
          .gt('created_at', thirtyDaysAgo),
      ]);

      // If any single query fails, throw so the consumer falls into the error
      // branch rather than displaying a partial set of zeros that look like
      // real numbers.
      for (const res of [totalRes, pastRes, noTouchRes, recentRes]) {
        if (res.error) throw res.error;
      }

      return {
        totalContacts: totalRes.count ?? 0,
        pastClients: pastRes.count ?? 0,
        noTouch90d: noTouchRes.count ?? 0,
        recentNew: recentRes.count ?? 0,
      };
    },
  });

  return {
    stats: query.data,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

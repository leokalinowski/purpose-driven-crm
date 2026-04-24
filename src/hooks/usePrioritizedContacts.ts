import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrioritizedContact {
  id: string;
  agent_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  zip_code: string | null;
  tags: string[] | null;
  dnc: boolean | null;
  last_activity_date: string | null;

  priority_score: number | null;
  priority_reasoning: string | null;
  priority_components: {
    relationship: number;
    pipeline: number;
    intent: number;
    flags: number;
  } | null;
  priority_signals: {
    days_since_last_activity?: number | null;
    activity_30d?: number;
    activity_90d?: number;
    active_opportunity_stage?: string | null;
    days_in_stage?: number | null;
    market_zip?: string | null;
    life_event?: string | null;
    ai_key_signals?: string[];
  } | null;
  priority_computed_at: string | null;
  priority_model: string | null;
  priority_watch_flag: boolean;
}

export type PriorityTier = 'urgent' | 'hot' | 'warm' | 'cool' | 'cold' | 'unscored';

export interface PriorityGroups {
  urgent: PrioritizedContact[];   // 80-100
  hot:    PrioritizedContact[];   // 60-79
  warm:   PrioritizedContact[];   // 40-59
  cool:   PrioritizedContact[];   // 20-39
  cold:   PrioritizedContact[];   //  0-19
  unscored: PrioritizedContact[]; // null
  all:    PrioritizedContact[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function tierFor(score: number | null): PriorityTier {
  if (score === null) return 'unscored';
  if (score >= 80) return 'urgent';
  if (score >= 60) return 'hot';
  if (score >= 40) return 'warm';
  if (score >= 20) return 'cool';
  return 'cold';
}

export const TIER_META: Record<PriorityTier, { label: string; dot: string; text: string; bg: string }> = {
  urgent:   { label: 'Urgent',   dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50' },
  hot:      { label: 'Hot',      dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' },
  warm:     { label: 'Warm',     dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50' },
  cool:     { label: 'Cool',     dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50' },
  cold:     { label: 'Cold',     dot: 'bg-slate-400',  text: 'text-slate-700',  bg: 'bg-slate-50' },
  unscored: { label: 'Unscored', dot: 'bg-muted',      text: 'text-muted-foreground', bg: 'bg-muted/40' },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Reads the agent's contacts ordered by priority_score DESC, grouped into tiers.
 * The score itself is computed by the `compute-priority-scores` edge function
 * (daily cron + event-driven recompute); this hook only READS the cached row.
 */
export function usePrioritizedContacts(opts?: { limit?: number }) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['prioritized-contacts', user?.id, opts?.limit ?? null],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<PriorityGroups> => {
      let q = supabase
        .from('contacts')
        .select(`
          id, agent_id, first_name, last_name, email, phone, category, zip_code, tags, dnc,
          last_activity_date,
          priority_score, priority_reasoning, priority_components, priority_signals,
          priority_computed_at, priority_model, priority_watch_flag
        `)
        .eq('agent_id', user!.id)
        // Priority DESC, NULLS last — Supabase: set ascending:false and nullsFirst:false
        .order('priority_score', { ascending: false, nullsFirst: false })
        // Tie-breakers per product decision: most-overdue first (last_activity_date ASC)
        .order('last_activity_date', { ascending: true, nullsFirst: true });

      if (opts?.limit) q = q.limit(opts.limit);

      const { data, error } = await q;
      if (error) throw error;

      const all = (data ?? []) as PrioritizedContact[];
      return {
        urgent:   all.filter(c => tierFor(c.priority_score) === 'urgent'),
        hot:      all.filter(c => tierFor(c.priority_score) === 'hot'),
        warm:     all.filter(c => tierFor(c.priority_score) === 'warm'),
        cool:     all.filter(c => tierFor(c.priority_score) === 'cool'),
        cold:     all.filter(c => tierFor(c.priority_score) === 'cold'),
        unscored: all.filter(c => tierFor(c.priority_score) === 'unscored'),
        all,
      };
    },
  });

  return {
    groups: query.data,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// Intentionally no user-triggered rescore — scoring happens via cron + triggers
// only (event-driven on activity log / stage change). Blocking AI calls from the
// UI produced bad UX and hit rate limits.

/**
 * Toggle the agent-set "watch this one" flag. Optimistic — updates cache immediately,
 * rolls back on error. The trigger on contact state change will rescore on the
 * next scoring tick; no blocking call here.
 */
export function useToggleWatchFlag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ contactId, next }: { contactId: string; next: boolean }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ priority_watch_flag: next })
        .eq('id', contactId);
      if (error) throw error;
      return { contactId, next };
    },
    onMutate: async ({ contactId, next }) => {
      await queryClient.cancelQueries({ queryKey: ['prioritized-contacts'] });
      const snapshot = queryClient.getQueriesData({ queryKey: ['prioritized-contacts'] });
      queryClient.setQueriesData<PriorityGroups | undefined>(
        { queryKey: ['prioritized-contacts'] },
        (old) => {
          if (!old) return old;
          const patch = (c: PrioritizedContact) =>
            c.id === contactId ? { ...c, priority_watch_flag: next } : c;
          return {
            urgent: old.urgent.map(patch),
            hot: old.hot.map(patch),
            warm: old.warm.map(patch),
            cool: old.cool.map(patch),
            cold: old.cold.map(patch),
            unscored: old.unscored.map(patch),
            all: old.all.map(patch),
          };
        }
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: 'Could not update watch flag', variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['prioritized-contacts'] });
    },
  });
}

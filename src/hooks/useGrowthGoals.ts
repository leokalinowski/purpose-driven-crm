/**
 * useGrowthGoals — manages the agent's `agent_growth_goals` rows.
 *
 * Each goal is a qualitative item the agent + Coach set together (e.g.
 * "Send 25 handwritten notes/month", "Master objection handling — top 5
 * plays"). Distinct from the top-line `profiles.annual_*_goal` numbers
 * which drive YTD pace projection on the KPI cards.
 *
 * Surfaced as the "Active growth goals" card on the merged Scoreboard.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type GrowthGoalStatus = 'active' | 'completed' | 'paused' | 'archived';

export interface GrowthGoal {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  target_date: string | null;
  status: GrowthGoalStatus;
  sort_order: number;
  bar_color_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthGoalDraft {
  title: string;
  description?: string | null;
  target_value?: number | null;
  current_value?: number;
  unit?: string | null;
  target_date?: string | null;
  status?: GrowthGoalStatus;
  bar_color_token?: string | null;
}

export function useGrowthGoals(opts?: { includeArchived?: boolean }) {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GrowthGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('agent_growth_goals')
        .select('*')
        .eq('agent_id', user.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (!opts?.includeArchived) {
        q = q.neq('status', 'archived');
      }
      const { data, error: queryErr } = await q;
      if (queryErr) throw queryErr;
      setGoals((data ?? []) as GrowthGoal[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user?.id, opts?.includeArchived]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (draft: GrowthGoalDraft): Promise<GrowthGoal | null> => {
    if (!user?.id) return null;
    // Insert at the end of the active list.
    const nextSortOrder = goals.length === 0 ? 0 : Math.max(...goals.map((g) => g.sort_order)) + 10;
    const { data, error: insErr } = await supabase
      .from('agent_growth_goals')
      .insert({
        agent_id: user.id,
        title: draft.title,
        description: draft.description ?? null,
        target_value: draft.target_value ?? null,
        current_value: draft.current_value ?? 0,
        unit: draft.unit ?? null,
        target_date: draft.target_date ?? null,
        status: draft.status ?? 'active',
        bar_color_token: draft.bar_color_token ?? null,
        sort_order: nextSortOrder,
      })
      .select()
      .single();
    if (insErr) {
      setError(insErr.message);
      return null;
    }
    setGoals((prev) => [...prev, data as GrowthGoal]);
    return data as GrowthGoal;
  }, [user?.id, goals]);

  const update = useCallback(async (id: string, patch: Partial<GrowthGoalDraft>): Promise<boolean> => {
    if (!user?.id) return false;
    const { data, error: updErr } = await supabase
      .from('agent_growth_goals')
      .update(patch)
      .eq('id', id)
      .eq('agent_id', user.id)
      .select()
      .single();
    if (updErr) {
      setError(updErr.message);
      return false;
    }
    setGoals((prev) => prev.map((g) => (g.id === id ? (data as GrowthGoal) : g)));
    return true;
  }, [user?.id]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    if (!user?.id) return false;
    // Soft-delete to keep history — flip to archived. Callers that truly
    // want to delete can pass status='archived' via update() anyway.
    const ok = await update(id, { status: 'archived' });
    if (ok) setGoals((prev) => prev.filter((g) => g.id !== id));
    return ok;
  }, [user?.id, update]);

  return { goals, loading, error, refresh: fetch, create, update, remove };
}

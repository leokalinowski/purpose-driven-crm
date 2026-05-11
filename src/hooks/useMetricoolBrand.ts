/**
 * useMetricoolBrand — fetch + manage the agent's row in `metricool_brands`.
 *
 * One row per agent. Returns `null` while loading, `false` when no brand is
 * connected, or the typed row when present.
 *
 * Mutation helpers:
 *   - testConnection: validates BYO credentials before save (calls
 *     metricool-test-connection edge fn)
 *   - saveBrand: upserts the row after a successful test
 *   - deleteBrand: removes the row + associated cached state (agent must
 *     re-connect)
 *   - refresh: re-fetches the row + updates last_sync_at
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MetricoolBrand {
  id: string;
  agent_id: string;
  blog_id: number;
  user_id_metricool: number | null;
  user_token: string;
  brand_label: string | null;
  connected_networks: string[];
  last_sync_at: string | null;
  last_error: string | null;
  provisioning_method: 'byo' | 'agency';
  created_at: string;
  updated_at: string;
}

export interface SaveBrandInput {
  blog_id: number;
  user_id_metricool: number;
  user_token: string;
  brand_label?: string | null;
  connected_networks?: string[];
  provisioning_method?: 'byo' | 'agency';
}

export interface TestConnectionInput {
  user_token: string;
  user_id_metricool: number | string;
  blog_id: number | string;
}

export interface TestConnectionResult {
  ok: boolean;
  brand_label?: string;
  blog_id?: number;
  user_id_metricool?: number;
  connected_networks?: string[];
  error?: string;
  detail?: string;
}

function normalize(row: Record<string, unknown> | null | undefined): MetricoolBrand | null {
  if (!row) return null;
  return {
    id: row.id as string,
    agent_id: row.agent_id as string,
    blog_id: Number(row.blog_id),
    user_id_metricool:
      row.user_id_metricool == null ? null : Number(row.user_id_metricool),
    user_token: row.user_token as string,
    brand_label: (row.brand_label as string | null) ?? null,
    connected_networks: Array.isArray(row.connected_networks)
      ? (row.connected_networks as string[])
      : [],
    last_sync_at: (row.last_sync_at as string | null) ?? null,
    last_error: (row.last_error as string | null) ?? null,
    provisioning_method: (row.provisioning_method as 'byo' | 'agency') ?? 'byo',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function useMetricoolBrand() {
  const { user } = useAuth();
  const [brand, setBrand] = useState<MetricoolBrand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrand = useCallback(async (): Promise<MetricoolBrand | null> => {
    if (!user?.id) return null;
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryErr } = await supabase
        .from('metricool_brands')
        .select('*')
        .eq('agent_id', user.id)
        .maybeSingle();
      if (queryErr) throw queryErr;
      const next = normalize(data as Record<string, unknown> | null);
      setBrand(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBrand();
  }, [fetchBrand]);

  /** Validate BYO credentials by calling the test-connection edge function. */
  const testConnection = useCallback(
    async (input: TestConnectionInput): Promise<TestConnectionResult> => {
      const { data, error: invokeErr } = await supabase.functions.invoke<TestConnectionResult>(
        'metricool-test-connection',
        { body: input },
      );
      if (invokeErr) {
        return { ok: false, error: invokeErr.message };
      }
      return data ?? { ok: false, error: 'Empty response from test-connection' };
    },
    [],
  );

  /** Upsert the brand row. Caller should run testConnection first. */
  const saveBrand = useCallback(
    async (input: SaveBrandInput): Promise<MetricoolBrand | null> => {
      if (!user?.id) {
        setError('Not signed in');
        return null;
      }
      try {
        const { data, error: upsertErr } = await supabase
          .from('metricool_brands')
          .upsert(
            {
              agent_id: user.id,
              blog_id: input.blog_id,
              user_id_metricool: input.user_id_metricool,
              user_token: input.user_token,
              brand_label: input.brand_label ?? null,
              connected_networks: (input.connected_networks ?? []) as unknown as string[],
              provisioning_method: input.provisioning_method ?? 'byo',
              last_error: null,
              last_sync_at: new Date().toISOString(),
            } as never,
            { onConflict: 'agent_id' },
          )
          .select('*')
          .single();
        if (upsertErr) throw upsertErr;
        const next = normalize(data as Record<string, unknown> | null);
        setBrand(next);
        return next;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [user?.id],
  );

  /** Drop the brand row. Agent must re-connect after this. */
  const deleteBrand = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const { error: deleteErr } = await supabase
        .from('metricool_brands')
        .delete()
        .eq('agent_id', user.id);
      if (deleteErr) throw deleteErr;
      setBrand(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [user?.id]);

  return {
    brand,
    loading,
    error,
    refresh: fetchBrand,
    testConnection,
    saveBrand,
    deleteBrand,
  };
}

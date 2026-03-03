import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'admin' | 'editor' | 'agent' | 'managed' | 'core' | string;

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refetch = useCallback(() => {
    setRefreshIndex((v) => v + 1);
  }, []);

  const fetchUserRole = useCallback(async (retryCount = 0) => {
    if (authLoading) return;

    if (!user) {
      setRole(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (retryCount === 0) {
      setLoading(true);
      setError(null);
    }

    try {
      const { data, error } = await supabase.rpc('get_current_user_role');
      if (error) throw error;
      setRole(data ?? null);
      setLoading(false);
    } catch (err: any) {
      const isAbortError =
        err?.name === 'AbortError' ||
        err?.message?.includes('AbortError') ||
        err?.message?.includes('signal') ||
        err?.code === 'PGRST301';

      if (isAbortError && retryCount < 3) {
        const delay = Math.min(500 * Math.pow(2, retryCount), 4000);
        console.warn(`[useUserRole] RPC aborted, retrying (${retryCount + 1}/3) in ${delay}ms`);
        setTimeout(() => fetchUserRole(retryCount + 1), delay);
        return;
      }

      console.error('[useUserRole] RPC get_current_user_role failed', {
        userId: user.id,
        err,
      });
      setRole(null);
      setError(err);
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole, refreshIndex]);

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  const isAgent = role === 'agent';
  const isManaged = role === 'managed';
  const isCore = role === 'core';

  return {
    role,
    isAdmin,
    isEditor,
    isAgent,
    isManaged,
    isCore,
    loading,
    error,
    refetch,
  };
};
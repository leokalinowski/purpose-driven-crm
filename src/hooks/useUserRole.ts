import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'admin' | 'editor' | 'agent' | string;

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refetch = useCallback(() => {
    setRefreshIndex((v) => v + 1);
  }, []);

  const fetchUserRole = useCallback(async () => {
    if (!user) {
      setRole(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Source of truth: SECURITY DEFINER DB function based on user_roles table.
      const { data, error } = await supabase.rpc('get_current_user_role');
      if (error) throw error;

      // If no role row exists, treat as unknown (do not assume 'agent' here).
      setRole(data ?? null);
    } catch (err) {
      // Don't default to 'agent' on failure; let callers decide UX (retry vs deny).
      console.error('[useUserRole] RPC get_current_user_role failed', {
        userId: user.id,
        err,
      });
      setRole(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole, refreshIndex]);

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';

  return {
    role,
    isAdmin,
    isEditor,
    loading,
    error,
    refetch,
  };
};
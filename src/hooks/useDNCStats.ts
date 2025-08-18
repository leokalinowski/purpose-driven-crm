import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DNCStats {
  totalContacts: number;
  dncContacts: number;
  nonDncContacts: number;
  neverChecked: number;
  needsRecheck: number;
  lastChecked: string | null;
}

export const useDNCStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DNCStats>({
    totalContacts: 0,
    dncContacts: 0,
    nonDncContacts: 0,
    neverChecked: 0,
    needsRecheck: 0,
    lastChecked: null,
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const fetchDNCStats = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get total contacts for this agent
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id);

      // Get DNC contacts
      const { count: dncContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .eq('dnc', true);

      // Get never checked contacts
      const { count: neverChecked } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .is('dnc_last_checked', null);

      // Get contacts that need rechecking (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: needsRecheck } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .eq('dnc', false)
        .not('dnc_last_checked', 'is', null)
        .lt('dnc_last_checked', thirtyDaysAgo.toISOString());

      // Get last DNC check log for this agent
      const { data: lastLog } = await supabase
        .from('dnc_logs')
        .select('run_date')
        .eq('agent_id', user.id)
        .order('run_date', { ascending: false })
        .limit(1)
        .single();

      setStats({
        totalContacts: totalContacts || 0,
        dncContacts: dncContacts || 0,
        nonDncContacts: (totalContacts || 0) - (dncContacts || 0),
        neverChecked: neverChecked || 0,
        needsRecheck: needsRecheck || 0,
        lastChecked: lastLog?.run_date || null,
      });
    } catch (error) {
      console.error('Error fetching DNC stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const triggerDNCCheck = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');

    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('dnc-monthly-check', {
        body: { manualTrigger: true }
      });

      if (error) throw error;

      // Refresh stats after check
      await fetchDNCStats();
      
      return data;
    } catch (error) {
      console.error('Error triggering DNC check:', error);
      throw error;
    } finally {
      setChecking(false);
    }
  }, [user, fetchDNCStats]);

  return {
    stats,
    loading,
    checking,
    fetchDNCStats,
    triggerDNCCheck,
  };
};
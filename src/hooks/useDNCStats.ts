import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DNCStats {
  totalContacts: number;
  dncContacts: number;
  nonDncContacts: number;
  neverChecked: number;
  missingPhone: number;
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
    missingPhone: 0,
    needsRecheck: 0,
    lastChecked: null,
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  // Use the logged-in user
  const effectiveAgentId = user?.id;

  const fetchDNCStats = useCallback(async () => {
    if (!user || !effectiveAgentId) return;

    setLoading(true);
    try {
      // Get total contacts for this agent
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId);

      // Get DNC contacts
      const { count: dncContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .eq('dnc', true);

      // Get contacts WITH phone numbers that have never been checked
      const { count: neverChecked } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .is('dnc_last_checked', null)
        .not('phone', 'is', null)
        .neq('phone', '');

      // Get contacts WITHOUT phone numbers
      const { count: missingPhone } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .or('phone.is.null,phone.eq.');

      // Get contacts that need rechecking (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: needsRecheck } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .eq('dnc', false)
        .not('dnc_last_checked', 'is', null)
        .lt('dnc_last_checked', thirtyDaysAgo.toISOString());

      // Get last DNC check log for this agent
      const { data: lastLog } = await supabase
        .from('dnc_logs')
        .select('run_date')
        .eq('agent_id', effectiveAgentId)
        .order('run_date', { ascending: false })
        .limit(1)
        .single();

      setStats({
        totalContacts: totalContacts || 0,
        dncContacts: dncContacts || 0,
        nonDncContacts: (totalContacts || 0) - (dncContacts || 0),
        neverChecked: neverChecked || 0,
        missingPhone: missingPhone || 0,
        needsRecheck: needsRecheck || 0,
        lastChecked: lastLog?.run_date || null,
      });
    } catch (error) {
      console.error('Error fetching DNC stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, effectiveAgentId]);

  const triggerDNCCheck = useCallback(async (forceRecheck: boolean = false) => {
    if (!user) throw new Error('User not authenticated');

    console.log('[DNC Check] Starting check for current user:', {
      userId: user.id,
      forceRecheck
    });

    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('dnc-monthly-check', {
        body: {
          manualTrigger: true,
          forceRecheck
        }
      });

      if (error) {
        console.error('[DNC Check] Edge function error:', error);
        throw error;
      }

      console.log('[DNC Check] Edge function response:', data);

      // Wait a moment for the database to update, then refresh stats
      console.log('[DNC Check] Waiting for database update...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('[DNC Check] Refreshing DNC stats...');
      await fetchDNCStats();

      console.log('[DNC Check] Stats refreshed successfully');
      return data;
    } catch (error) {
      console.error('[DNC Check] Failed:', error);
      throw error;
    } finally {
      setChecking(false);
    }
  }, [user, fetchDNCStats]);

  // Auto-fetch stats when agent changes or on mount
  useEffect(() => {
    fetchDNCStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAgentId]);

  // Auto-refresh DNC stats every 30 seconds when checking is active
  useEffect(() => {
    if (checking) {
      console.log('[DNC Stats] Starting auto-refresh polling...');
      const interval = setInterval(() => {
        console.log('[DNC Stats] Auto-refreshing stats...');
        fetchDNCStats();
      }, 30000); // Every 30 seconds

      return () => {
        console.log('[DNC Stats] Stopping auto-refresh polling');
        clearInterval(interval);
      };
    }
  }, [checking, fetchDNCStats]);


  return {
    stats,
    loading,
    checking,
    fetchDNCStats,
    triggerDNCCheck,
  };
};

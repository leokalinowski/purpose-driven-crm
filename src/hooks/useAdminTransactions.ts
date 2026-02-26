import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '@/hooks/useTransactions';

export interface AgentLeaderboardEntry {
  agentId: string;
  agentName: string;
  closedDeals: number;
  totalGci: number;
  salesVolume: number;
  avgDealSize: number;
  closingRate: number;
  ongoingDeals: number;
}

export interface TeamMetrics {
  ytdSalesVolume: number;
  ytdGci: number;
  mtdGci: number;
  activePipelineValue: number;
  avgDealVelocity: number;
  teamClosingRate: number;
  totalOngoing: number;
  totalClosed: number;
}

export interface SyncStatus {
  lastSyncedAt: string | null;
  syncErrorCount: number;
  syncErrors: Array<{ agentId: string; agentName: string; errors: string[] }>;
}

export function useAdminTransactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [txRes, profileRes] = await Promise.all([
        supabase
          .from('transaction_coordination')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email'),
      ]);

      if (txRes.error) throw txRes.error;
      if (profileRes.error) throw profileRes.error;

      setTransactions(txRes.data || []);

      const profileMap: Record<string, string> = {};
      (profileRes.data || []).forEach((p) => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown';
        profileMap[p.user_id] = name;
      });
      setProfiles(profileMap);
    } catch (error) {
      console.error('Error fetching admin transactions:', error);
      toast({ title: 'Error', description: 'Failed to load transactions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const teamMetrics = useMemo<TeamMetrics>(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const closed = transactions.filter(
      (t) => t.transaction_stage === 'closed' && t.closing_date
    );
    const ongoing = transactions.filter(
      (t) => t.transaction_stage === 'under_contract' || (t.status === 'ongoing' && t.transaction_stage !== 'closed')
    );

    const ytdClosed = closed.filter((t) => new Date(t.closing_date!) >= yearStart);
    const mtdClosed = closed.filter((t) => new Date(t.closing_date!) >= monthStart);

    const ytdSalesVolume = ytdClosed.reduce((s, t) => s + (t.sale_price || 0), 0);
    const ytdGci = ytdClosed.reduce((s, t) => s + (t.gci || 0), 0);
    const mtdGci = mtdClosed.reduce((s, t) => s + (t.gci || 0), 0);
    const activePipelineValue = ongoing.reduce((s, t) => s + (t.sale_price || 0), 0);

    const withDates = closed.filter((t) => t.contract_date && t.closing_date);
    const avgDealVelocity =
      withDates.length > 0
        ? withDates.reduce((s, t) => {
            const days = (new Date(t.closing_date!).getTime() - new Date(t.contract_date!).getTime()) / 86400000;
            return s + Math.max(0, days);
          }, 0) / withDates.length
        : 0;

    const teamClosingRate = transactions.length > 0 ? (closed.length / transactions.length) * 100 : 0;

    return {
      ytdSalesVolume,
      ytdGci,
      mtdGci,
      activePipelineValue,
      avgDealVelocity,
      teamClosingRate,
      totalOngoing: ongoing.length,
      totalClosed: closed.length,
    };
  }, [transactions]);

  const leaderboard = useMemo<AgentLeaderboardEntry[]>(() => {
    const byAgent: Record<string, Transaction[]> = {};
    transactions.forEach((t) => {
      const id = t.responsible_agent || 'unassigned';
      if (!byAgent[id]) byAgent[id] = [];
      byAgent[id].push(t);
    });

    return Object.entries(byAgent)
      .map(([agentId, txs]) => {
        const closed = txs.filter((t) => t.transaction_stage === 'closed');
        const totalGci = closed.reduce((s, t) => s + (t.gci || 0), 0);
        const salesVolume = closed.reduce((s, t) => s + (t.sale_price || 0), 0);
        const ongoing = txs.filter((t) => t.transaction_stage !== 'closed');

        return {
          agentId,
          agentName: profiles[agentId] || 'Unknown Agent',
          closedDeals: closed.length,
          totalGci,
          salesVolume,
          avgDealSize: closed.length > 0 ? salesVolume / closed.length : 0,
          closingRate: txs.length > 0 ? (closed.length / txs.length) * 100 : 0,
          ongoingDeals: ongoing.length,
        };
      })
      .sort((a, b) => b.totalGci - a.totalGci);
  }, [transactions, profiles]);

  const syncStatus = useMemo<SyncStatus>(() => {
    const synced = transactions
      .filter((t) => t.last_synced_at)
      .sort((a, b) => new Date(b.last_synced_at!).getTime() - new Date(a.last_synced_at!).getTime());

    const errorsByAgent: Record<string, string[]> = {};
    transactions.forEach((t) => {
      if (t.sync_errors && t.sync_errors.length > 0) {
        const id = t.responsible_agent || 'unknown';
        if (!errorsByAgent[id]) errorsByAgent[id] = [];
        errorsByAgent[id].push(...t.sync_errors);
      }
    });

    return {
      lastSyncedAt: synced[0]?.last_synced_at || null,
      syncErrorCount: Object.values(errorsByAgent).flat().length,
      syncErrors: Object.entries(errorsByAgent).map(([agentId, errors]) => ({
        agentId,
        agentName: profiles[agentId] || 'Unknown',
        errors,
      })),
    };
  }, [transactions, profiles]);

  const syncAllAgents = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('opentoclose-sync', {
        body: { mode: 'team' },
      });

      if (error) throw error;

      toast({
        title: 'Sync Complete',
        description: `Synced ${data?.totalSynced || 0} transactions across ${data?.agentCount || 0} agents.`,
      });

      await fetchData();
    } catch (error) {
      console.error('Team sync error:', error);
      toast({ title: 'Sync Failed', description: 'Failed to sync team transactions.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  return {
    transactions,
    teamMetrics,
    leaderboard,
    syncStatus,
    profiles,
    loading,
    syncing,
    syncAllAgents,
    refetch: fetchData,
  };
}

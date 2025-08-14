import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Transaction {
  id: string;
  responsible_agent: string | null;
  property_address: string | null;
  sale_price: number | null;
  closing_date: string | null;
  contract_date: string | null;
  transaction_stage: string;
  otc_deal_id: string | null;
  gci: number | null;
  client_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionMetrics {
  totalSalesYear: number;
  totalSalesMonth: number;
  monthlyChange: number;
  transactionsYear: number;
  transactionsMonth: number;
  gciYear: number;
  gciMonth: number;
  ongoing: number;
  closingRate: number;
  avgDealValue: number;
  pipelineValue: number;
}

export function useTransactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [metrics, setMetrics] = useState<TransactionMetrics>({
    totalSalesYear: 0,
    totalSalesMonth: 0,
    monthlyChange: 0,
    transactionsYear: 0,
    transactionsMonth: 0,
    gciYear: 0,
    gciMonth: 0,
    ongoing: 0,
    closingRate: 0,
    avgDealValue: 0,
    pipelineValue: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchTransactions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transaction_coordination')
        .select('*')
        .eq('responsible_agent', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
      calculateMetrics(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (data: Transaction[]) => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Filter closed transactions
    const closedTransactions = data.filter(t => 
      t.transaction_stage === 'closed' && t.closing_date
    );

    // Year metrics
    const yearTransactions = closedTransactions.filter(t => 
      new Date(t.closing_date!) >= yearStart
    );
    const totalSalesYear = yearTransactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);
    const gciYear = yearTransactions.reduce((sum, t) => sum + (t.gci || 0), 0);

    // Month metrics
    const monthTransactions = closedTransactions.filter(t => 
      new Date(t.closing_date!) >= monthStart
    );
    const totalSalesMonth = monthTransactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);
    const gciMonth = monthTransactions.reduce((sum, t) => sum + (t.gci || 0), 0);

    // Last month for comparison
    const lastMonthTransactions = closedTransactions.filter(t => {
      const closeDate = new Date(t.closing_date!);
      return closeDate >= lastMonthStart && closeDate <= lastMonthEnd;
    });
    const lastMonthSales = lastMonthTransactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);

    // Calculate monthly change
    const monthlyChange = lastMonthSales > 0 
      ? ((totalSalesMonth - lastMonthSales) / lastMonthSales) * 100 
      : 0;

    // Ongoing transactions
    const ongoingTransactions = data.filter(t => 
      t.status === 'ongoing' || t.transaction_stage === 'under_contract'
    );
    const ongoing = ongoingTransactions.length;
    const pipelineValue = ongoingTransactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);

    // Closing rate
    const totalTransactions = data.length;
    const closedCount = closedTransactions.length;
    const closingRate = totalTransactions > 0 ? (closedCount / totalTransactions) * 100 : 0;

    // Average deal value
    const avgDealValue = closedCount > 0 ? totalSalesYear / closedCount : 0;

    setMetrics({
      totalSalesYear,
      totalSalesMonth,
      monthlyChange,
      transactionsYear: yearTransactions.length,
      transactionsMonth: monthTransactions.length,
      gciYear,
      gciMonth,
      ongoing,
      closingRate,
      avgDealValue,
      pipelineValue,
    });
  };

  const syncWithOpenToClose = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('opentoclose-sync', {
        body: { agentId: user.id }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Transactions synced with OpenToClose",
      });

      // Refresh transactions after sync
      await fetchTransactions();
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Error",
        description: "Failed to sync with OpenToClose",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  return {
    transactions,
    metrics,
    loading,
    syncWithOpenToClose,
    refetch: fetchTransactions,
  };
}
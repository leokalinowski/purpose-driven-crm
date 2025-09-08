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
  
  // Enhanced fields from Phase 1
  listing_agent_id?: string | null;
  buyer_agent_id?: string | null;
  property_type?: string | null;
  square_footage?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  listing_date?: string | null;
  days_on_market?: number | null;
  price_per_sqft?: number | null;
  commission_rate?: number | null;
  brokerage_split?: number | null;
  transaction_type?: string | null;
  lead_source?: string | null;
  referral_source?: string | null;
  milestone_dates?: any;
  risk_factors?: string[];
  raw_api_data?: any;
  last_synced_at?: string | null;
  sync_errors?: string[];
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
  
  // Enhanced metrics from Phase 1
  avgDaysOnMarket: number;
  avgPricePerSqft: number;
  avgCommissionRate: number;
  propertyTypeBreakdown: Record<string, number>;
  leadSourceBreakdown: Record<string, number>;
  riskFactorCount: number;
  dealVelocity: number; // avg days from contract to close
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
    avgDaysOnMarket: 0,
    avgPricePerSqft: 0,
    avgCommissionRate: 0,
    propertyTypeBreakdown: {},
    leadSourceBreakdown: {},
    riskFactorCount: 0,
    dealVelocity: 0,
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
    console.log('=== Transaction Metrics Debug ===');
    console.log('Total transactions:', data.length);
    console.log('Transaction stages:', [...new Set(data.map(t => t.transaction_stage))]);
    console.log('Transaction statuses:', [...new Set(data.map(t => t.status))]);
    
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Filter closed transactions (transactions that have actually closed)
    const closedTransactions = data.filter(t => {
      const isClosed = t.transaction_stage === 'closed' && t.closing_date;
      return isClosed;
    });
    console.log('Closed transactions:', closedTransactions.length);

    // For year-to-date metrics, we need to look at closing_date for closed deals
    // For under_contract deals, we use contract_date if available
    const getRelevantDate = (transaction: Transaction) => {
      if (transaction.transaction_stage === 'closed' && transaction.closing_date) {
        return new Date(transaction.closing_date);
      }
      if (transaction.contract_date) {
        return new Date(transaction.contract_date);
      }
      return new Date(transaction.created_at);
    };

    // Year metrics (closed transactions only)
    const yearTransactions = closedTransactions.filter(t => 
      new Date(t.closing_date!) >= yearStart
    );
    const totalSalesYear = yearTransactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);
    const gciYear = yearTransactions.reduce((sum, t) => sum + (t.gci || 0), 0);

    // Month metrics (closed transactions only) 
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
      : totalSalesMonth > 0 ? 100 : 0; // If no last month sales but current month has sales, show 100% increase

    // Ongoing transactions (under contract, pending, etc.)
    const ongoingTransactions = data.filter(t => 
      t.transaction_stage === 'under_contract' || 
      t.transaction_stage === 'pending' ||
      (t.status === 'ongoing' && t.transaction_stage !== 'closed')
    );
    const ongoing = ongoingTransactions.length;
    const pipelineValue = ongoingTransactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);

    // Closing rate (closed transactions vs all transactions)
    const totalTransactions = data.length;
    const closedCount = closedTransactions.length;
    const closingRate = totalTransactions > 0 ? (closedCount / totalTransactions) * 100 : 0;

    // Average deal value (based on closed transactions only)
    const avgDealValue = closedCount > 0 ? totalSalesYear / closedCount : 0;

    // Enhanced metrics calculations
    const avgDaysOnMarket = closedTransactions.length > 0 
      ? closedTransactions.reduce((sum, t) => sum + (t.days_on_market || 0), 0) / closedTransactions.length 
      : 0;

    const avgPricePerSqft = closedTransactions
      .filter(t => t.price_per_sqft && t.price_per_sqft > 0)
      .reduce((sum, t, _, arr) => sum + (t.price_per_sqft! / arr.length), 0);

    const avgCommissionRate = closedTransactions
      .filter(t => t.commission_rate && t.commission_rate > 0)
      .reduce((sum, t, _, arr) => sum + (t.commission_rate! / arr.length), 0);

    // Property type breakdown
    const propertyTypeBreakdown = data.reduce((acc: Record<string, number>, t) => {
      const type = t.property_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Lead source breakdown
    const leadSourceBreakdown = data.reduce((acc: Record<string, number>, t) => {
      const source = t.lead_source || 'Unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    // Risk factor count
    const riskFactorCount = data.reduce((sum, t) => sum + (t.risk_factors?.length || 0), 0);

    // Deal velocity (avg days from contract to close)
    const dealVelocity = closedTransactions
      .filter(t => t.contract_date && t.closing_date)
      .reduce((sum, t, _, arr) => {
        const contractDate = new Date(t.contract_date!);
        const closeDate = new Date(t.closing_date!);
        const days = Math.max(0, (closeDate.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + (days / arr.length);
      }, 0);

    console.log('Enhanced metrics calculated:', {
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
      avgDaysOnMarket,
      avgPricePerSqft,
      avgCommissionRate,
      propertyTypeBreakdown,
      leadSourceBreakdown,
      riskFactorCount,
      dealVelocity,
    });

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
      avgDaysOnMarket,
      avgPricePerSqft,
      avgCommissionRate,
      propertyTypeBreakdown,
      leadSourceBreakdown,
      riskFactorCount,
      dealVelocity,
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
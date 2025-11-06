import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CompanyRevenueMetrics {
  // Current period
  totalGCI: number;
  totalSalesVolume: number;
  totalTransactions: number;
  avgCommissionPerDeal: number;
  avgDealSize: number;
  
  // MTD metrics
  mtdGCI: number;
  mtdTransactions: number;
  mtdSalesVolume: number;
  
  // YTD metrics
  ytdGCI: number;
  ytdTransactions: number;
  ytdSalesVolume: number;
  
  // Comparisons
  mtdVsPriorMonth: number; // % change
  ytdVsPriorYear: number; // % change
  
  // Breakdowns
  buyerSideGCI: number;
  sellerSideGCI: number;
  buyerSideCount: number;
  sellerSideCount: number;
  
  // REOP revenue (20% rake)
  reopRevenue: number;
  agentPayout: number;
}

export function useCompanyRevenue() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<CompanyRevenueMetrics>({
    totalGCI: 0,
    totalSalesVolume: 0,
    totalTransactions: 0,
    avgCommissionPerDeal: 0,
    avgDealSize: 0,
    mtdGCI: 0,
    mtdTransactions: 0,
    mtdSalesVolume: 0,
    ytdGCI: 0,
    ytdTransactions: 0,
    ytdSalesVolume: 0,
    mtdVsPriorMonth: 0,
    ytdVsPriorYear: 0,
    buyerSideGCI: 0,
    sellerSideGCI: 0,
    buyerSideCount: 0,
    sellerSideCount: 0,
    reopRevenue: 0,
    agentPayout: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchCompanyRevenue = async () => {
    setLoading(true);
    try {
      // Fetch all closed transactions for Real Estate on Purpose
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('contract_status', 'Closed')
        .eq('team_name', 'Real Estate on Purpose')
        .order('closing_date', { ascending: false });

      if (error) throw error;

      calculateMetrics(data || []);
    } catch (error) {
      console.error('Error fetching company revenue:', error);
      toast({
        title: "Error",
        description: "Failed to load company revenue data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (transactions: any[]) => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);

    // Total metrics (all time)
    const totalGCI = transactions.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
    const totalSalesVolume = transactions.reduce((sum, t) => sum + (t.purchase_amount || 0), 0);
    const totalTransactions = transactions.length;
    const avgCommissionPerDeal = totalTransactions > 0 ? totalGCI / totalTransactions : 0;
    const avgDealSize = totalTransactions > 0 ? totalSalesVolume / totalTransactions : 0;

    // MTD metrics
    const mtdTransactionsList = transactions.filter(t => 
      t.closing_date && new Date(t.closing_date) >= monthStart
    );
    const mtdGCI = mtdTransactionsList.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
    const mtdTransactions = mtdTransactionsList.length;
    const mtdSalesVolume = mtdTransactionsList.reduce((sum, t) => sum + (t.purchase_amount || 0), 0);

    // YTD metrics
    const ytdTransactionsList = transactions.filter(t => 
      t.closing_date && new Date(t.closing_date) >= yearStart
    );
    const ytdGCI = ytdTransactionsList.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
    const ytdTransactions = ytdTransactionsList.length;
    const ytdSalesVolume = ytdTransactionsList.reduce((sum, t) => sum + (t.purchase_amount || 0), 0);

    // Prior month comparison
    const priorMonthTransactions = transactions.filter(t => {
      const closeDate = t.closing_date ? new Date(t.closing_date) : null;
      return closeDate && closeDate >= lastMonthStart && closeDate <= lastMonthEnd;
    });
    const priorMonthGCI = priorMonthTransactions.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
    const mtdVsPriorMonth = priorMonthGCI > 0 
      ? ((mtdGCI - priorMonthGCI) / priorMonthGCI) * 100 
      : mtdGCI > 0 ? 100 : 0;

    // Prior year comparison
    const priorYearTransactions = transactions.filter(t => {
      const closeDate = t.closing_date ? new Date(t.closing_date) : null;
      return closeDate && closeDate >= lastYearStart && closeDate <= lastYearEnd;
    });
    const priorYearGCI = priorYearTransactions.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
    const ytdVsPriorYear = priorYearGCI > 0 
      ? ((ytdGCI - priorYearGCI) / priorYearGCI) * 100 
      : ytdGCI > 0 ? 100 : 0;

    // Buyer vs Seller breakdown
    const buyerTransactions = transactions.filter(t => t.representation_side === 'Buyer');
    const sellerTransactions = transactions.filter(t => t.representation_side === 'Seller');
    const buyerSideGCI = buyerTransactions.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
    const sellerSideGCI = sellerTransactions.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
    const buyerSideCount = buyerTransactions.length;
    const sellerSideCount = sellerTransactions.length;

    // REOP revenue (20% rake) and agent payout
    const RAKE_PERCENTAGE = 0.20;
    const reopRevenue = totalGCI * RAKE_PERCENTAGE;
    const agentPayout = totalGCI - reopRevenue;

    setMetrics({
      totalGCI,
      totalSalesVolume,
      totalTransactions,
      avgCommissionPerDeal,
      avgDealSize,
      mtdGCI,
      mtdTransactions,
      mtdSalesVolume,
      ytdGCI,
      ytdTransactions,
      ytdSalesVolume,
      mtdVsPriorMonth,
      ytdVsPriorYear,
      buyerSideGCI,
      sellerSideGCI,
      buyerSideCount,
      sellerSideCount,
      reopRevenue,
      agentPayout,
    });
  };

  useEffect(() => {
    fetchCompanyRevenue();
  }, []);

  return {
    metrics,
    loading,
    refetch: fetchCompanyRevenue,
  };
}

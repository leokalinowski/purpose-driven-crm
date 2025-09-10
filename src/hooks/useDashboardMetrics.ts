// DEPRECATED: Use useDashboardData instead
// This hook is kept for backward compatibility but redirects to the new unified hook

import { useDashboardData } from '@/hooks/useDashboardData';

export type KPI = {
  label: string;
  value: number | string;
  deltaPct?: number;
  subtext?: string;
};

export type MonthlyPoint = { month: string; value: number };

export type DashboardData = {
  kpis: {
    totalContacts: KPI;
    sphereSyncCompletionRate: KPI;
    upcomingEvents: KPI;
    newsletterOpenRate: KPI;
    activeTransactions: KPI;
    coachingSessions: KPI;
  };
  charts: {
    leadsTrend: MonthlyPoint[];
    tasksTrend: MonthlyPoint[];
    transactionsTrend: MonthlyPoint[];
  };
};

export function useDashboardMetrics() {
  console.warn('useDashboardMetrics is deprecated. Use useDashboardData instead.');
  
  const { data: unifiedData, loading, isAgent } = useDashboardData();
  
  // Type guard and conversion for backward compatibility
  const data: DashboardData | null = isAgent && unifiedData && 'charts' in unifiedData ? {
    kpis: {
      totalContacts: (unifiedData as any).kpis.totalContacts,
      sphereSyncCompletionRate: (unifiedData as any).kpis.sphereSyncCompletionRate,
      upcomingEvents: (unifiedData as any).kpis.upcomingEvents,
      newsletterOpenRate: (unifiedData as any).kpis.newsletterOpenRate,
      activeTransactions: (unifiedData as any).kpis.activeTransactions,
      coachingSessions: (unifiedData as any).kpis.coachingSessions,
    },
    charts: (unifiedData as any).charts,
  } : null;
  
  return { data, loading };
}

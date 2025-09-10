import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useDashboardData } from '@/hooks/useDashboardData';

export type AdminKPI = {
  label: string;
  value: number | string;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  change?: string;
};

export type AgentPerformance = {
  agent_id: string;
  agent_name: string;
  email: string;
  total_contacts: number;
  contacts_this_month: number;
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  total_transactions: number;
  active_transactions: number;
  total_gci: number;
  total_events: number;
  upcoming_events: number;
  coaching_sessions: number;
  agent_since: string;
};

export type BusinessMetrics = {
  period: string;
  new_contacts: number;
  total_contacts_cumulative: number;
  tasks_created: number;
  tasks_completed: number;
  new_transactions: number;
  monthly_gci: number;
  events_held: number;
  avg_attendance: number;
  newsletters_sent: number;
  avg_open_rate: number;
};

export type AdminMetricsData = {
  kpis: {
    totalCompanyContacts: AdminKPI;
    overallTaskCompletion: AdminKPI;
    totalActiveTransactions: AdminKPI;
    totalMonthlyRevenue: AdminKPI;
    companyEventAttendance: AdminKPI;
    avgNewsletterPerformance: AdminKPI;
  };
  agentPerformance: AgentPerformance[];
  businessTrends: BusinessMetrics[];
};

export function useAdminMetrics() {
  console.warn('useAdminMetrics is deprecated. Use useDashboardData instead.');
  
  const { data: unifiedData, loading, isAdmin, refreshData } = useDashboardData();
  
  // Type guard and conversion for backward compatibility
  const data: AdminMetricsData | null = isAdmin && unifiedData && 'agentPerformance' in unifiedData ? {
    kpis: {
      totalCompanyContacts: (unifiedData as any).kpis.totalCompanyContacts,
      overallTaskCompletion: (unifiedData as any).kpis.overallTaskCompletion,
      totalActiveTransactions: (unifiedData as any).kpis.totalActiveTransactions,
      totalMonthlyRevenue: (unifiedData as any).kpis.totalMonthlyRevenue,
      companyEventAttendance: (unifiedData as any).kpis.companyEventAttendance,
      avgNewsletterPerformance: (unifiedData as any).kpis.avgNewsletterPerformance,
    },
    agentPerformance: (unifiedData as any).agentPerformance,
    businessTrends: [] // Simplified for backward compatibility
  } : null;
  
  return { data, loading, refetch: refreshData };
}
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

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
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminMetricsData | null>(null);

  const fetchData = async () => {
    if (!user || !isAdmin) return;
    
    setLoading(true);
    try {
      // Fetch agent performance data
      const { data: agentData, error: agentError } = await supabase
        .from('agent_performance_summary')
        .select('*')
        .order('completion_rate', { ascending: false });

      if (agentError) throw agentError;

      // Fetch business metrics for trends
      const { data: businessData, error: businessError } = await supabase
        .from('monthly_business_metrics')
        .select('*')
        .order('period', { ascending: true });

      if (businessError) throw businessError;

      // Calculate company-wide KPIs
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const lastMonthData = businessData?.[businessData.length - 2];
      const currentMonthData = businessData?.[businessData.length - 1];

      const totalContacts = agentData?.reduce((sum, agent) => sum + agent.total_contacts, 0) || 0;
      const totalTasksCreated = agentData?.reduce((sum, agent) => sum + agent.total_tasks, 0) || 0;
      const totalTasksCompleted = agentData?.reduce((sum, agent) => sum + agent.completed_tasks, 0) || 0;
      const overallCompletionRate = totalTasksCreated > 0 ? (totalTasksCompleted / totalTasksCreated) * 100 : 0;
      
      const totalActiveTransactions = agentData?.reduce((sum, agent) => sum + agent.active_transactions, 0) || 0;
      const totalMonthlyGCI = currentMonthData?.monthly_gci || 0;
      const totalEvents = agentData?.reduce((sum, agent) => sum + agent.total_events, 0) || 0;
      const avgAttendance = currentMonthData?.avg_attendance || 0;
      const avgOpenRate = currentMonthData?.avg_open_rate || 0;

      // Calculate trends
      const contactsTrend = lastMonthData && currentMonthData 
        ? currentMonthData.new_contacts > lastMonthData.new_contacts ? 'up' : 
          currentMonthData.new_contacts < lastMonthData.new_contacts ? 'down' : 'neutral'
        : 'neutral';

      const result: AdminMetricsData = {
        kpis: {
          totalCompanyContacts: {
            label: 'Total Company Contacts',
            value: totalContacts,
            subtext: 'All agents combined',
            trend: contactsTrend as 'up' | 'down' | 'neutral',
            change: lastMonthData && currentMonthData 
              ? `${Math.abs(currentMonthData.new_contacts - lastMonthData.new_contacts)} vs last month`
              : undefined
          },
          overallTaskCompletion: {
            label: 'Company Task Completion',
            value: `${Math.round(overallCompletionRate)}%`,
            subtext: 'All active tasks',
            trend: 'neutral'
          },
          totalActiveTransactions: {
            label: 'Active Transactions',
            value: totalActiveTransactions,
            subtext: 'Company-wide pipeline',
            trend: 'neutral'
          },
          totalMonthlyRevenue: {
            label: 'Monthly Revenue (GCI)',
            value: `$${Math.round(totalMonthlyGCI).toLocaleString()}`,
            subtext: 'Current month',
            trend: lastMonthData 
              ? totalMonthlyGCI > (lastMonthData.monthly_gci || 0) ? 'up' : 
                totalMonthlyGCI < (lastMonthData.monthly_gci || 0) ? 'down' : 'neutral'
              : 'neutral'
          },
          companyEventAttendance: {
            label: 'Event Attendance',
            value: Math.round(avgAttendance),
            subtext: 'Average per event',
            trend: 'neutral'
          },
          avgNewsletterPerformance: {
            label: 'Newsletter Open Rate',
            value: `${Math.round(avgOpenRate)}%`,
            subtext: 'Company average',
            trend: 'neutral'
          }
        },
        agentPerformance: agentData || [],
        businessTrends: businessData || []
      };

      setData(result);
    } catch (error) {
      console.error('Failed to load admin metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, isAdmin]);

  return { data, loading, refetch: fetchData };
}
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
      // Fetch existing data from available tables
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'agent');

      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*');

      const { data: tasksData } = await supabase
        .from('spheresync_tasks')
        .select('*');

      const { data: transactionsData } = await supabase
        .from('transaction_coordination')
        .select('*');

      const { data: eventsData } = await supabase
        .from('events')
        .select('*');

      // Calculate metrics from existing data
      const totalContacts = contactsData?.length || 0;
      const totalTasks = tasksData?.length || 0;
      const completedTasks = tasksData?.filter(task => task.completed).length || 0;
      const overallCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      const totalActiveTransactions = transactionsData?.filter(t => t.status === 'ongoing').length || 0;
      const totalEvents = eventsData?.length || 0;
      const avgAttendance = eventsData?.reduce((sum, event) => sum + (event.attendance_count || 0), 0) / (eventsData?.length || 1) || 0;

      // Build agent performance data from existing tables
      const agentPerformanceData: AgentPerformance[] = profilesData?.map(agent => {
        const agentContacts = contactsData?.filter(c => c.agent_id === agent.user_id) || [];
        const agentTasks = tasksData?.filter(t => t.agent_id === agent.user_id) || [];
        const agentCompletedTasks = agentTasks.filter(t => t.completed);
        const agentTransactions = transactionsData?.filter(t => t.responsible_agent === agent.user_id) || [];
        const agentEvents = eventsData?.filter(e => e.agent_id === agent.user_id) || [];

        return {
          agent_id: agent.user_id,
          agent_name: `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Unknown',
          email: agent.email || '',
          total_contacts: agentContacts.length,
          contacts_this_month: agentContacts.length, // Simplified for now
          total_tasks: agentTasks.length,
          completed_tasks: agentCompletedTasks.length,
          completion_rate: agentTasks.length > 0 ? (agentCompletedTasks.length / agentTasks.length) * 100 : 0,
          total_transactions: agentTransactions.length,
          active_transactions: agentTransactions.filter(t => t.status === 'ongoing').length,
          total_gci: agentTransactions.reduce((sum, t) => sum + (t.gci || 0), 0),
          total_events: agentEvents.length,
          upcoming_events: agentEvents.filter(e => new Date(e.event_date) > new Date()).length,
          coaching_sessions: 0, // Simplified for now
          agent_since: agent.created_at
        };
      }) || [];

      const result: AdminMetricsData = {
        kpis: {
          totalCompanyContacts: {
            label: 'Total Company Contacts',
            value: totalContacts,
            subtext: 'All agents combined',
            trend: 'neutral'
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
            value: `$${Math.round(transactionsData?.reduce((sum, t) => sum + (t.gci || 0), 0) || 0).toLocaleString()}`,
            subtext: 'All time',
            trend: 'neutral'
          },
          companyEventAttendance: {
            label: 'Event Attendance',
            value: Math.round(avgAttendance),
            subtext: 'Average per event',
            trend: 'neutral'
          },
          avgNewsletterPerformance: {
            label: 'Newsletter Open Rate',
            value: '0%',
            subtext: 'No data available',
            trend: 'neutral'
          }
        },
        agentPerformance: agentPerformanceData,
        businessTrends: [] // Simplified for now
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
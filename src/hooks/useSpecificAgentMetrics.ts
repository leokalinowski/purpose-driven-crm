import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

export type AgentSpecificKPI = {
  label: string;
  value: number | string;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  change?: string;
};

export type AgentSpecificMetrics = {
  agent: {
    id: string;
    name: string;
    email: string;
    since: string;
  };
  kpis: {
    totalContacts: AgentSpecificKPI;
    taskCompletionRate: AgentSpecificKPI;
    activeTransactions: AgentSpecificKPI;
    totalGCI: AgentSpecificKPI;
    upcomingEvents: AgentSpecificKPI;
    coachingSessions: AgentSpecificKPI;
  };
  charts: {
    contactsTrend: { month: string; value: number }[];
    tasksTrend: { month: string; value: number }[];
    transactionsTrend: { month: string; value: number }[];
  };
  activities: {
    recentTransactions: any[];
    upcomingTasks: any[];
    recentCoaching: any[];
  };
};

export function useSpecificAgentMetrics(agentId: string | null) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AgentSpecificMetrics | null>(null);

  useEffect(() => {
    if (!user || !isAdmin || !agentId) {
      setData(null);
      setLoading(false);
      return;
    }

    const fetchAgentData = async () => {
      setLoading(true);
      try {
        // Get agent profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', agentId)
          .single();

        if (!profile) {
          setData(null);
          setLoading(false);
          return;
        }

        // Fetch all agent data in parallel
        const [
          { data: contacts },
          { data: tasks },
          { data: transactions },
          { data: events },
          { data: coachingSessions },
          { data: socialPosts },
          { data: socialAnalytics }
        ] = await Promise.all([
          supabase.from('contacts').select('*').eq('agent_id', agentId),
          supabase.from('spheresync_tasks').select('*').eq('agent_id', agentId),
          supabase.from('transaction_coordination').select('*').eq('responsible_agent', agentId),
          supabase.from('events').select('*').eq('agent_id', agentId),
          supabase.from('coaching_sessions').select('*').eq('agent_id', agentId),
          supabase.from('social_posts').select('*').eq('agent_id', agentId),
          supabase.from('social_analytics').select('*').eq('agent_id', agentId)
        ]);

        // Calculate metrics
        const totalContacts = contacts?.length || 0;
        const totalTasks = tasks?.length || 0;
        const completedTasks = tasks?.filter(t => t.completed).length || 0;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const activeTransactions = transactions?.filter(t => t.status === 'ongoing').length || 0;
        const totalGCI = transactions?.reduce((sum, t) => sum + (t.gci || 0), 0) || 0;
        const upcomingEvents = events?.filter(e => new Date(e.event_date) > new Date()).length || 0;
        const totalCoachingSessions = coachingSessions?.length || 0;

        // Generate trend data (last 6 months)
        const generateTrend = (data: any[], dateField: string) => {
          const months = [];
          for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const count = data?.filter(item => {
              const itemDate = new Date(item[dateField]);
              return itemDate.getFullYear() === date.getFullYear() && 
                     itemDate.getMonth() === date.getMonth();
            }).length || 0;
            months.push({ month: monthKey, value: count });
          }
          return months;
        };

        const result: AgentSpecificMetrics = {
          agent: {
            id: profile.user_id,
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown',
            email: profile.email || '',
            since: profile.created_at
          },
          kpis: {
            totalContacts: {
              label: 'Total Contacts',
              value: totalContacts,
              subtext: 'All time',
              trend: 'neutral'
            },
            taskCompletionRate: {
              label: 'Task Completion Rate',
              value: `${Math.round(completionRate)}%`,
              subtext: 'SphereSync tasks',
              trend: completionRate >= 80 ? 'up' : completionRate >= 60 ? 'neutral' : 'down'
            },
            activeTransactions: {
              label: 'Active Transactions',
              value: activeTransactions,
              subtext: 'In pipeline',
              trend: 'neutral'
            },
            totalGCI: {
              label: 'Total GCI',
              value: `$${Math.round(totalGCI).toLocaleString()}`,
              subtext: 'All time earnings',
              trend: 'neutral'
            },
            upcomingEvents: {
              label: 'Upcoming Events',
              value: upcomingEvents,
              subtext: 'Next 30 days',
              trend: 'neutral'
            },
            coachingSessions: {
              label: 'Coaching Sessions',
              value: totalCoachingSessions,
              subtext: 'All time',
              trend: 'neutral'
            }
          },
          charts: {
            contactsTrend: generateTrend(contacts || [], 'created_at'),
            tasksTrend: generateTrend(tasks?.filter(t => t.completed) || [], 'completed_at'),
            transactionsTrend: generateTrend(transactions || [], 'created_at')
          },
          activities: {
            recentTransactions: (transactions || [])
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 5),
            upcomingTasks: (tasks || [])
              .filter(t => !t.completed)
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .slice(0, 5),
            recentCoaching: (coachingSessions || [])
              .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
              .slice(0, 3)
          }
        };

        setData(result);
      } catch (error) {
        console.error('Failed to load agent metrics:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentData();
  }, [user, isAdmin, agentId]);

  return { data, loading };
}
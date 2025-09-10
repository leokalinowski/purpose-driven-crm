import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { startOfMonth, subMonths, addMonths } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const ET_TZ = 'America/New_York';

// Unified KPI type for both agent and admin dashboards
export type UnifiedKPI = {
  label: string;
  value: number | string;
  deltaPct?: number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  change?: string;
};

export type MonthlyTrend = { month: string; value: number };

export type AgentDashboardData = {
  kpis: {
    totalContacts: UnifiedKPI;
    sphereSyncCompletionRate: UnifiedKPI;
    upcomingEvents: UnifiedKPI;
    newsletterOpenRate: UnifiedKPI;
    activeTransactions: UnifiedKPI;
    coachingSessions: UnifiedKPI;
  };
  charts: {
    leadsTrend: MonthlyTrend[];
    tasksTrend: MonthlyTrend[];
    transactionsTrend: MonthlyTrend[];
  };
};

export type AdminDashboardData = {
  kpis: {
    totalCompanyContacts: UnifiedKPI;
    overallTaskCompletion: UnifiedKPI;
    totalActiveTransactions: UnifiedKPI;
    totalMonthlyRevenue: UnifiedKPI;
    companyEventAttendance: UnifiedKPI;
    avgNewsletterPerformance: UnifiedKPI;
  };
  agentPerformance: Array<{
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
  }>;
  businessTrends: MonthlyTrend[];
};

type DashboardData = AgentDashboardData | AdminDashboardData;

function getETMonthBoundaries(reference: Date) {
  const etNow = toZonedTime(reference, ET_TZ) as unknown as Date;
  const currentStartET = startOfMonth(etNow);
  const nextStartET = startOfMonth(addMonths(etNow, 1));
  const prevStartET = startOfMonth(subMonths(etNow, 1));

  return {
    currentStart: (fromZonedTime(currentStartET as unknown as Date, ET_TZ) as unknown as Date).toISOString(),
    nextStart: (fromZonedTime(nextStartET as unknown as Date, ET_TZ) as unknown as Date).toISOString(),
    prevStart: (fromZonedTime(prevStartET as unknown as Date, ET_TZ) as unknown as Date).toISOString(),
  };
}

function calculatePercentageChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current > 0 ? 100 : undefined;
  return ((current - previous) / previous) * 100;
}

function generateMonthlyTrend(data: any[], dateField: string, monthsBack = 6): MonthlyTrend[] {
  const now = new Date();
  const months: Record<string, number> = {};
  
  // Initialize months
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months[key] = 0;
  }

  // Count data by month
  data.forEach(item => {
    if (!item[dateField]) return;
    const date = new Date(item[dateField]);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (key in months) {
      months[key]++;
    }
  });

  return Object.entries(months).map(([month, value]) => ({ month, value }));
}

export function useDashboardData() {
  const { user } = useAuth();
  const { role, isAdmin, loading: roleLoading } = useUserRole();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  
  // Debounce mechanism for real-time updates
  const debounceRef = useRef<NodeJS.Timeout>();

  const fetchAgentData = useCallback(async (userId: string): Promise<AgentDashboardData> => {
    console.log('📊 Fetching agent dashboard data for:', userId);
    
    const now = new Date();
    const { currentStart, nextStart, prevStart } = getETMonthBoundaries(now);

    // Batch all queries for better performance
    const [
      contactsTotal,
      contactsCurrent,
      contactsPrevious,
      contactsSince,
      tasksCreated,
      tasksCompleted,
      tasksCompletedPrev,
      tasksSince,
      eventsUpcoming,
      eventsPrevious,
      newslettersCurrent,
      newslettersPrevious,
      transactionsAll,
      transactionsCurrent,
      transactionsPrevious,
      transactionsSince,
      coachingCurrent,
      coachingPrevious
    ] = await Promise.all([
      // Contacts
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('agent_id', userId),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('created_at', currentStart).lt('created_at', nextStart),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('created_at', prevStart).lt('created_at', currentStart),
      supabase.from('contacts').select('id, created_at').eq('agent_id', userId).gte('created_at', subMonths(now, 6).toISOString()),
      
      // SphereSync Tasks
      supabase.from('spheresync_tasks').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('created_at', currentStart).lt('created_at', nextStart),
      supabase.from('spheresync_tasks').select('*', { count: 'exact', head: true }).eq('agent_id', userId).eq('completed', true).gte('completed_at', currentStart).lt('completed_at', nextStart),
      supabase.from('spheresync_tasks').select('*', { count: 'exact', head: true }).eq('agent_id', userId).eq('completed', true).gte('completed_at', prevStart).lt('completed_at', currentStart),
      supabase.from('spheresync_tasks').select('id, completed_at').eq('agent_id', userId).not('completed_at', 'is', null).gte('completed_at', subMonths(now, 6).toISOString()),
      
      // Events
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('event_date', now.toISOString().split('T')[0]).lt('event_date', addMonths(now, 1).toISOString().split('T')[0]),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('event_date', prevStart.split('T')[0]).lt('event_date', currentStart.split('T')[0]),
      
      // Newsletters
      supabase.from('newsletter_campaigns').select('open_rate').eq('created_by', userId).gte('created_at', currentStart).lt('created_at', nextStart),
      supabase.from('newsletter_campaigns').select('open_rate').eq('created_by', userId).gte('created_at', prevStart).lt('created_at', currentStart),
      
      // Transactions
      supabase.from('transaction_coordination').select('*').eq('responsible_agent', userId),
      supabase.from('transaction_coordination').select('*', { count: 'exact', head: true }).eq('responsible_agent', userId).gte('created_at', currentStart).lt('created_at', nextStart),
      supabase.from('transaction_coordination').select('*', { count: 'exact', head: true }).eq('responsible_agent', userId).gte('created_at', prevStart).lt('created_at', currentStart),
      supabase.from('transaction_coordination').select('id, created_at').eq('responsible_agent', userId).gte('created_at', subMonths(now, 6).toISOString()),
      
      // Coaching
      supabase.from('coaching_sessions').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('session_date', currentStart.split('T')[0]).lt('session_date', nextStart.split('T')[0]),
      supabase.from('coaching_sessions').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('session_date', prevStart.split('T')[0]).lt('session_date', currentStart.split('T')[0])
    ]);

    // Calculate metrics
    const totalContacts = contactsTotal.count || 0;
    const contactsCurr = contactsCurrent.count || 0;
    const contactsPrev = contactsPrevious.count || 0;

    const tasksCreatedCount = tasksCreated.count || 0;
    const tasksCompletedCount = tasksCompleted.count || 0;
    const tasksCompletedPrevCount = tasksCompletedPrev.count || 0;
    const completionRate = tasksCreatedCount > 0 ? (tasksCompletedCount / tasksCreatedCount) * 100 : 0;

    const eventsUpcomingCount = eventsUpcoming.count || 0;
    const eventsPrevCount = eventsPrevious.count || 0;

    const newsletterOpenRateCurr = newslettersCurrent.data?.reduce((sum, n) => sum + (Number(n.open_rate) || 0), 0) / (newslettersCurrent.data?.length || 1) || 0;
    const newsletterOpenRatePrev = newslettersPrevious.data?.reduce((sum, n) => sum + (Number(n.open_rate) || 0), 0) / (newslettersPrevious.data?.length || 1) || 0;

    const activeTransactions = transactionsAll.data?.filter(t => t.status !== 'closed').length || 0;
    const transactionsCurrCount = transactionsCurrent.count || 0;
    const transactionsPrevCount = transactionsPrevious.count || 0;

    const coachingCurrCount = coachingCurrent.count || 0;
    const coachingPrevCount = coachingPrevious.count || 0;

    return {
      kpis: {
        totalContacts: {
          label: 'Total Leads',
          value: totalContacts,
          deltaPct: calculatePercentageChange(contactsCurr, contactsPrev),
          subtext: 'From last month'
        },
        sphereSyncCompletionRate: {
          label: 'SphereSync Completion Rate',
          value: `${Math.round(completionRate)}%`,
          deltaPct: calculatePercentageChange(tasksCompletedCount, tasksCompletedPrevCount),
          subtext: 'This month'
        },
        upcomingEvents: {
          label: 'Upcoming Events (30d)',
          value: eventsUpcomingCount,
          deltaPct: calculatePercentageChange(eventsUpcomingCount, eventsPrevCount),
          subtext: 'vs. last month'
        },
        newsletterOpenRate: {
          label: 'Newsletter Open Rate',
          value: `${Math.round(newsletterOpenRateCurr)}%`,
          deltaPct: calculatePercentageChange(newsletterOpenRateCurr, newsletterOpenRatePrev),
          subtext: 'Avg this month'
        },
        activeTransactions: {
          label: 'Active Transactions',
          value: activeTransactions,
          deltaPct: calculatePercentageChange(transactionsCurrCount, transactionsPrevCount),
          subtext: 'New vs last month'
        },
        coachingSessions: {
          label: 'Coaching Sessions',
          value: coachingCurrCount,
          deltaPct: calculatePercentageChange(coachingCurrCount, coachingPrevCount),
          subtext: 'This month'
        }
      },
      charts: {
        leadsTrend: generateMonthlyTrend(contactsSince.data || [], 'created_at'),
        tasksTrend: generateMonthlyTrend(tasksSince.data || [], 'completed_at'),
        transactionsTrend: generateMonthlyTrend(transactionsSince.data || [], 'created_at')
      }
    };
  }, []);

  const fetchAdminData = useCallback(async (): Promise<AdminDashboardData> => {
    console.log('📊 Fetching admin dashboard data');
    
    const [
      profilesData,
      contactsData,
      tasksData,
      transactionsData,
      eventsData,
      newslettersData
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'agent'),
      supabase.from('contacts').select('*'),
      supabase.from('spheresync_tasks').select('*'),
      supabase.from('transaction_coordination').select('*'),
      supabase.from('events').select('*'),
      supabase.from('newsletter_campaigns').select('*')
    ]);

    const totalContacts = contactsData.data?.length || 0;
    const totalTasks = tasksData.data?.length || 0;
    const completedTasks = tasksData.data?.filter(t => t.completed).length || 0;
    const overallCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const activeTransactions = transactionsData.data?.filter(t => t.status !== 'closed').length || 0;
    const totalGCI = transactionsData.data?.reduce((sum, t) => sum + (t.gci || 0), 0) || 0;
    const avgAttendance = eventsData.data?.reduce((sum, e) => sum + (e.attendance_count || 0), 0) / (eventsData.data?.length || 1) || 0;
    const avgOpenRate = newslettersData.data?.reduce((sum, n) => sum + (Number(n.open_rate) || 0), 0) / (newslettersData.data?.length || 1) || 0;

    const agentPerformance = profilesData.data?.map(agent => {
      const agentContacts = contactsData.data?.filter(c => c.agent_id === agent.user_id) || [];
      const agentTasks = tasksData.data?.filter(t => t.agent_id === agent.user_id) || [];
      const agentCompletedTasks = agentTasks.filter(t => t.completed);
      const agentTransactions = transactionsData.data?.filter(t => t.responsible_agent === agent.user_id) || [];
      const agentEvents = eventsData.data?.filter(e => e.agent_id === agent.user_id) || [];

      return {
        agent_id: agent.user_id,
        agent_name: `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Unknown',
        email: agent.email || '',
        total_contacts: agentContacts.length,
        contacts_this_month: agentContacts.filter(c => new Date(c.created_at) > subMonths(new Date(), 1)).length,
        total_tasks: agentTasks.length,
        completed_tasks: agentCompletedTasks.length,
        completion_rate: agentTasks.length > 0 ? (agentCompletedTasks.length / agentTasks.length) * 100 : 0,
        total_transactions: agentTransactions.length,
        active_transactions: agentTransactions.filter(t => t.status !== 'closed').length,
        total_gci: agentTransactions.reduce((sum, t) => sum + (t.gci || 0), 0),
        total_events: agentEvents.length,
        upcoming_events: agentEvents.filter(e => new Date(e.event_date) > new Date()).length,
        coaching_sessions: 0, // TODO: Add when coaching data is available
        agent_since: agent.created_at
      };
    }) || [];

    return {
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
          trend: overallCompletionRate > 70 ? 'up' : overallCompletionRate > 50 ? 'neutral' : 'down'
        },
        totalActiveTransactions: {
          label: 'Active Transactions',
          value: activeTransactions,
          subtext: 'Company-wide pipeline',
          trend: 'neutral'
        },
        totalMonthlyRevenue: {
          label: 'Total GCI',
          value: `$${Math.round(totalGCI).toLocaleString()}`,
          subtext: 'All time revenue',
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
          value: `${Math.round(avgOpenRate)}%`,
          subtext: 'Company average',
          trend: avgOpenRate > 25 ? 'up' : avgOpenRate > 15 ? 'neutral' : 'down'
        }
      },
      agentPerformance,
      businessTrends: generateMonthlyTrend(contactsData.data || [], 'created_at')
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!user || roleLoading) return;

    console.log('🔄 Starting dashboard data fetch for user:', user.id, 'role:', role);
    setLoading(true);
    setError(null);

    try {
      const dashboardData = isAdmin ? await fetchAdminData() : await fetchAgentData(user.id);
      setData(dashboardData);
      setLastFetch(new Date());
      console.log('✅ Dashboard data loaded successfully');
    } catch (err) {
      console.error('❌ Failed to load dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user, role, isAdmin, roleLoading, fetchAdminData, fetchAgentData]);

  const debouncedFetchData = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      console.log('🔄 Real-time update triggered');
      fetchData();
    }, 1000); // 1 second debounce
  }, [fetchData]);

  const refreshData = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    await fetchData();
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    console.log('🔌 Setting up real-time subscriptions');
    
    const channel = supabase
      .channel('unified-dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, debouncedFetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spheresync_tasks' }, debouncedFetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, debouncedFetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_campaigns' }, debouncedFetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_coordination' }, debouncedFetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_sessions' }, debouncedFetchData)
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up real-time subscriptions');
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [user, debouncedFetchData]);

  return {
    data,
    loading,
    error,
    lastFetch,
    refreshData,
    isAgent: !isAdmin,
    isAdmin
  };
}
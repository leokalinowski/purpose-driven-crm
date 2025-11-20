import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Briefcase, DollarSign, Calendar, Mail, TrendingUp, TrendingDown, Phone, MessageSquare } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { useTransactions } from '@/hooks/useTransactions';
import { useEvents } from '@/hooks/useEvents';
import { useNewsletterAnalytics } from '@/hooks/useNewsletterAnalytics';
import { useAgentCurrentWeekMetrics } from '@/hooks/useCoaching';

const AGENT_KPI_CONFIG = [
  { key: 'sphereSyncProgress', title: 'SphereSync Progress', icon: Phone },
  { key: 'pipelineValue', title: 'Pipeline Value', icon: DollarSign },
  { key: 'contactsDatabase', title: 'Database Size', icon: Users },
  { key: 'upcomingTasks', title: 'Tasks Due', icon: Target },
  { key: 'monthlyGCI', title: 'Monthly GCI', icon: Briefcase },
  { key: 'coachingMetrics', title: 'Weekly Activity', icon: MessageSquare },
] as const;

export function AgentMetricsCards() {
  const { data: dashboardData, loading: dashboardLoading, isAgent } = useDashboardData();
  const { tasks: sphereSyncTasks, callTasks, textTasks, contacts } = useSphereSyncTasks();
  const { metrics: transactionMetrics } = useTransactions();
  const { tasks: eventTasks } = useEvents();
  const { metrics: newsletterMetrics } = useNewsletterAnalytics();
  const { data: weeklyMetrics } = useAgentCurrentWeekMetrics();

  if (dashboardLoading) {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="min-h-[120px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-6 w-24 rounded bg-muted animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Extract data from dashboardData if available (for agent)
  const dashboardKPIs = isAgent && dashboardData && 'kpis' in dashboardData ? dashboardData.kpis : null;

  // Calculate metrics from individual hooks (for real-time updates)
  const completedSphereSync = sphereSyncTasks.filter(t => t.completed).length;
  const totalSphereSync = sphereSyncTasks.length;
  const sphereSyncCompletion = totalSphereSync > 0 ? Math.round((completedSphereSync / totalSphereSync) * 100) : 0;
  
  // Use dashboard data if available, otherwise calculate from hooks
  const totalContactsValue = dashboardKPIs?.totalContacts?.value ?? contacts.length;
  const activeTransactionsValue = typeof dashboardKPIs?.activeTransactions?.value === 'number' 
    ? dashboardKPIs.activeTransactions.value 
    : transactionMetrics.ongoing;
  
  const pendingEventTasks = eventTasks.filter(t => t.status === 'pending').length;
  const upcomingEventsValue = typeof dashboardKPIs?.upcomingEvents?.value === 'number'
    ? dashboardKPIs.upcomingEvents.value
    : pendingEventTasks;
  
  // Determine trends from dashboard data deltaPct or calculate from hooks
  const getTrend = (deltaPct?: number, fallback?: number): 'up' | 'down' | 'neutral' => {
    if (deltaPct !== undefined) {
      return deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'neutral';
    }
    if (fallback !== undefined) {
      return fallback > 0 ? 'up' : fallback < 0 ? 'down' : 'neutral';
    }
    return 'neutral';
  };
  
  const agentKpis = {
    sphereSyncProgress: {
      value: dashboardKPIs?.sphereSyncCompletionRate?.value ?? `${sphereSyncCompletion}%`,
      subtext: `${completedSphereSync}/${totalSphereSync} tasks completed`,
      trend: getTrend(
        dashboardKPIs?.sphereSyncCompletionRate?.deltaPct,
        sphereSyncCompletion > 70 ? 1 : sphereSyncCompletion > 30 ? 0 : -1
      )
    },
    pipelineValue: {
      value: `$${Math.round(transactionMetrics.pipelineValue).toLocaleString()}`,
      subtext: `${activeTransactionsValue} active transactions`,
      trend: getTrend(
        dashboardKPIs?.activeTransactions?.deltaPct,
        transactionMetrics.monthlyChange
      )
    },
    contactsDatabase: {
      value: typeof totalContactsValue === 'number' ? totalContactsValue : parseInt(totalContactsValue) || 0,
      subtext: dashboardKPIs?.totalContacts?.subtext ?? 'Total contacts in database',
      trend: getTrend(dashboardKPIs?.totalContacts?.deltaPct)
    },
    upcomingTasks: {
      value: typeof upcomingEventsValue === 'number' ? upcomingEventsValue : parseInt(upcomingEventsValue) || 0,
      subtext: dashboardKPIs?.upcomingEvents?.subtext ?? 'Event tasks pending',
      trend: getTrend(dashboardKPIs?.upcomingEvents?.deltaPct, pendingEventTasks > 5 ? -1 : 0)
    },
    monthlyGCI: {
      value: `$${Math.round(transactionMetrics.gciMonth).toLocaleString()}`,
      subtext: `${transactionMetrics.monthlyChange > 0 ? '+' : ''}${Math.round(transactionMetrics.monthlyChange)}% vs last month`,
      trend: transactionMetrics.monthlyChange > 0 ? 'up' : transactionMetrics.monthlyChange < 0 ? 'down' : 'neutral' as 'up' | 'down' | 'neutral'
    },
    coachingMetrics: {
      value: weeklyMetrics?.dials_made || 0,
      subtext: `${weeklyMetrics?.conversations || 0} conversations`,
      trend: 'neutral' as const
    },
  };

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
      {AGENT_KPI_CONFIG.map(({ key, title, icon: Icon }) => {
        const kpi = agentKpis[key];
        const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : null;
        
        return (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpi.value}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {TrendIcon && (
                  <TrendIcon className={`h-3 w-3 ${
                    kpi.trend === 'up' ? 'text-green-500' : 
                    kpi.trend === 'down' ? 'text-red-500' : 
                    'text-muted-foreground'
                  }`} />
                )}
                <span>{kpi.subtext}</span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
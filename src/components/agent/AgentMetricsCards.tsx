import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Briefcase, DollarSign, Calendar, Mail, TrendingUp, TrendingDown, Phone, MessageSquare } from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
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
  const { data: dashboardData, loading: dashboardLoading } = useDashboardMetrics();
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

  // Calculate metrics
  const completedSphereSync = sphereSyncTasks.filter(t => t.completed).length;
  const totalSphereSync = sphereSyncTasks.length;
  const sphereSyncCompletion = totalSphereSync > 0 ? Math.round((completedSphereSync / totalSphereSync) * 100) : 0;
  
  const pendingEventTasks = eventTasks.filter(t => t.status === 'pending').length;
  
  const agentKpis = {
    sphereSyncProgress: {
      value: `${sphereSyncCompletion}%`,
      subtext: `${completedSphereSync}/${totalSphereSync} tasks completed`,
      trend: sphereSyncCompletion > 70 ? 'up' : sphereSyncCompletion > 30 ? 'neutral' : 'down' as 'up' | 'down' | 'neutral'
    },
    pipelineValue: {
      value: `$${Math.round(transactionMetrics.pipelineValue).toLocaleString()}`,
      subtext: `${transactionMetrics.ongoing} active transactions`,
      trend: transactionMetrics.monthlyChange > 0 ? 'up' : transactionMetrics.monthlyChange < 0 ? 'down' : 'neutral' as 'up' | 'down' | 'neutral'
    },
    contactsDatabase: {
      value: contacts.length,
      subtext: 'Total contacts in database',
      trend: 'neutral' as 'neutral'
    },
    upcomingTasks: {
      value: pendingEventTasks,
      subtext: 'Event tasks pending',
      trend: pendingEventTasks > 5 ? 'down' : 'neutral' as 'up' | 'down' | 'neutral'
    },
    monthlyGCI: {
      value: `$${Math.round(transactionMetrics.gciMonth).toLocaleString()}`,
      subtext: `${transactionMetrics.monthlyChange > 0 ? '+' : ''}${Math.round(transactionMetrics.monthlyChange)}% vs last month`,
      trend: transactionMetrics.monthlyChange > 0 ? 'up' : transactionMetrics.monthlyChange < 0 ? 'down' : 'neutral' as 'up' | 'down' | 'neutral'
    },
    coachingMetrics: {
      value: weeklyMetrics?.dials_made || 0,
      subtext: `${weeklyMetrics?.conversations || 0} conversations`,
      trend: 'neutral' as 'neutral'
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
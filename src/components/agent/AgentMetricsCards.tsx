import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Phone, MessageSquare, TrendingUp, TrendingDown, Shield, ShieldCheck, BarChart3, CheckCircle, Clock, Zap } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { useDNCStats } from '@/hooks/useDNCStats';
import { useAgentCurrentWeekMetrics } from '@/hooks/useCoaching';

const AGENT_KPI_CONFIG = [
  { key: 'sphereSyncProgress', title: 'SphereSync Progress', icon: Phone },
  { key: 'weeklyTasks', title: 'Weekly Tasks', icon: Target },
  { key: 'contactsDatabase', title: 'Database Size', icon: Users },
  { key: 'dncCompliance', title: 'DNC Compliance', icon: ShieldCheck },
  { key: 'weeklyActivity', title: 'Weekly Activity', icon: MessageSquare },
  { key: 'conversionRate', title: 'Conversion Rate', icon: BarChart3 },
  { key: 'taskEfficiency', title: 'Task Efficiency', icon: Zap },
  { key: 'contactQuality', title: 'Contact Quality', icon: CheckCircle },
] as const;

export function AgentMetricsCards() {
  const { data: dashboardData, loading: dashboardLoading, isAgent } = useDashboardData();
  const { tasks: sphereSyncTasks, callTasks, textTasks, contacts, historicalStats } = useSphereSyncTasks();
  const { stats: dncStats } = useDNCStats();
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

  // Type guard to check if this is agent data
  const isAgentData = (d: typeof dashboardData): d is Extract<typeof dashboardData, { charts: any }> => {
    return 'charts' in d;
  };
  
  // Extract data from dashboardData if available (for agent)
  const dashboardKPIs = isAgent && dashboardData && isAgentData(dashboardData) ? dashboardData.kpis : null;

  // Calculate metrics from individual hooks (for real-time updates)
  const completedSphereSync = sphereSyncTasks.filter(t => t.completed).length;
  const totalSphereSync = sphereSyncTasks.length;
  const sphereSyncCompletion = totalSphereSync > 0 ? Math.round((completedSphereSync / totalSphereSync) * 100) : 0;
  
  // Calculate weekly task completion trend
  const lastWeekStats = historicalStats.slice(-2);
  const weeklyTrend = lastWeekStats.length === 2
    ? lastWeekStats[1].completionRate - lastWeekStats[0].completionRate
    : 0;

  // Calculate DNC compliance percentage
  const totalContactsWithPhone = dncStats.totalContacts - dncStats.missingPhone;
  const dncComplianceRate = totalContactsWithPhone > 0
    ? Math.round(((dncStats.nonDncContacts + dncStats.dncContacts) / totalContactsWithPhone) * 100)
    : 0;

  // Calculate conversion rate from weekly metrics (dials to conversations)
  const conversionRate = weeklyMetrics?.dials_made && weeklyMetrics.dials_made > 0
    ? Math.round((weeklyMetrics.conversations / weeklyMetrics.dials_made) * 100)
    : 0;

  // Calculate task efficiency (tasks completed per day this week)
  const daysThisWeek = Math.min(7, Math.ceil((new Date().getDay() + 1) / 1)); // Rough estimate
  const taskEfficiency = completedSphereSync > 0 && daysThisWeek > 0
    ? Math.round(completedSphereSync / daysThisWeek)
    : 0;
  
  // Calculate contact quality score (based on DNC compliance and activity)
  const contactQualityScore = dncStats.totalContacts > 0
    ? Math.round(((dncStats.nonDncContacts / dncStats.totalContacts) * 100 + (dncStats.lastChecked ? 20 : 0) + (conversionRate > 5 ? 10 : 0)) / 1.3)
    : 0;

  // Determine trends
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
      value: `${sphereSyncCompletion}%`,
      subtext: `${completedSphereSync}/${totalSphereSync} tasks completed`,
      trend: getTrend(undefined, weeklyTrend)
    },
    weeklyTasks: {
      value: totalSphereSync,
      subtext: `${callTasks.length} calls, ${textTasks.length} texts`,
      trend: getTrend(undefined, totalSphereSync > 10 ? 1 : totalSphereSync > 5 ? 0 : -1)
    },
    contactsDatabase: {
      value: contacts.length,
      subtext: `${dncStats.dncContacts} marked DNC`,
      trend: getTrend(dashboardKPIs?.totalContacts?.deltaPct)
    },
    dncCompliance: {
      value: `${dncComplianceRate}%`,
      subtext: `${dncStats.needsRecheck} need recheck`,
      trend: getTrend(undefined, dncComplianceRate > 90 ? 1 : dncComplianceRate > 70 ? 0 : -1)
    },
    weeklyActivity: {
      value: weeklyMetrics?.dials_made || 0,
      subtext: `${weeklyMetrics?.conversations || 0} conversations`,
      trend: getTrend(undefined, weeklyMetrics?.dials_made > 50 ? 1 : weeklyMetrics?.dials_made > 20 ? 0 : -1)
    },
    conversionRate: {
      value: `${conversionRate}%`,
      subtext: `From ${weeklyMetrics?.dials_made || 0} dials`,
      trend: getTrend(undefined, conversionRate > 10 ? 1 : conversionRate > 5 ? 0 : -1)
    },
    taskEfficiency: {
      value: taskEfficiency,
      subtext: `Tasks per day this week`,
      trend: getTrend(undefined, taskEfficiency > 3 ? 1 : taskEfficiency > 1 ? 0 : -1)
    },
    contactQuality: {
      value: `${Math.min(contactQualityScore, 100)}%`,
      subtext: `Quality score`,
      trend: getTrend(undefined, contactQualityScore > 70 ? 1 : contactQualityScore > 50 ? 0 : -1)
    },
  };

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-8">
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
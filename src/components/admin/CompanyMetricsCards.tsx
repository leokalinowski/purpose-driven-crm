import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Briefcase, DollarSign, Calendar, Mail, TrendingUp, TrendingDown, MessageSquare, Building } from 'lucide-react';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';

const COMPANY_KPI_CONFIG = [
  { key: 'totalCompanyContacts', title: 'Total Company Contacts', icon: Users },
  { key: 'overallTaskCompletion', title: 'Task Completion Rate', icon: Target },
  { key: 'totalActiveTransactions', title: 'Active Transactions', icon: Briefcase },
  { key: 'totalMonthlyRevenue', title: 'Company Revenue', icon: DollarSign },
  { key: 'companyEventAttendance', title: 'Avg Event Attendance', icon: Calendar },
  { key: 'teamSocialEngagement', title: 'Social Engagement', icon: MessageSquare },
] as const;

export function CompanyMetricsCards() {
  const { data, loading } = useAdminMetrics();

  if (loading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
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

  // Enhanced KPIs with additional calculations
  const enhancedKpis = {
    ...data.kpis,
    teamSocialEngagement: {
      label: 'Social Media Engagement',
      value: '0%', // Placeholder - would need social analytics integration
      subtext: 'No social data available',
      trend: 'neutral' as const
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {COMPANY_KPI_CONFIG.map(({ key, title, icon: Icon }) => {
        const kpi = enhancedKpis[key];
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
                <span>{('change' in kpi ? kpi.change : null) || kpi.subtext}</span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
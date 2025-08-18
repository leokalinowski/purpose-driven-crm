import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Briefcase, DollarSign, Calendar, Mail, TrendingUp, TrendingDown } from 'lucide-react';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';

const ADMIN_KPI_CONFIG = [
  { key: 'totalCompanyContacts', title: 'Total Company Contacts', icon: Users },
  { key: 'overallTaskCompletion', title: 'Overall Task Completion', icon: Target },
  { key: 'totalActiveTransactions', title: 'Active Transactions', icon: Briefcase },
  { key: 'totalMonthlyRevenue', title: 'Monthly Revenue', icon: DollarSign },
  { key: 'companyEventAttendance', title: 'Event Attendance', icon: Calendar },
  { key: 'avgNewsletterPerformance', title: 'Newsletter Performance', icon: Mail },
] as const;

export function AdminMetricsCards() {
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {ADMIN_KPI_CONFIG.map(({ key, title, icon: Icon }) => {
        const kpi = data.kpis[key];
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
                <span>{kpi.change || kpi.subtext}</span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
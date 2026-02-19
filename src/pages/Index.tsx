import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { AgentMetricsCards } from '@/components/agent/AgentMetricsCards';
import { AgentActivityWidget } from '@/components/agent/AgentActivityWidget';
import { AgentPerformanceCharts } from '@/components/agent/AgentPerformanceCharts';
import { ExportButtons } from '@/components/dashboard/ExportButtons';
import { DashboardRefreshButton } from '@/components/dashboard/DashboardRefreshButton';
import { SupportWidget } from '@/components/support/SupportWidget';
import { EventsWidget } from '@/components/events/EventsWidget';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (user && !loading) {
      document.title = 'Agent Dashboard | Real Estate on Purpose';
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-5 w-96" />
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div id="agent-dashboard-root" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Agent Task Performance</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Focus on what matters most - your daily tasks, SphereSync progress, and conversion metrics.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 self-start sm:self-auto">
            <DashboardRefreshButton />
            <ExportButtons />
          </div>
        </div>

        {/* Personal KPI Cards */}
        <div>
          <AgentMetricsCards />
        </div>

        {/* Support & Action Items Widget + Events Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SupportWidget />
          <EventsWidget />
        </div>

        {/* Today's Focus & Priority Tasks */}
        <div>
          <AgentActivityWidget />
        </div>

        {/* Performance Charts */}
        <div>
          <AgentPerformanceCharts />
        </div>
      </div>
    </Layout>
  );
};

export default Index;

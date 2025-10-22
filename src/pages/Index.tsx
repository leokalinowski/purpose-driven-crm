import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { AgentMetricsCards } from '@/components/agent/AgentMetricsCards';
import { AgentActivityWidget } from '@/components/agent/AgentActivityWidget';
import { AgentPerformanceCharts } from '@/components/agent/AgentPerformanceCharts';
import { ExportButtons } from '@/components/dashboard/ExportButtons';
import { DashboardRefreshButton } from '@/components/dashboard/DashboardRefreshButton';

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Loading...</h1>
        </div>
      </div>
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Agent Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Your personal performance hub - track goals, manage tasks, and grow your business.
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

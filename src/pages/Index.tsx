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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
            <p className="text-muted-foreground">
              Your personal performance hub - track goals, manage tasks, and grow your business.
            </p>
          </div>
          <div className="flex items-center gap-4">
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

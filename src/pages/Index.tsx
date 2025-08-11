import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { DashboardCards } from '@/components/dashboard/DashboardCards';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { ExportButtons } from '@/components/dashboard/ExportButtons';
import { TabSummaries } from '@/components/dashboard/TabSummaries';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (user) {
      document.title = 'Dashboard | Real Estate on Purpose';
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
      <div id="dashboard-root" className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's an overview of your real estate business.
            </p>
          </div>
          <div>
            <ExportButtons />
          </div>
        </div>
        {/* KPI cards with pinning and links */}
        <div id="kpi-data">
          <DashboardCards />
        </div>
        {/* Tab summaries */}
        <div>
          <TabSummaries />
        </div>
        {/* Charts */}
        <div>
          <DashboardCharts />
        </div>
        {/* Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <RecentActivity />
        </div>
      </div>
    </Layout>
  );
};

export default Index;

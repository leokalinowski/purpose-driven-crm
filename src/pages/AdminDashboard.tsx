import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/layout/Layout';
import { CompanyMetricsCards } from '@/components/admin/CompanyMetricsCards';
import { TeamManagementWidget } from '@/components/admin/TeamManagementWidget';
import { CompanyAnalyticsCharts } from '@/components/admin/CompanyAnalyticsCharts';
import { AgentPerformanceTable } from '@/components/admin/AgentPerformanceTable';
import { RefreshButton } from '@/components/admin/RefreshButton';

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!roleLoading && !isAdmin) {
      navigate('/');
    } else if (user && isAdmin) {
      document.title = 'Admin Dashboard | Real Estate on Purpose';
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Company-wide analytics, team performance, and strategic insights.
            </p>
          </div>
          <RefreshButton />
        </div>

        {/* Company-wide KPI cards */}
        <div>
          <CompanyMetricsCards />
        </div>

        {/* Team management insights */}
        <div>
          <TeamManagementWidget />
        </div>

        {/* Advanced analytics charts */}
        <div>
          <CompanyAnalyticsCharts />
        </div>

        {/* Detailed agent performance table */}
        <div>
          <AgentPerformanceTable />
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
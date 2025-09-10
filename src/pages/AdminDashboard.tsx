import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/layout/Layout';
import { CompanyMetricsCards } from '@/components/admin/CompanyMetricsCards';
import { TeamManagementWidget } from '@/components/admin/TeamManagementWidget';
import { CompanyAnalyticsCharts } from '@/components/admin/CompanyAnalyticsCharts';
import { AgentPerformanceTable } from '@/components/admin/AgentPerformanceTable';
import { DashboardRefreshButton } from '@/components/dashboard/DashboardRefreshButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentSelector } from '@/components/admin/AgentSelector';
import { AgentSpecificDashboard } from '@/components/admin/AgentSpecificDashboard';

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

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
          <DashboardRefreshButton />
        </div>

        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="company">Company Overview</TabsTrigger>
            <TabsTrigger value="agent">Agent Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="company" className="space-y-6">
            {/* Company-wide KPI cards */}
            <CompanyMetricsCards />

            {/* Team management insights */}
            <TeamManagementWidget />

            {/* Advanced analytics charts */}
            <CompanyAnalyticsCharts />

            {/* Detailed agent performance table */}
            <AgentPerformanceTable />
          </TabsContent>
          
          <TabsContent value="agent" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Individual Agent Performance</h2>
                <p className="text-muted-foreground">
                  Deep dive into specific agent metrics and performance trends.
                </p>
              </div>
              <AgentSelector 
                selectedAgentId={selectedAgentId}
                onAgentSelect={setSelectedAgentId}
              />
            </div>
            
            <AgentSpecificDashboard selectedAgentId={selectedAgentId} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
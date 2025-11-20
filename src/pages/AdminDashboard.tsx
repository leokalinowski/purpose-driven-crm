import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/layout/Layout';
import { CompanyMetricsCards } from '@/components/admin/CompanyMetricsCards';
import { CompanyRevenueCards } from '@/components/admin/CompanyRevenueCards';
import { TeamManagementWidget } from '@/components/admin/TeamManagementWidget';
import { CompanyAnalyticsCharts } from '@/components/admin/CompanyAnalyticsCharts';
import { AgentPerformanceTable } from '@/components/admin/AgentPerformanceTable';
import { DashboardRefreshButton } from '@/components/dashboard/DashboardRefreshButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentSelector } from '@/components/admin/AgentSelector';
import { AgentSpecificDashboard } from '@/components/admin/AgentSpecificDashboard';
import { UserManagement } from '@/components/admin/UserManagement';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

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
      <Layout>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-5 w-96" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-md" />
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
          </div>
        </div>
      </Layout>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company">Company Overview</TabsTrigger>
            <TabsTrigger value="agent">Agent Performance</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>
          
          <TabsContent value="company" className="space-y-6">
            {/* Company-wide KPI cards */}
            <CompanyMetricsCards />

            {/* Company revenue from transactions */}
            <CompanyRevenueCards />

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
          
          <TabsContent value="users" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
              <p className="text-muted-foreground">
                Manage user accounts, delete test users, and monitor account status.
              </p>
            </div>
            
            <UserManagement />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
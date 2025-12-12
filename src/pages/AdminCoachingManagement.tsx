import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, Trophy, AlertTriangle, BarChart3, Target } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllCoachingSubmissions, useAgentsList } from '@/hooks/useAdminCoachingData';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';
import AdminTeamOverview from '@/components/coaching/AdminTeamOverview';
import CoachingInsights from '@/components/coaching/CoachingInsights';
import AgentCoachingDeepDive from '@/components/coaching/AgentCoachingDeepDive';

const AdminCoachingManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data: submissions, isLoading: submissionsLoading } = useAllCoachingSubmissions();
  const { data: agents, isLoading: agentsLoading } = useAgentsList();
  
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (!submissions || !agents) return null;

    const currentWeekSubmissions = submissions.filter(
      s => s.week_number === currentWeekNumber && s.year === currentYear
    );

    const totalAgents = agents.length;
    const submittedThisWeek = new Set(currentWeekSubmissions.map(s => s.agent_id)).size;
    
    // Average attempts per week (current week)
    const avgAttempts = currentWeekSubmissions.length > 0
      ? Math.round(currentWeekSubmissions.reduce((sum, s) => sum + (s.dials_made || 0), 0) / currentWeekSubmissions.length)
      : 0;

    // Average closings per week (current week)
    const avgClosings = currentWeekSubmissions.length > 0
      ? (currentWeekSubmissions.reduce((sum, s) => sum + (s.closings || 0), 0) / currentWeekSubmissions.length).toFixed(1)
      : '0';

    // YTD total $ closed
    const ytdSubmissions = submissions.filter(s => s.year === currentYear);
    const ytdTotalClosed = ytdSubmissions.reduce((sum, s) => sum + (s.closing_amount || 0), 0);

    return {
      submittedThisWeek,
      totalAgents,
      avgAttempts,
      avgClosings,
      ytdTotalClosed,
    };
  }, [submissions, agents, currentWeekNumber, currentYear]);

  const isLoading = submissionsLoading || agentsLoading;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Coaching Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Compare agent performance and identify coaching priorities
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : summaryMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Users className="h-4 w-4" />
                  Submissions This Week
                </div>
                <div className="text-2xl font-bold">
                  {summaryMetrics.submittedThisWeek}/{summaryMetrics.totalAgents}
                </div>
                <p className="text-xs text-muted-foreground">Week {currentWeekNumber}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Target className="h-4 w-4" />
                  Avg Attempts/Week
                </div>
                <div className="text-2xl font-bold">
                  {summaryMetrics.avgAttempts}
                </div>
                <p className="text-xs text-muted-foreground">This week's average</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Avg Closings/Week
                </div>
                <div className="text-2xl font-bold">
                  {summaryMetrics.avgClosings}
                </div>
                <p className="text-xs text-muted-foreground">This week's average</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <BarChart3 className="h-4 w-4" />
                  Team $ Closed YTD
                </div>
                <div className="text-2xl font-bold">
                  ${summaryMetrics.ytdTotalClosed.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">{currentYear} total</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Overview
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Insights
            </TabsTrigger>
            <TabsTrigger value="deepdive" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Agent Deep Dive
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <AdminTeamOverview />
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <CoachingInsights />
          </TabsContent>

          <TabsContent value="deepdive" className="mt-6">
            <AgentCoachingDeepDive />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminCoachingManagement;

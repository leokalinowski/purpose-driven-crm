import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, BarChart3, Target, CalendarDays, PenLine } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllCoachingSubmissions, useAgentsList } from '@/hooks/useAdminCoachingData';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';
import AdminTeamOverview from '@/components/coaching/AdminTeamOverview';
import CoachingInsights from '@/components/coaching/CoachingInsights';
import AgentCoachingDeepDive from '@/components/coaching/AgentCoachingDeepDive';
import AdminCoachingSubmissionForm from '@/components/coaching/AdminCoachingSubmissionForm';

const AdminCoachingManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedWeek, setSelectedWeek] = useState('all');
  
  const { data: submissions, isLoading: submissionsLoading } = useAllCoachingSubmissions();
  const { data: agents, isLoading: agentsLoading } = useAgentsList();
  
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();

  // Generate available weeks from submissions
  const availableWeeks = useMemo(() => {
    if (!submissions) return [];
    const weeks = new Map<string, { week: number; year: number }>();
    submissions.forEach(s => {
      const key = `${s.week_number}-${s.year}`;
      if (!weeks.has(key)) {
        weeks.set(key, { week: s.week_number, year: s.year });
      }
    });
    return Array.from(weeks.values())
      .sort((a, b) => b.year - a.year || b.week - a.week)
      .slice(0, 12); // Last 12 weeks with data
  }, [submissions]);

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
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by week" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Weeks</SelectItem>
                <SelectItem value={`${currentWeekNumber}-${currentYear}`}>
                  This Week (W{currentWeekNumber})
                </SelectItem>
                {availableWeeks
                  .filter(w => !(w.week === currentWeekNumber && w.year === currentYear))
                  .map(w => (
                    <SelectItem key={`${w.week}-${w.year}`} value={`${w.week}-${w.year}`}>
                      Week {w.week}, {w.year}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Team Overview</span>
              <span className="sm:hidden">Team</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Performance Insights</span>
              <span className="sm:hidden">Insights</span>
            </TabsTrigger>
            <TabsTrigger value="deepdive" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Agent Deep Dive</span>
              <span className="sm:hidden">Deep Dive</span>
            </TabsTrigger>
            <TabsTrigger value="submit" className="flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              <span className="hidden sm:inline">Submit for Agent</span>
              <span className="sm:hidden">Submit</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <AdminTeamOverview selectedWeek={selectedWeek} />
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <CoachingInsights selectedWeek={selectedWeek} />
          </TabsContent>

          <TabsContent value="deepdive" className="mt-6">
            <AgentCoachingDeepDive selectedWeek={selectedWeek} />
          </TabsContent>

          <TabsContent value="submit" className="mt-6">
            <AdminCoachingSubmissionForm />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminCoachingManagement;

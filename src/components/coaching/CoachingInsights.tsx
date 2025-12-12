import React, { useMemo } from 'react';
import { Trophy, AlertTriangle, TrendingDown, TrendingUp, Users, Target, DollarSign, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  Legend,
  Tooltip
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useAllCoachingSubmissions, useAgentsList, type CoachingSubmissionWithAgent } from '@/hooks/useAdminCoachingData';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

const CoachingInsights = () => {
  const { data: submissions, isLoading: submissionsLoading } = useAllCoachingSubmissions();
  const { data: agents, isLoading: agentsLoading } = useAgentsList();
  
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();

  // Calculate insights
  const insights = useMemo(() => {
    if (!submissions || !agents) return null;

    const currentWeekSubmissions = submissions.filter(
      s => s.week_number === currentWeekNumber && s.year === currentYear
    );
    const lastWeekSubmissions = submissions.filter(
      s => s.week_number === currentWeekNumber - 1 && s.year === currentYear
    );

    // Agents who haven't submitted this week
    const submittedAgentIds = new Set(currentWeekSubmissions.map(s => s.agent_id));
    const missingSubmissions = agents.filter(a => !submittedAgentIds.has(a.id));

    // YTD aggregates per agent
    const ytdAggregates = new Map<string, { 
      name: string; 
      closings: number; 
      amount: number; 
      attempts: number;
      appointments: number;
    }>();
    
    submissions
      .filter(s => s.year === currentYear)
      .forEach(s => {
        const existing = ytdAggregates.get(s.agent_id) || { 
          name: s.agent_name, 
          closings: 0, 
          amount: 0, 
          attempts: 0,
          appointments: 0
        };
        ytdAggregates.set(s.agent_id, {
          name: s.agent_name,
          closings: existing.closings + (s.closings || 0),
          amount: existing.amount + (s.closing_amount || 0),
          attempts: existing.attempts + (s.dials_made || 0),
          appointments: existing.appointments + (s.appointments_set || 0),
        });
      });

    const ytdList = Array.from(ytdAggregates.entries()).map(([id, data]) => ({ id, ...data }));

    // Top performers
    const topByClosings = [...ytdList].sort((a, b) => b.closings - a.closings).slice(0, 5);
    const topByAmount = [...ytdList].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const topByAttempts = [...ytdList].sort((a, b) => b.attempts - a.attempts).slice(0, 5);

    // Declining metrics - compare current week to previous week
    const decliningAgents: { name: string; metric: string; change: number }[] = [];
    
    currentWeekSubmissions.forEach(current => {
      const previous = lastWeekSubmissions.find(p => p.agent_id === current.agent_id);
      if (previous) {
        const currentAttempts = current.dials_made || 0;
        const previousAttempts = previous.dials_made || 0;
        if (previousAttempts > 0 && currentAttempts < previousAttempts * 0.6) {
          const changePercent = Math.round(((currentAttempts - previousAttempts) / previousAttempts) * 100);
          decliningAgents.push({
            name: current.agent_name,
            metric: 'attempts',
            change: changePercent,
          });
        }
      }
    });

    // Team trends - last 8 weeks
    const last8Weeks = [];
    for (let i = 7; i >= 0; i--) {
      let week = currentWeekNumber - i;
      let year = currentYear;
      if (week <= 0) {
        week = 52 + week;
        year = currentYear - 1;
      }
      
      const weekSubmissions = submissions.filter(s => s.week_number === week && s.year === year);
      const totalAttempts = weekSubmissions.reduce((sum, s) => sum + (s.dials_made || 0), 0);
      const totalClosings = weekSubmissions.reduce((sum, s) => sum + (s.closings || 0), 0);
      const totalAmount = weekSubmissions.reduce((sum, s) => sum + (s.closing_amount || 0), 0);
      
      last8Weeks.push({
        week: `W${week}`,
        attempts: totalAttempts,
        closings: totalClosings,
        amount: totalAmount,
        submissions: weekSubmissions.length,
      });
    }

    return {
      missingSubmissions,
      topByClosings,
      topByAmount,
      topByAttempts,
      decliningAgents,
      trends: last8Weeks,
    };
  }, [submissions, agents, currentWeekNumber, currentYear]);

  const chartConfig = {
    attempts: { label: "Total Attempts", color: "hsl(var(--chart-1))" },
    closings: { label: "Total Closings", color: "hsl(var(--chart-2))" },
    amount: { label: "$ Closed", color: "hsl(var(--chart-3))" },
  };

  if (submissionsLoading || agentsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  return (
    <div className="space-y-6">
      {/* Top Row - Top Performers & Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top Performers (YTD)
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Most Closings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.topByClosings.map((agent, idx) => (
                    <div key={agent.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <span>{medals[idx]}</span>
                        <span className="font-medium">{agent.name}</span>
                      </div>
                      <Badge variant="secondary">{agent.closings} closings</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Highest $ Closed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.topByAmount.map((agent, idx) => (
                    <div key={agent.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <span>{medals[idx]}</span>
                        <span className="font-medium">{agent.name}</span>
                      </div>
                      <Badge variant="secondary">${agent.amount.toLocaleString()}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Needs Attention */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Needs Attention
          </h3>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-red-500" />
                Missing Submissions (Week {currentWeekNumber})
              </CardTitle>
              <CardDescription>
                {insights.missingSubmissions.length} agent(s) haven't submitted yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.missingSubmissions.length === 0 ? (
                <p className="text-sm text-green-600 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  All agents have submitted this week!
                </p>
              ) : (
                <div className="space-y-2">
                  {insights.missingSubmissions.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                      <Badge variant="destructive" className="text-xs">Missing</Badge>
                      <span className="font-medium">{agent.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                Declining Metrics
              </CardTitle>
              <CardDescription>
                Agents with significant week-over-week drops
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.decliningAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No significant declines detected this week
                </p>
              ) : (
                <div className="space-y-2">
                  {insights.decliningAgents.map((agent, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="font-medium">{agent.name}</span>
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        {agent.change}% {agent.metric}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Team Trends Charts */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          Team Trends (Last 8 Weeks)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights.trends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="attempts" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-1))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total Closings</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights.trends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="closings" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-2))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CoachingInsights;

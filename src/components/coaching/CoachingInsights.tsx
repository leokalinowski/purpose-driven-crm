import React, { useMemo } from 'react';
import { Trophy, AlertTriangle, TrendingDown, TrendingUp, Users, MessageCircle, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useAllCoachingSubmissions, useAgentsList } from '@/hooks/useAdminCoachingData';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

const CONVERSATION_TARGET = 25;

interface CoachingInsightsProps {
  selectedWeek?: string;
}

const CoachingInsights = ({ selectedWeek = 'all' }: CoachingInsightsProps) => {
  const { data: submissions, isLoading: submissionsLoading } = useAllCoachingSubmissions();
  const { data: agents, isLoading: agentsLoading } = useAgentsList();
  
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();
  
  const filterWeek = useMemo(() => {
    if (selectedWeek === 'all') return null;
    const [weekNum, year] = selectedWeek.split('-').map(Number);
    return { week: weekNum, year };
  }, [selectedWeek]);

  const insights = useMemo(() => {
    if (!submissions || !agents) return null;

    const targetWeek = filterWeek?.week || currentWeekNumber;
    const targetYear = filterWeek?.year || currentYear;
    
    const targetWeekSubmissions = submissions.filter(
      s => s.week_number === targetWeek && s.year === targetYear
    );
    const previousWeekSubmissions = submissions.filter(
      s => s.week_number === targetWeek - 1 && s.year === targetYear
    );

    const submittedAgentIds = new Set(targetWeekSubmissions.map(s => s.agent_id));
    const missingSubmissions = agents.filter(a => !submittedAgentIds.has(a.id));

    // YTD aggregates per agent — conversations-focused
    const ytdAggregates = new Map<string, { 
      name: string; conversations: number; attempts: number; appointments: number;
    }>();
    
    submissions
      .filter(s => s.year === currentYear)
      .forEach(s => {
        const existing = ytdAggregates.get(s.agent_id) || { 
          name: s.agent_name, conversations: 0, attempts: 0, appointments: 0
        };
        ytdAggregates.set(s.agent_id, {
          name: s.agent_name,
          conversations: existing.conversations + (s.conversations || 0),
          attempts: existing.attempts + (s.dials_made || 0),
          appointments: existing.appointments + (s.appointments_set || 0),
        });
      });

    const ytdList = Array.from(ytdAggregates.entries()).map(([id, data]) => ({ id, ...data }));

    const topByConversations = [...ytdList].sort((a, b) => b.conversations - a.conversations).slice(0, 5);
    const topByAttempts = [...ytdList].sort((a, b) => b.attempts - a.attempts).slice(0, 5);

    // Agents below target this week
    const belowTarget = targetWeekSubmissions
      .filter(s => (s.conversations || 0) < CONVERSATION_TARGET)
      .map(s => ({
        name: s.agent_name,
        conversations: s.conversations || 0,
        gap: CONVERSATION_TARGET - (s.conversations || 0),
      }))
      .sort((a, b) => a.conversations - b.conversations);

    // Team trends - last 8 weeks
    const last8Weeks = [];
    for (let i = 7; i >= 0; i--) {
      let week = currentWeekNumber - i;
      let year = currentYear;
      if (week <= 0) { week = 52 + week; year = currentYear - 1; }
      
      const weekSubmissions = submissions.filter(s => s.week_number === week && s.year === year);
      const totalConversations = weekSubmissions.reduce((sum, s) => sum + (s.conversations || 0), 0);
      const totalAttempts = weekSubmissions.reduce((sum, s) => sum + (s.dials_made || 0), 0);
      const avgConversations = weekSubmissions.length > 0 ? Math.round(totalConversations / weekSubmissions.length) : 0;
      
      last8Weeks.push({
        week: `W${week}`,
        conversations: totalConversations,
        avgConversations,
        attempts: totalAttempts,
        submissions: weekSubmissions.length,
      });
    }

    return {
      missingSubmissions,
      missingWeekLabel: filterWeek ? `Week ${filterWeek.week}` : `Week ${currentWeekNumber}`,
      topByConversations,
      topByAttempts,
      belowTarget,
      trends: last8Weeks,
    };
  }, [submissions, agents, currentWeekNumber, currentYear, filterWeek]);

  const chartConfig = {
    conversations: { label: "Total Conversations", color: "hsl(var(--chart-1))" },
    avgConversations: { label: "Avg Conversations", color: "hsl(var(--chart-2))" },
    attempts: { label: "Total Attempts", color: "hsl(var(--chart-3))" },
  };

  if (submissionsLoading || agentsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top Performers (YTD)
          </h3>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                Most Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {insights.topByConversations.map((agent, idx) => (
                  <div key={agent.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <span>{medals[idx]}</span>
                      <span className="font-medium">{agent.name}</span>
                    </div>
                    <Badge variant="secondary">{agent.conversations} conversations</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                Most Activation Attempts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {insights.topByAttempts.map((agent, idx) => (
                  <div key={agent.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <span>{medals[idx]}</span>
                      <span className="font-medium">{agent.name}</span>
                    </div>
                    <Badge variant="secondary">{agent.attempts} attempts</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
                <Users className="h-4 w-4 text-destructive" />
                Missing Check-Ins ({insights.missingWeekLabel})
              </CardTitle>
              <CardDescription>
                {insights.missingSubmissions.length} agent(s) haven't checked in yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.missingSubmissions.length === 0 ? (
                <p className="text-sm text-primary flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  All agents have checked in this week!
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
                <TrendingDown className="h-4 w-4 text-amber-500" />
                Below {CONVERSATION_TARGET} Conversations ({insights.missingWeekLabel})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insights.belowTarget.length === 0 ? (
                <p className="text-sm text-muted-foreground">Everyone hit their target this week!</p>
              ) : (
                <div className="space-y-2">
                  {insights.belowTarget.map((agent, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="font-medium">{agent.name}</span>
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        {agent.conversations}/{CONVERSATION_TARGET} ({agent.gap} short)
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Team Trends */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Team Trends (Last 8 Weeks)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total Team Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights.trends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="conversations" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-1))" }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avg Conversations per Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights.trends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="avgConversations" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-2))" }} />
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

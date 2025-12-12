import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, Calendar, MessageSquare, Target, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAllCoachingSubmissions, useAgentsList, type CoachingSubmissionWithAgent } from '@/hooks/useAdminCoachingData';
import { format } from 'date-fns';

interface AgentCoachingDeepDiveProps {
  selectedWeek?: string;
}

const AgentCoachingDeepDive = ({ selectedWeek = 'all' }: AgentCoachingDeepDiveProps) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  const { data: submissions, isLoading: submissionsLoading } = useAllCoachingSubmissions();
  const { data: agents, isLoading: agentsLoading } = useAgentsList();

  // Get selected agent's submissions (filtered by week if specified)
  const agentSubmissions = useMemo(() => {
    if (!submissions || !selectedAgent) return [];
    let filtered = submissions.filter(s => s.agent_id === selectedAgent);
    
    // Apply week filter
    if (selectedWeek !== 'all') {
      const [weekNum, year] = selectedWeek.split('-').map(Number);
      filtered = filtered.filter(s => s.week_number === weekNum && s.year === year);
    }
    
    return filtered.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.week_number - a.week_number;
    });
  }, [submissions, selectedAgent, selectedWeek]);

  // Calculate agent metrics
  const agentMetrics = useMemo(() => {
    if (agentSubmissions.length === 0) return null;

    const currentYear = new Date().getFullYear();
    const ytdSubmissions = agentSubmissions.filter(s => s.year === currentYear);

    const totalClosings = ytdSubmissions.reduce((sum, s) => sum + (s.closings || 0), 0);
    const totalAmount = ytdSubmissions.reduce((sum, s) => sum + (s.closing_amount || 0), 0);
    const totalAttempts = ytdSubmissions.reduce((sum, s) => sum + (s.dials_made || 0), 0);
    const totalAppointments = ytdSubmissions.reduce((sum, s) => sum + (s.appointments_set || 0), 0);

    // Weekly averages
    const avgClosings = ytdSubmissions.length > 0 
      ? (totalClosings / ytdSubmissions.length).toFixed(1) 
      : '0';
    const avgAttempts = ytdSubmissions.length > 0 
      ? Math.round(totalAttempts / ytdSubmissions.length) 
      : 0;

    // Trend data for charts (last 12 weeks)
    const last12 = agentSubmissions.slice(0, 12).reverse();

    return {
      totalClosings,
      totalAmount,
      totalAttempts,
      totalAppointments,
      avgClosings,
      avgAttempts,
      submissionCount: ytdSubmissions.length,
      trendData: last12.map(s => ({
        week: `W${s.week_number}`,
        attempts: s.dials_made || 0,
        leads: s.leads_contacted || 0,
        appointments: s.appointments_set || 0,
        closings: s.closings || 0,
        amount: s.closing_amount || 0,
      })),
    };
  }, [agentSubmissions]);

  const chartConfig = {
    attempts: { label: "Attempts", color: "hsl(var(--chart-1))" },
    leads: { label: "Leads", color: "hsl(var(--chart-2))" },
    appointments: { label: "Appointments", color: "hsl(var(--chart-3))" },
    closings: { label: "Closings", color: "hsl(var(--chart-4))" },
    amount: { label: "$ Closed", color: "hsl(var(--chart-5))" },
  };

  if (submissionsLoading || agentsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select an agent to view details" />
              </SelectTrigger>
              <SelectContent>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAgent && (
              <Badge variant="secondary">
                Viewing: {agents?.find(a => a.id === selectedAgent)?.name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedAgent ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Select an Agent</h3>
            <p className="text-muted-foreground">
              Choose an agent from the dropdown above to view their detailed coaching history and performance metrics.
            </p>
          </CardContent>
        </Card>
      ) : agentMetrics ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-muted-foreground text-sm mb-1">YTD Closings</div>
                <div className="text-2xl font-bold">{agentMetrics.totalClosings}</div>
                <p className="text-xs text-muted-foreground">
                  Avg {agentMetrics.avgClosings}/week
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-muted-foreground text-sm mb-1">YTD $ Closed</div>
                <div className="text-2xl font-bold">
                  ${agentMetrics.totalAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-muted-foreground text-sm mb-1">YTD Attempts</div>
                <div className="text-2xl font-bold">{agentMetrics.totalAttempts}</div>
                <p className="text-xs text-muted-foreground">
                  Avg {agentMetrics.avgAttempts}/week
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-muted-foreground text-sm mb-1">Submissions</div>
                <div className="text-2xl font-bold">{agentMetrics.submissionCount}</div>
                <p className="text-xs text-muted-foreground">This year</p>
              </CardContent>
            </Card>
          </div>

          {/* Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity Trend (Last 12 Weeks)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={agentMetrics.trendData}>
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
                      <Line 
                        type="monotone" 
                        dataKey="appointments" 
                        stroke="hsl(var(--chart-3))" 
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--chart-3))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Closings Trend (Last 12 Weeks)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentMetrics.trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar 
                        dataKey="closings" 
                        fill="hsl(var(--chart-4))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Full History Table */}
          <Card>
            <CardHeader>
              <CardTitle>Submission History</CardTitle>
              <CardDescription>
                All coaching submissions with notes and metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Appts Set</TableHead>
                      <TableHead>Closings</TableHead>
                      <TableHead>$ Closed</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentSubmissions.map((submission) => {
                      const hasNotes = submission.challenges || submission.tasks || submission.coaching_notes || submission.must_do_task;
                      const isExpanded = expandedSubmission === submission.id;

                      return (
                        <React.Fragment key={submission.id}>
                          <TableRow 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => hasNotes && setExpandedSubmission(isExpanded ? null : submission.id)}
                          >
                            <TableCell className="font-medium">
                              W{submission.week_number} / {submission.year}
                            </TableCell>
                            <TableCell>{submission.dials_made || 0}</TableCell>
                            <TableCell>{submission.leads_contacted || 0}</TableCell>
                            <TableCell>{submission.appointments_set || 0}</TableCell>
                            <TableCell>{submission.closings || 0}</TableCell>
                            <TableCell>${(submission.closing_amount || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              {hasNotes ? (
                                <Button variant="ghost" size="sm">
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                          {isExpanded && hasNotes && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/30 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {submission.challenges && (
                                    <div className="bg-background border rounded-md p-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <AlertCircle className="h-4 w-4 text-amber-500" />
                                        <p className="text-sm font-medium">Challenges Faced</p>
                                      </div>
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {submission.challenges}
                                      </p>
                                    </div>
                                  )}
                                  {submission.tasks && (
                                    <div className="bg-background border rounded-md p-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Target className="h-4 w-4 text-blue-500" />
                                        <p className="text-sm font-medium">Tasks for Next Week</p>
                                      </div>
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {submission.tasks}
                                      </p>
                                    </div>
                                  )}
                                  {submission.coaching_notes && (
                                    <div className="bg-background border rounded-md p-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <MessageSquare className="h-4 w-4 text-green-500" />
                                        <p className="text-sm font-medium">Notes for Coaching</p>
                                      </div>
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {submission.coaching_notes}
                                      </p>
                                    </div>
                                  )}
                                  {submission.must_do_task && (
                                    <div className="bg-background border rounded-md p-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Target className="h-4 w-4 text-red-500" />
                                        <p className="text-sm font-medium">One Thing You MUST Do</p>
                                      </div>
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {submission.must_do_task}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Submissions Yet</h3>
            <p className="text-muted-foreground">
              This agent hasn't submitted any coaching scorecards yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AgentCoachingDeepDive;

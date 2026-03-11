import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, Calendar, MessageCircle, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAllCoachingSubmissions, useAgentsList, type CoachingSubmissionWithAgent } from '@/hooks/useAdminCoachingData';

const CONVERSATION_TARGET = 25;

interface AgentCoachingDeepDiveProps {
  selectedWeek?: string;
}

const AgentCoachingDeepDive = ({ selectedWeek = 'all' }: AgentCoachingDeepDiveProps) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  const { data: submissions, isLoading: submissionsLoading } = useAllCoachingSubmissions();
  const { data: agents, isLoading: agentsLoading } = useAgentsList();

  const agentSubmissions = useMemo(() => {
    if (!submissions || !selectedAgent) return [];
    let filtered = submissions.filter(s => s.agent_id === selectedAgent);
    
    if (selectedWeek !== 'all') {
      const [weekNum, year] = selectedWeek.split('-').map(Number);
      filtered = filtered.filter(s => s.week_number === weekNum && s.year === year);
    }
    
    return filtered.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.week_number - a.week_number;
    });
  }, [submissions, selectedAgent, selectedWeek]);

  const agentMetrics = useMemo(() => {
    if (agentSubmissions.length === 0) return null;

    const currentYear = new Date().getFullYear();
    const ytdSubmissions = agentSubmissions.filter(s => s.year === currentYear);

    const totalConversations = ytdSubmissions.reduce((sum, s) => sum + (s.conversations || 0), 0);
    const totalAttempts = ytdSubmissions.reduce((sum, s) => sum + (s.dials_made || 0), 0);
    const totalAppointments = ytdSubmissions.reduce((sum, s) => sum + (s.appointments_set || 0), 0);
    const totalClosings = ytdSubmissions.reduce((sum, s) => sum + (s.closings || 0), 0);

    const avgConversations = ytdSubmissions.length > 0 
      ? Math.round(totalConversations / ytdSubmissions.length) : 0;

    const last12 = agentSubmissions.slice(0, 12).reverse();

    return {
      totalConversations,
      totalAttempts,
      totalAppointments,
      totalClosings,
      avgConversations,
      submissionCount: ytdSubmissions.length,
      trendData: last12.map(s => ({
        week: `W${s.week_number}`,
        conversations: s.conversations || 0,
        attempts: s.dials_made || 0,
        appointments: s.appointments_set || 0,
      })),
    };
  }, [agentSubmissions]);

  const chartConfig = {
    conversations: { label: "Conversations", color: "hsl(var(--chart-1))" },
    attempts: { label: "Attempts", color: "hsl(var(--chart-2))" },
    appointments: { label: "Appointments", color: "hsl(var(--chart-3))" },
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
          </div>
        </CardContent>
      </Card>

      {!selectedAgent ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Select an Agent</h3>
            <p className="text-muted-foreground">
              Choose an agent to view their weekly check-in history and performance.
            </p>
          </CardContent>
        </Card>
      ) : agentMetrics ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-muted-foreground text-sm mb-1">YTD Conversations</div>
                <div className="text-2xl font-bold">{agentMetrics.totalConversations}</div>
                <p className="text-xs text-muted-foreground">
                  Avg {agentMetrics.avgConversations}/{CONVERSATION_TARGET} per week
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-muted-foreground text-sm mb-1">YTD Attempts</div>
                <div className="text-2xl font-bold">{agentMetrics.totalAttempts}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-muted-foreground text-sm mb-1">YTD Appointments</div>
                <div className="text-2xl font-bold">{agentMetrics.totalAppointments}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-muted-foreground text-sm mb-1">Check-Ins</div>
                <div className="text-2xl font-bold">{agentMetrics.submissionCount}</div>
                <p className="text-xs text-muted-foreground">This year</p>
              </CardContent>
            </Card>
          </div>

          {/* Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversations Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentMetrics.trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="conversations" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={agentMetrics.trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="attempts" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-2))" }} />
                      <Line type="monotone" dataKey="appointments" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-3))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* History Table */}
          <Card>
            <CardHeader>
              <CardTitle>Check-In History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead>Convos</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Appts</TableHead>
                      <TableHead>Contacts Added</TableHead>
                      <TableHead>Contacts Removed</TableHead>
                      <TableHead>Activation Day</TableHead>
                      <TableHead>Closings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentSubmissions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">W{s.week_number} / {s.year}</TableCell>
                        <TableCell>
                          <span className={(s.conversations || 0) >= CONVERSATION_TARGET ? 'text-primary font-bold' : ''}>
                            {s.conversations || 0}
                          </span>
                        </TableCell>
                        <TableCell>{s.dials_made || 0}</TableCell>
                        <TableCell>{s.appointments_set || 0}</TableCell>
                        <TableCell>{s.leads_contacted || 0}</TableCell>
                        <TableCell>{s.deals_closed || 0}</TableCell>
                        <TableCell>
                          <Badge variant={(s.agreements_signed || 0) >= 1 ? "default" : "secondary"}>
                            {(s.agreements_signed || 0) >= 1 ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.closings || 0}</TableCell>
                      </TableRow>
                    ))}
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
            <h3 className="text-lg font-medium mb-2">No Check-Ins Yet</h3>
            <p className="text-muted-foreground">
              This agent hasn't submitted any weekly check-ins yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AgentCoachingDeepDive;

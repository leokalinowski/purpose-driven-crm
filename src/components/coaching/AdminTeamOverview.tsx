import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, Trophy, ChevronDown, ChevronUp, MessageCircle, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAllCoachingSubmissions, useAgentsList, type CoachingSubmissionWithAgent } from '@/hooks/useAdminCoachingData';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

const CONVERSATION_TARGET = 25;

type SortField = 'agent_name' | 'week_number' | 'conversations' | 'dials_made' | 'appointments_set' | 'leads_contacted' | 'closings';
type SortDirection = 'asc' | 'desc';

interface AdminTeamOverviewProps {
  selectedWeek?: string;
}

const AdminTeamOverview = ({ selectedWeek = 'all' }: AdminTeamOverviewProps) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('week_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [activeSubTab, setActiveSubTab] = useState('comparison');

  const { data: submissions, isLoading: submissionsLoading } = useAllCoachingSubmissions();
  const { data: agents, isLoading: agentsLoading } = useAgentsList();

  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();

  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    let filtered = submissions;
    
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(s => s.agent_id === selectedAgent);
    }
    
    if (selectedWeek !== 'all') {
      const [weekNum, year] = selectedWeek.split('-').map(Number);
      filtered = filtered.filter(s => s.week_number === weekNum && s.year === year);
    }
    
    return filtered;
  }, [submissions, selectedAgent, selectedWeek]);

  const sortedSubmissions = useMemo(() => {
    return [...filteredSubmissions].sort((a, b) => {
      let aVal: any = sortField === 'conversations' ? (a.conversations || 0) : a[sortField];
      let bVal: any = sortField === 'conversations' ? (b.conversations || 0) : b[sortField];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSubmissions, sortField, sortDirection]);

  const leaderboardSubmissions = useMemo(() => {
    if (!submissions) return [];
    if (selectedWeek !== 'all') {
      const [weekNum, year] = selectedWeek.split('-').map(Number);
      return submissions.filter(s => s.week_number === weekNum && s.year === year);
    }
    return submissions.filter(s => s.week_number === currentWeekNumber && s.year === currentYear);
  }, [submissions, selectedWeek, currentWeekNumber, currentYear]);

  const leaderboardData = useMemo(() => {
    const sortedByConversations = [...leaderboardSubmissions].sort((a, b) => (b.conversations || 0) - (a.conversations || 0));
    const sortedByAttempts = [...leaderboardSubmissions].sort((a, b) => (b.dials_made || 0) - (a.dials_made || 0));
    const sortedByAppointments = [...leaderboardSubmissions].sort((a, b) => (b.appointments_set || 0) - (a.appointments_set || 0));
    const sortedByClosings = [...leaderboardSubmissions].sort((a, b) => (b.closings || 0) - (a.closings || 0));

    return {
      conversations: sortedByConversations.slice(0, 5),
      attempts: sortedByAttempts.slice(0, 5),
      appointments: sortedByAppointments.slice(0, 5),
      closings: sortedByClosings.slice(0, 5),
    };
  }, [leaderboardSubmissions]);
  
  const leaderboardWeekLabel = useMemo(() => {
    if (selectedWeek !== 'all') {
      const [weekNum, year] = selectedWeek.split('-').map(Number);
      return `Week ${weekNum}, ${year}`;
    }
    return `Week ${currentWeekNumber}`;
  }, [selectedWeek, currentWeekNumber]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  );

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
      <div className="flex items-center gap-4">
        <Users className="h-5 w-5 text-muted-foreground" />
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents?.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Team Comparison
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Weekly Check-Ins</CardTitle>
              <CardDescription>
                Click headers to sort. Conversations target: {CONVERSATION_TARGET}/week.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedSubmissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No check-ins found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader field="agent_name">Agent</SortableHeader>
                        <SortableHeader field="week_number">Week</SortableHeader>
                        <SortableHeader field="conversations">Convos</SortableHeader>
                        <SortableHeader field="dials_made">Attempts</SortableHeader>
                        <SortableHeader field="appointments_set">Appts</SortableHeader>
                        <SortableHeader field="leads_contacted">Contacts Added</SortableHeader>
                        <TableHead>Removed</TableHead>
                        <SortableHeader field="closings">Closings</SortableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSubmissions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.agent_name}</TableCell>
                          <TableCell>W{s.week_number} / {s.year}</TableCell>
                          <TableCell>
                            <span className={(s.conversations || 0) >= CONVERSATION_TARGET ? 'text-primary font-bold' : ''}>
                              {s.conversations || 0}
                            </span>
                          </TableCell>
                          <TableCell>{s.dials_made || 0}</TableCell>
                          <TableCell>{s.appointments_set || 0}</TableCell>
                          <TableCell>{s.leads_contacted || 0}</TableCell>
                          <TableCell>{s.closings || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LeaderboardCard
              title="Most Conversations"
              subtitle={leaderboardWeekLabel}
              data={leaderboardData.conversations}
              metric="conversations"
              formatValue={(v) => `${v}/${CONVERSATION_TARGET}`}
            />
            <LeaderboardCard
              title="Most Activation Attempts"
              subtitle={leaderboardWeekLabel}
              data={leaderboardData.attempts}
              metric="dials_made"
              formatValue={(v) => v.toString()}
            />
            <LeaderboardCard
              title="Most Appointments Set"
              subtitle={leaderboardWeekLabel}
              data={leaderboardData.appointments}
              metric="appointments_set"
              formatValue={(v) => v.toString()}
            />
            <LeaderboardCard
              title="Top Closings"
              subtitle={leaderboardWeekLabel}
              data={leaderboardData.closings}
              metric="closings"
              formatValue={(v) => v.toString()}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const LeaderboardCard = ({ 
  title, subtitle, data, metric, formatValue 
}: { 
  title: string; subtitle: string; data: CoachingSubmissionWithAgent[];
  metric: keyof CoachingSubmissionWithAgent; formatValue: (value: number) => string;
}) => {
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="outline">{subtitle}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No data available</p>
        ) : (
          <div className="space-y-2">
            {data.map((submission, index) => (
              <div key={submission.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{medals[index]}</span>
                  <span className="font-medium">{submission.agent_name}</span>
                </div>
                <span className="font-bold text-primary">
                  {formatValue((submission[metric] as number) || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminTeamOverview;

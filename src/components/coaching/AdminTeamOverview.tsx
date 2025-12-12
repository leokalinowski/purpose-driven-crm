import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, Trophy, ChevronDown, ChevronUp, MessageSquare, Target, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

type SortField = 'agent_name' | 'week_number' | 'dials_made' | 'leads_contacted' | 'appointments_set' | 'closings' | 'closing_amount';
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

  // Filter submissions by selected agent and week
  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    let filtered = submissions;
    
    // Filter by agent
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(s => s.agent_id === selectedAgent);
    }
    
    // Filter by week
    if (selectedWeek !== 'all') {
      const [weekNum, year] = selectedWeek.split('-').map(Number);
      filtered = filtered.filter(s => s.week_number === weekNum && s.year === year);
    }
    
    return filtered;
  }, [submissions, selectedAgent, selectedWeek]);

  // Sort submissions
  const sortedSubmissions = useMemo(() => {
    return [...filteredSubmissions].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSubmissions, sortField, sortDirection]);

  // Current week submissions for leaderboard (or filtered week)
  const leaderboardSubmissions = useMemo(() => {
    if (!submissions) return [];
    if (selectedWeek !== 'all') {
      const [weekNum, year] = selectedWeek.split('-').map(Number);
      return submissions.filter(s => s.week_number === weekNum && s.year === year);
    }
    return submissions.filter(s => s.week_number === currentWeekNumber && s.year === currentYear);
  }, [submissions, selectedWeek, currentWeekNumber, currentYear]);

  // Generate leaderboard data
  const leaderboardData = useMemo(() => {
    const sortedByClosings = [...leaderboardSubmissions].sort((a, b) => (b.closings || 0) - (a.closings || 0));
    const sortedByAmount = [...leaderboardSubmissions].sort((a, b) => (b.closing_amount || 0) - (a.closing_amount || 0));
    const sortedByAttempts = [...leaderboardSubmissions].sort((a, b) => (b.dials_made || 0) - (a.dials_made || 0));
    const sortedByAppointments = [...leaderboardSubmissions].sort((a, b) => (b.appointments_set || 0) - (a.appointments_set || 0));

    return {
      closings: sortedByClosings.slice(0, 5),
      amount: sortedByAmount.slice(0, 5),
      attempts: sortedByAttempts.slice(0, 5),
      appointments: sortedByAppointments.slice(0, 5),
    };
  }, [leaderboardSubmissions]);
  
  // Get the week label for leaderboard subtitle
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
      {/* Agent Selector */}
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
        {selectedAgent !== 'all' && (
          <Badge variant="secondary">
            Viewing: {agents?.find(a => a.id === selectedAgent)?.name}
          </Badge>
        )}
      </div>

      {/* Sub-tabs */}
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

        {/* Team Comparison Table */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Metrics Comparison</CardTitle>
              <CardDescription>
                {selectedAgent === 'all' 
                  ? 'View and compare all agent submissions. Click headers to sort.' 
                  : `Viewing submissions for ${agents?.find(a => a.id === selectedAgent)?.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedSubmissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No submissions found for the selected criteria.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader field="agent_name">Agent</SortableHeader>
                        <SortableHeader field="week_number">Week</SortableHeader>
                        <SortableHeader field="dials_made">Attempts</SortableHeader>
                        <SortableHeader field="leads_contacted">Leads</SortableHeader>
                        <SortableHeader field="appointments_set">Appts Set</SortableHeader>
                        <SortableHeader field="closings">Closings</SortableHeader>
                        <SortableHeader field="closing_amount">$ Closed</SortableHeader>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSubmissions.map((submission) => (
                        <SubmissionRow key={submission.id} submission={submission} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaderboard */}
        <TabsContent value="leaderboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LeaderboardCard
              title="Top Closings"
              subtitle={leaderboardWeekLabel}
              data={leaderboardData.closings}
              metric="closings"
              formatValue={(v) => v.toString()}
            />
            <LeaderboardCard
              title="Top $ Closed"
              subtitle={leaderboardWeekLabel}
              data={leaderboardData.amount}
              metric="closing_amount"
              formatValue={(v) => `$${v.toLocaleString()}`}
            />
            <LeaderboardCard
              title="Most Attempts"
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Submission Row with expandable notes
const SubmissionRow = ({ submission }: { submission: CoachingSubmissionWithAgent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasNotes = submission.challenges || submission.tasks || submission.coaching_notes || submission.must_do_task;

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => hasNotes && setIsOpen(!isOpen)}>
        <TableCell className="font-medium">{submission.agent_name}</TableCell>
        <TableCell>W{submission.week_number} / {submission.year}</TableCell>
        <TableCell>{submission.dials_made || 0}</TableCell>
        <TableCell>{submission.leads_contacted || 0}</TableCell>
        <TableCell>{submission.appointments_set || 0}</TableCell>
        <TableCell>{submission.closings || 0}</TableCell>
        <TableCell>${(submission.closing_amount || 0).toLocaleString()}</TableCell>
        <TableCell>
          {hasNotes ? (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
              <MessageSquare className="h-4 w-4 mr-1" />
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </TableCell>
      </TableRow>
      {isOpen && hasNotes && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {submission.challenges && (
                <NoteCard 
                  title="Challenges Faced" 
                  content={submission.challenges} 
                  icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
                />
              )}
              {submission.tasks && (
                <NoteCard 
                  title="Tasks for Next Week" 
                  content={submission.tasks}
                  icon={<Target className="h-4 w-4 text-blue-500" />}
                />
              )}
              {submission.coaching_notes && (
                <NoteCard 
                  title="Notes for Coaching" 
                  content={submission.coaching_notes}
                  icon={<MessageSquare className="h-4 w-4 text-green-500" />}
                />
              )}
              {submission.must_do_task && (
                <NoteCard 
                  title="One Thing You MUST Do" 
                  content={submission.must_do_task}
                  icon={<Target className="h-4 w-4 text-red-500" />}
                />
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

const NoteCard = ({ title, content, icon }: { title: string; content: string; icon: React.ReactNode }) => (
  <div className="bg-background border rounded-md p-3">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <p className="text-sm font-medium">{title}</p>
    </div>
    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{content}</p>
  </div>
);

// Leaderboard Card
const LeaderboardCard = ({ 
  title, 
  subtitle, 
  data, 
  metric, 
  formatValue 
}: { 
  title: string; 
  subtitle: string; 
  data: CoachingSubmissionWithAgent[];
  metric: keyof CoachingSubmissionWithAgent;
  formatValue: (value: number) => string;
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

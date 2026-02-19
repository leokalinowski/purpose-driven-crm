import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Users, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
import { format, isPast } from 'date-fns';

interface ClickUpTaskRow {
  id: string;
  event_id: string;
  clickup_task_id: string;
  task_name: string;
  status: string | null;
  due_date: string | null;
  responsible_person: string | null;
  completed_at: string | null;
  agent_id: string | null;
  phase: string | null;
}

interface Agent {
  user_id: string;
  name: string;
}

interface AdminEventTasksProps {
  events: Array<{ id: string; title: string; agent_id: string }>;
  agents: Agent[];
}

const PHASE_LABELS: Record<string, string> = {
  pre_event: 'Pre-Event',
  event_day: 'Event Day',
  post_event: 'Post-Event',
};

export function AdminEventTasks({ events, agents }: AdminEventTasksProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ClickUpTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<any>(null);
  const [eventFilter, setEventFilter] = useState<string>('all');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clickup_tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks((data || []) as ClickUpTaskRow[]);
    } catch (err: any) {
      console.error('Error fetching clickup tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleLinkEvents = async () => {
    try {
      setLinking(true);
      setLinkResult(null);
      const { data, error } = await supabase.functions.invoke('clickup-link-events');
      if (error) throw error;
      setLinkResult(data);
      toast({
        title: 'Link Complete',
        description: data?.message || 'Events linked to ClickUp folders',
      });
    } catch (err: any) {
      toast({ title: 'Link Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const { data, error } = await supabase.functions.invoke('clickup-sync-event-tasks');
      if (error) throw error;
      toast({ title: 'Sync Complete', description: data?.message || 'Tasks synced successfully' });
      fetchTasks();
    } catch (err: any) {
      toast({ title: 'Sync Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleAssignAgent = async (taskId: string, agentId: string | null) => {
    try {
      const { error } = await supabase
        .from('clickup_tasks')
        .update({ agent_id: agentId === 'unassigned' ? null : agentId })
        .eq('id', taskId);

      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, agent_id: agentId === 'unassigned' ? null : agentId } : t));
      toast({ title: 'Agent assigned' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filteredTasks = eventFilter === 'all' ? tasks : tasks.filter(t => t.event_id === eventFilter);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.completed_at).length;
  const overdueTasks = filteredTasks.filter(t => !t.completed_at && t.due_date && new Date(t.due_date) < today).length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return 'Unassigned';
    return agents.find(a => a.user_id === agentId)?.name || 'Unknown';
  };

  const getEventTitle = (eventId: string) => {
    return events.find(e => e.id === eventId)?.title || 'Unknown Event';
  };

  return (
    <div className="space-y-4">
      {/* Actions Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filter by event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleLinkEvents} disabled={linking} variant="outline">
            <Link2 className={`h-4 w-4 mr-2 ${linking ? 'animate-spin' : ''}`} />
            {linking ? 'Linking...' : 'Link Events to ClickUp'}
          </Button>
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Tasks'}
          </Button>
        </div>
      </div>

      {/* Link Results */}
      {linkResult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Link Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {linkResult.linked?.length > 0 && (
              <div>
                <p className="font-medium text-green-600">✓ Linked ({linkResult.linked.length}):</p>
                {linkResult.linked.map((l: any, i: number) => (
                  <p key={i} className="ml-4 text-muted-foreground">{l.folder} → {l.event}</p>
                ))}
              </div>
            )}
            {linkResult.alreadyLinked?.length > 0 && (
              <div>
                <p className="font-medium text-blue-600">Already Linked ({linkResult.alreadyLinked.length}):</p>
                {linkResult.alreadyLinked.map((l: any, i: number) => (
                  <p key={i} className="ml-4 text-muted-foreground">{l.folder} → {l.event}</p>
                ))}
              </div>
            )}
            {linkResult.unmatched?.length > 0 && (
              <div>
                <p className="font-medium text-amber-600">⚠ Unmatched ({linkResult.unmatched.length}):</p>
                {linkResult.unmatched.map((u: any, i: number) => (
                  <p key={i} className="ml-4 text-muted-foreground">{u.folder}: {u.reason}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Tasks</p>
            <p className="text-2xl font-bold">{totalTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{completedTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{overdueTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className="text-2xl font-bold">{progressPct}%</p>
            <Progress value={progressPct} className="h-2 mt-1" />
          </CardContent>
        </Card>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>ClickUp Tasks ({filteredTasks.length})</CardTitle>
          <CardDescription>Manage task assignments and view sync status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading tasks...</p>
          ) : filteredTasks.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No tasks found. Click "Link Events to ClickUp" first, then "Sync Tasks".</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsible</TableHead>
                    <TableHead>Assigned Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => {
                    const isOverdue = !task.completed_at && task.due_date && isPast(new Date(task.due_date));
                    return (
                      <TableRow key={task.id} className={isOverdue ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                        <TableCell>
                          <span className={task.completed_at ? 'line-through text-muted-foreground' : 'font-medium'}>
                            {task.task_name}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getEventTitle(task.event_id)}
                        </TableCell>
                        <TableCell>
                          {task.phase && (
                            <Badge variant="outline" className="text-xs">
                              {PHASE_LABELS[task.phase] || task.phase}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.due_date ? (
                            <span className={isOverdue ? 'text-destructive font-medium' : 'text-sm'}>
                              {format(new Date(task.due_date), 'MMM d, yyyy')}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {task.completed_at ? (
                            <Badge className="bg-green-600">Done</Badge>
                          ) : isOverdue ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <Badge variant="secondary">{task.status || 'Open'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{task.responsible_person || '—'}</TableCell>
                        <TableCell>
                          <Select
                            value={task.agent_id || 'unassigned'}
                            onValueChange={(v) => handleAssignAgent(task.id, v)}
                          >
                            <SelectTrigger className="w-[160px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {agents.map(a => (
                                <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

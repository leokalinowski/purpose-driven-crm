import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  const [eventFilter, setEventFilter] = useState<string>(
    events.length === 1 ? events[0].id : 'all'
  );

  const fetchTasks = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('clickup_tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (eventFilter !== 'all') {
        query = query.eq('event_id', eventFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks((data || []) as ClickUpTaskRow[]);
    } catch (err: any) {
      console.error('Error fetching checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [eventFilter]);

  useEffect(() => {
    if (events.length === 1) {
      setEventFilter(events[0].id);
    }
  }, [events]);

  // Realtime subscription for auto-updates
  useEffect(() => {
    if (eventFilter === 'all') return;

    const channel = supabase
      .channel(`checklist-${eventFilter}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clickup_tasks',
        filter: `event_id=eq.${eventFilter}`,
      }, () => fetchTasks())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventFilter]);

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
      {/* Event Filter (only when multiple events) */}
      {events.length > 1 && (
        <div className="flex items-center gap-4">
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filter by event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map(e => {
                const agent = agents.find(a => a.user_id === e.agent_id);
                const agentName = agent ? agent.name : 'Unassigned';
                return (
                  <SelectItem key={e.id} value={e.id}>{e.title} ({agentName})</SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Items</p>
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

      {/* Checklist Table */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist ({filteredTasks.length})</CardTitle>
          <CardDescription>Task assignments and completion status — updates automatically</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading checklist...</p>
          ) : filteredTasks.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No checklist items found.</p>
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

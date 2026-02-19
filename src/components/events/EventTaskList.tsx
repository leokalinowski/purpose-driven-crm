import { useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { CheckCircle2, Circle, AlertTriangle, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ClickUpTask, PhaseGroup } from '@/hooks/useClickUpTasks';

interface EventTaskListProps {
  tasks: ClickUpTask[];
  tasksByPhase?: PhaseGroup[];
}

type FilterType = 'all' | 'completed' | 'overdue' | 'in_progress';

const PHASE_COLORS: Record<string, string> = {
  pre_event: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  event_day: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  post_event: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export function EventTaskList({ tasks, tasksByPhase }: EventTaskListProps) {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'status' | 'responsible' | 'phase'>('due_date');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasPhases = tasksByPhase && tasksByPhase.length > 1;

  const filteredTasks = tasks.filter(t => {
    if (phaseFilter !== 'all' && (t.phase || 'pre_event') !== phaseFilter) return false;
    if (filter === 'all') return true;
    if (filter === 'completed') return !!t.completed_at;
    if (filter === 'overdue') return !t.completed_at && t.due_date && new Date(t.due_date) < today;
    if (filter === 'in_progress') return !t.completed_at;
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'phase') {
      const order = ['pre_event', 'event_day', 'post_event'];
      return order.indexOf(a.phase || 'pre_event') - order.indexOf(b.phase || 'pre_event');
    }
    if (sortBy === 'due_date') {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (sortBy === 'status') {
      const aCompleted = !!a.completed_at;
      const bCompleted = !!b.completed_at;
      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
      return 0;
    }
    if (sortBy === 'responsible') {
      return (a.responsible_person || '').localeCompare(b.responsible_person || '');
    }
    return 0;
  });

  const getTaskStatusInfo = (task: ClickUpTask) => {
    if (task.completed_at) {
      return { icon: CheckCircle2, color: 'text-green-600', label: 'Done', variant: 'default' as const };
    }
    if (task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))) {
      return { icon: AlertTriangle, color: 'text-destructive', label: 'Overdue', variant: 'destructive' as const };
    }
    return { icon: Circle, color: 'text-muted-foreground', label: task.status || 'Open', variant: 'secondary' as const };
  };

  const getPhaseLabel = (phase: string | null) => {
    const labels: Record<string, string> = { pre_event: 'Pre-Event', event_day: 'Event Day', post_event: 'Post-Event' };
    return labels[phase || 'pre_event'] || phase;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            All Tasks ({filteredTasks.length})
          </CardTitle>
          {expanded && (
            <div className="flex items-center gap-2 flex-wrap">
              {hasPhases && (
                <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Phases</SelectItem>
                    <SelectItem value="pre_event">Pre-Event</SelectItem>
                    <SelectItem value="event_day">Event Day</SelectItem>
                    <SelectItem value="post_event">Post-Event</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">By Due Date</SelectItem>
                  <SelectItem value="status">By Status</SelectItem>
                  <SelectItem value="responsible">By Person</SelectItem>
                  {hasPhases && <SelectItem value="phase">By Phase</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          {sortedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks match the current filter.</p>
          ) : (
            <div className="space-y-2">
              {sortedTasks.map((task) => {
                const status = getTaskStatusInfo(task);
                return (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      task.completed_at ? 'bg-muted/30' : status.label === 'Overdue' ? 'border-destructive/30 bg-red-50/50 dark:bg-red-950/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <status.icon className={`h-4 w-4 flex-shrink-0 ${status.color}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${task.completed_at ? 'line-through text-muted-foreground' : ''}`}>
                            {task.task_name}
                          </p>
                          {hasPhases && task.phase && (
                            <Badge className={`text-[10px] px-1.5 py-0 ${PHASE_COLORS[task.phase] || ''}`}>
                              {getPhaseLabel(task.phase)}
                            </Badge>
                          )}
                        </div>
                        {task.responsible_person && (
                          <p className="text-xs text-muted-foreground">{task.responsible_person}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.due_date && (
                        <span className={`text-xs ${status.label === 'Overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {format(new Date(task.due_date), 'MMM d')}
                        </span>
                      )}
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

import { differenceInDays, format } from 'date-fns';
import { Calendar, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EventProgressStats } from './EventProgressStats';
import { EventTaskList } from './EventTaskList';
import { useClickUpTasks } from '@/hooks/useClickUpTasks';
import type { Event } from '@/hooks/useEvents';

interface EventProgressDashboardProps {
  event: Event;
}

export function EventProgressDashboard({ event }: EventProgressDashboardProps) {
  const { tasks, stats, tasksByResponsible, tasksByPhase, loading } = useClickUpTasks(event.id);

  const eventDate = new Date(event.event_date);
  const today = new Date();
  const daysUntil = differenceInDays(eventDate, today);
  const isPast = daysUntil < 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Checklist Items Yet</h3>
          <p className="text-muted-foreground text-center max-w-md">
            There are no checklist items for this event yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const progressColor = stats.progressPct >= 75 ? 'text-green-600' : stats.progressPct >= 40 ? 'text-amber-600' : 'text-destructive';

  return (
    <div className="space-y-4">
      {/* Hero Progress Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{event.title}</CardTitle>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(eventDate, 'EEEE, MMMM d, yyyy')}
                </span>
                {event.location && <span>{event.location}</span>}
              </div>
            </div>
            <div className="text-right">
              {isPast ? (
                <span className="text-sm font-medium text-green-600">Event Complete</span>
              ) : daysUntil === 0 ? (
                <span className="text-lg font-bold text-primary">Today!</span>
              ) : (
                <div>
                  <span className="text-3xl font-bold text-foreground">{daysUntil}</span>
                  <span className="text-sm text-muted-foreground ml-1">days left</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className={`font-bold ${progressColor}`}>{stats.progressPct}%</span>
            </div>
            <Progress value={stats.progressPct} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <EventProgressStats stats={stats} />

      {/* Phase Progress Breakdown */}
      {tasksByPhase.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progress by Phase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasksByPhase.map((group) => (
              <div key={group.phase} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{group.label}</Badge>
                    <span className="font-medium">{group.completed}/{group.total} tasks</span>
                  </div>
                  <span className="text-muted-foreground">{group.progressPct}%</span>
                </div>
                <Progress value={group.progressPct} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Breakdown by Responsible Person */}
      {tasksByResponsible.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progress by Team Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasksByResponsible.map((group) => (
              <div key={group.responsible} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{group.responsible}</span>
                  <span className="text-muted-foreground">{group.completed}/{group.total}</span>
                </div>
                <Progress value={group.progressPct} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Full Task List with phase grouping */}
      <EventTaskList tasks={tasks} tasksByPhase={tasksByPhase} />
    </div>
  );
}

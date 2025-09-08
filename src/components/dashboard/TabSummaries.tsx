import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useEvents } from '@/hooks/useEvents';

export function TabSummaries() {
  const { data } = useDashboardMetrics();
  const { tasks, getNextEvent } = useEvents();

  const nextEvent = getNextEvent();
  const nextEventTasks = nextEvent ? tasks.filter(t => t.event_id === nextEvent.id) : [];
  const completed = nextEventTasks.filter(t => t.status === 'completed').length;
  const total = nextEventTasks.length || 1;
  const progress = Math.round((completed / total) * 100);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>SphereSync Tasks</CardTitle>
          <CardDescription>This month's completion progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={Number(String((data?.kpis.sphereSyncCompletionRate.value || '0').toString().replace('%','')))} />
          <div className="text-sm text-muted-foreground">Completion rate this month</div>
          <Link to="/spheresync-tasks" className="text-sm underline">Go to SphereSync Tasks</Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database</CardTitle>
          <CardDescription>Lead growth</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.kpis.totalContacts.value ?? 0}</div>
          <div className="text-sm text-muted-foreground">Total leads</div>
          <Link to="/database" className="text-sm underline">Go to Database</Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next Event</CardTitle>
          <CardDescription>{nextEvent ? `${nextEvent.title} on ${nextEvent.event_date}` : 'No upcoming event'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={progress} />
          <div className="text-sm text-muted-foreground">{completed} / {total} tasks completed</div>
          <Link to="/events" className="text-sm underline">Go to Events</Link>
        </CardContent>
      </Card>
    </div>
  );
}

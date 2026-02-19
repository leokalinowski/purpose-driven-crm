import { ArrowRight, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEvents } from '@/hooks/useEvents';
import { useClickUpTasks } from '@/hooks/useClickUpTasks';

export function EventsWidget() {
  const { events, loading: eventsLoading } = useEvents();
  const nextEvent = events.find(e => new Date(e.event_date) >= new Date());
  const { stats, loading: tasksLoading } = useClickUpTasks(nextEvent?.id);

  const isLoading = eventsLoading || tasksLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!nextEvent) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Upcoming Event
            </CardTitle>
            <Link to="/events">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-2">No upcoming events</p>
        </CardContent>
      </Card>
    );
  }

  const daysUntil = differenceInDays(new Date(nextEvent.event_date), new Date());

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Upcoming Event
          </CardTitle>
          <Link to="/events">
            <Button variant="ghost" size="sm">
              Details
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="font-semibold">{nextEvent.title}</h4>
          <p className="text-sm text-muted-foreground">
            {format(new Date(nextEvent.event_date), 'MMM d, yyyy')} · {daysUntil === 0 ? 'Today!' : `${daysUntil} days away`}
          </p>
        </div>

        {stats.total > 0 && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Task Progress</span>
                <span className="font-medium">{stats.completed}/{stats.total}</span>
              </div>
              <Progress value={stats.progressPct} className="h-2" />
            </div>

            <div className="flex items-center gap-3">
              {stats.overdue > 0 && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.overdue} overdue
                </Badge>
              )}
              {stats.completed === stats.total && (
                <Badge className="text-xs gap-1 bg-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  All done!
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

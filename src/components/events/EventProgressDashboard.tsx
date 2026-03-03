import { Calendar, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EventProgressStats } from './EventProgressStats';
import { EventHeroCard } from './EventHeroCard';
import { EventTaskList } from './EventTaskList';
import { SelfManagedTaskDashboard } from './SelfManagedTaskDashboard';
import { useClickUpTasks } from '@/hooks/useClickUpTasks';
import { useUserRole } from '@/hooks/useUserRole';
import type { Event } from '@/hooks/useEvents';

interface EventProgressDashboardProps {
  event: Event;
}

export function EventProgressDashboard({ event }: EventProgressDashboardProps) {
  const { role, isAdmin, isAgent, isEditor, loading: roleLoading } = useUserRole();

  // Always call the hook but only use its data for ClickUp tiers
  const { tasks, stats, tasksByResponsible, tasksByPhase, loading } = useClickUpTasks(event.id);

  // Data-driven: only use ClickUp view if there are actual ClickUp tasks
  const useClickUp = (isAdmin || isAgent || isEditor) && tasks.length > 0;

  if (roleLoading || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ── Managed / Core tiers → self-managed task dashboard ──
  if (!useClickUp) {
    return <SelfManagedTaskDashboard event={event} />;
  }

  // ── Agent / Admin / Editor → existing ClickUp read-only view ──
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

  return (
    <div className="space-y-4">
      {/* Hero Progress Card */}
      <EventHeroCard
        title={event.title}
        eventDate={event.event_date}
        location={event.location}
        progressPct={stats.progressPct}
      />

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

import { useState, useMemo, useCallback } from 'react';
import { differenceInDays, format, isBefore, addDays } from 'date-fns';
import {
  Calendar, Target, CheckCircle2, Circle, Clock, AlertTriangle,
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EventProgressStats } from './EventProgressStats';
import { EventHeroCard } from './EventHeroCard';
import { TaskForm } from './TaskForm';
import { TaskEditForm } from './TaskEditForm';
import { useEvents } from '@/hooks/useEvents';
import type { Event, EventTask } from '@/hooks/useEvents';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { buildTaskInserts } from '@/utils/defaultEventTasks';
import { toast } from 'sonner';

interface SelfManagedTaskDashboardProps {
  event: Event;
}

const PHASE_LABELS: Record<string, string> = {
  pre_event: 'Pre-Event',
  event_day: 'Event Day',
  post_event: 'Post-Event',
};

const PHASE_ORDER = ['pre_event', 'event_day', 'post_event', 'unassigned'];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'To Do', icon: Circle, color: 'text-muted-foreground', activeBg: 'bg-muted' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-600', activeBg: 'bg-blue-100 dark:bg-blue-900/40' },
  { value: 'completed', label: 'Done', icon: CheckCircle2, color: 'text-green-600', activeBg: 'bg-green-100 dark:bg-green-900/40' },
] as const;

export function SelfManagedTaskDashboard({ event }: SelfManagedTaskDashboardProps) {
  const { user } = useAuth();
  const { tasks, markTaskComplete, updateTask, deleteTask, addTask, fetchEventTasks, loading } = useEvents();
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<EventTask | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [generatingTasks, setGeneratingTasks] = useState(false);

  const eventTasks = useMemo(
    () => tasks.filter((t) => t.event_id === event.id),
    [tasks, event.id],
  );

  const eventDate = new Date(event.event_date);
  const today = new Date();
  const daysUntil = differenceInDays(eventDate, today);
  const isPast = daysUntil < 0;

  // ── Stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = eventTasks.length;
    const completed = eventTasks.filter((t) => t.status === 'completed').length;
    const inProgress = eventTasks.filter((t) => t.status === 'in_progress').length;
    const overdue = eventTasks.filter(
      (t) => t.status !== 'completed' && t.due_date && isBefore(new Date(t.due_date), today),
    ).length;
    const dueSoon = eventTasks.filter(
      (t) =>
        t.status !== 'completed' &&
        t.due_date &&
        !isBefore(new Date(t.due_date), today) &&
        isBefore(new Date(t.due_date), addDays(today, 7)),
    ).length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, overdue, dueSoon, progressPct };
  }, [eventTasks]);

  // ── Phase grouping ────────────────────────────────────
  const tasksByPhase = useMemo(() => {
    const groups: Record<string, EventTask[]> = {};
    eventTasks.forEach((t) => {
      const phase = (t as any).phase || 'unassigned';
      if (!groups[phase]) groups[phase] = [];
      groups[phase].push(t);
    });

    return PHASE_ORDER.filter((p) => groups[p]?.length)
      .map((phase) => {
        const phaseTasks = groups[phase];
        const completed = phaseTasks.filter((t) => t.status === 'completed').length;
        return {
          phase,
          label: PHASE_LABELS[phase] || 'Other',
          tasks: phaseTasks,
          total: phaseTasks.length,
          completed,
          progressPct: Math.round((completed / phaseTasks.length) * 100),
        };
      });
  }, [eventTasks]);

  // ── Handlers ──────────────────────────────────────────
  const handleSetStatus = async (task: EventTask, newStatus: string) => {
    try {
      if (newStatus === 'completed') {
        await markTaskComplete(task.id);
      } else {
        await updateTask(task.id, {
          status: newStatus,
          completed_at: null,
        } as any);
      }
      await fetchEventTasks();
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleGenerateDefaults = async () => {
    if (!user) return;
    setGeneratingTasks(true);
    try {
      const inserts = buildTaskInserts(event.id, user.id, new Date(event.event_date));
      const { error } = await supabase.from('event_tasks').insert(inserts);
      if (error) throw error;
      await fetchEventTasks();
      toast.success('Default tasks generated!');
    } catch {
      toast.error('Failed to generate default tasks');
    } finally {
      setGeneratingTasks(false);
    }
  };

  const handleTaskAdded = useCallback(async () => {
    await fetchEventTasks();
    setShowAddTask(false);
  }, [fetchEventTasks]);

  const handleTaskUpdated = useCallback(async () => {
    await fetchEventTasks();
    setEditingTask(null);
  }, [fetchEventTasks]);

  const togglePhase = (phase: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  // ── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────
  if (eventTasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Tasks Yet</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Get started by generating a default checklist for this event, or add tasks manually.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleGenerateDefaults} disabled={generatingTasks}>
              {generatingTasks ? 'Generating...' : 'Generate Default Checklist'}
            </Button>
            <Button variant="outline" onClick={() => setShowAddTask(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Task
            </Button>
          </div>
          {showAddTask && (
            <TaskForm
              eventId={event.id}
              onClose={() => setShowAddTask(false)}
              onTaskAdded={handleTaskAdded}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  const progressColor =
    stats.progressPct >= 75 ? 'text-green-600' : stats.progressPct >= 40 ? 'text-amber-600' : 'text-destructive';

  return (
    <div className="space-y-4">
      {/* Hero Progress */}
      <EventHeroCard
        title={event.title}
        eventDate={event.event_date}
        location={event.location}
        progressPct={stats.progressPct}
      />

      {/* Stats */}
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

      {/* Task List by Phase */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base">Tasks</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAddTask(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tasksByPhase.map((group) => {
            const isCollapsed = collapsedPhases.has(group.phase);
            return (
              <div key={group.phase}>
                <button
                  onClick={() => togglePhase(group.phase)}
                  className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {group.label}
                  <Badge variant="secondary" className="text-xs ml-1">
                    {group.completed}/{group.total}
                  </Badge>
                </button>
                {!isCollapsed && (
                  <div className="space-y-1 sm:ml-6">
                    {group.tasks.map((task) => {
                      const status = task.status || 'pending';
                      const isComplete = status === 'completed';
                      const isInProgress = status === 'in_progress';
                      const isOverdue =
                        !isComplete && task.due_date && isBefore(new Date(task.due_date), today);
                      return (
                        <div
                          key={task.id}
                          className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 rounded-md border transition-colors ${
                            isComplete
                              ? 'bg-muted/40 border-muted'
                              : isOverdue
                                ? 'border-destructive/30 bg-destructive/5'
                                : isInProgress
                                  ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                                  : 'border-border hover:bg-muted/30'
                          }`}
                        >
                          {/* Task info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isComplete ? 'line-through text-muted-foreground' : ''}`}>
                              {task.task_name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                              {task.responsible_person && <span>{task.responsible_person}</span>}
                              {task.due_date && (
                                <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                                  {format(new Date(task.due_date), 'MMM d')}
                                  {isOverdue && ' (overdue)'}
                                </span>
                              )}
                            </div>
                            {task.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.notes}</p>
                            )}
                          </div>

                          {/* Inline status toggle + actions */}
                          <div className="flex items-center gap-1 shrink-0 flex-wrap">
                            {/* Status toggle buttons */}
                            <div className="inline-flex items-center rounded-md border border-border p-0.5 gap-0.5">
                              {STATUS_OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                const isActive = status === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => handleSetStatus(task, opt.value)}
                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium transition-colors ${
                                      isActive
                                        ? `${opt.activeBg} ${opt.color}`
                                        : 'text-muted-foreground hover:bg-muted/50'
                                    }`}
                                    title={opt.label}
                                  >
                                    <Icon className="h-3 w-3" />
                                    <span className="hidden sm:inline">{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Edit / Delete */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingTask(task)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Delete task "${task.task_name}"?`)) {
                                  handleDelete(task.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {showAddTask && (
        <TaskForm
          eventId={event.id}
          onClose={() => setShowAddTask(false)}
          onTaskAdded={handleTaskAdded}
        />
      )}
      {editingTask && (
        <TaskEditForm
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </div>
  );
}

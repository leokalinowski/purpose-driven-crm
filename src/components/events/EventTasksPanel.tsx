/**
 * EventTasksPanel — replaces SelfManagedTaskDashboard for the agent-facing
 * EventDetail page.
 *
 * Why a new component: the previous dashboard re-rendered an event hero
 * card, a 4-stat tile strip, a "Progress by Phase" block, and a 3-tab phase
 * tab list — all on top of the existing 4-stat strip the EventDetail page
 * already shows. Too much information, hard to find what matters, vertical
 * stack of redundant headers.
 *
 * The new design borrows the SphereSync prioritization model: tasks
 * grouped by URGENCY (Overdue → Due this week → Upcoming → Done), not by
 * phase. Phase becomes a filter chip row at the top, not the primary
 * organization. Done tasks collapse by default. Each row is one-click
 * complete via the checkbox.
 *
 * Phase 5 of the Events comprehensive sweep — first iteration after user
 * feedback on the original detail page redesign.
 */

import { useState, useMemo, useCallback } from 'react';
import { differenceInDays, format, isBefore, addDays, isSameDay } from 'date-fns';
import {
  CheckCircle2, Circle, AlertCircle, Plus, Pencil, Trash2,
  ChevronDown, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskForm } from './TaskForm';
import { TaskEditForm } from './TaskEditForm';
import { useEvents, type Event, type EventTask } from '@/hooks/useEvents';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { buildTaskInserts } from '@/utils/defaultEventTasks';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EventTasksPanelProps {
  event: Event;
}

type PhaseFilter = 'all' | 'pre_event' | 'event_day' | 'post_event';
type Bucket = 'overdue' | 'this_week' | 'upcoming' | 'done';

const PHASE_LABELS: Record<string, string> = {
  pre_event: 'Pre-Event',
  event_day: 'Event Day',
  post_event: 'Post-Event',
};

const PHASE_CHIP: Record<string, string> = {
  pre_event: 'bg-purple-100 text-purple-800 border-purple-200',
  event_day: 'bg-amber-100 text-amber-800 border-amber-200',
  post_event: 'bg-green-100 text-green-800 border-green-200',
  unassigned: 'bg-muted text-muted-foreground border-border',
};

const BUCKET_META: Record<Bucket, { label: string; tone: string; icon: React.ReactNode; subtitle: (n: number) => string }> = {
  overdue: {
    label: 'Overdue',
    tone: 'text-red-700',
    icon: <AlertCircle className="w-4 h-4 text-red-600" />,
    subtitle: (n) => (n === 1 ? 'Needs your attention now' : 'These are slipping — knock them out first'),
  },
  this_week: {
    label: 'Due this week',
    tone: 'text-amber-700',
    icon: <Circle className="w-4 h-4 text-amber-600" />,
    subtitle: (n) => `${n} item${n === 1 ? '' : 's'} due in the next 7 days`,
  },
  upcoming: {
    label: 'Upcoming',
    tone: 'text-foreground',
    icon: <Circle className="w-4 h-4 text-muted-foreground" />,
    subtitle: () => 'On the radar — no action needed yet',
  },
  done: {
    label: 'Done',
    tone: 'text-reop-green',
    icon: <CheckCircle2 className="w-4 h-4 text-reop-green" />,
    subtitle: (n) => `${n} task${n === 1 ? '' : 's'} completed`,
  },
};

export function EventTasksPanel({ event }: EventTasksPanelProps) {
  const { user } = useAuth();
  const { tasks, markTaskComplete, updateTask, deleteTask, fetchEventTasks, loading } = useEvents();
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<EventTask | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  // ── Source data ───────────────────────────────────────────────────────
  const eventTasks = useMemo(
    () => tasks.filter((t) => t.event_id === event.id),
    [tasks, event.id],
  );

  // Phase counts always reflect the FULL set (filter chips show the totals,
  // not the post-filter view).
  const phaseCounts = useMemo(() => {
    const c = { all: 0, pre_event: 0, event_day: 0, post_event: 0 };
    for (const t of eventTasks) {
      c.all++;
      const p = (t.phase ?? 'unassigned') as keyof typeof c;
      if (p in c) c[p]++;
    }
    return c;
  }, [eventTasks]);

  // ── Bucketing ─────────────────────────────────────────────────────────
  // Tasks pass through the phase filter first, then bucket by urgency.
  const buckets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = addDays(today, 7);

    const filtered = eventTasks.filter((t) => {
      if (phaseFilter === 'all') return true;
      return (t.phase ?? 'unassigned') === phaseFilter;
    });

    const groups: Record<Bucket, EventTask[]> = {
      overdue: [],
      this_week: [],
      upcoming: [],
      done: [],
    };

    for (const t of filtered) {
      const isDone = t.status === 'completed' || !!t.completed_at;
      if (isDone) {
        groups.done.push(t);
        continue;
      }
      if (!t.due_date) {
        groups.upcoming.push(t); // No due date → treat as upcoming.
        continue;
      }
      const due = new Date(t.due_date);
      if (isBefore(due, today)) groups.overdue.push(t);
      else if (isBefore(due, weekFromNow)) groups.this_week.push(t);
      else groups.upcoming.push(t);
    }

    // Sort each bucket by due_date ascending so the soonest deadlines
    // surface at the top of each section.
    for (const k of Object.keys(groups) as Bucket[]) {
      groups[k].sort((a, b) => {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      });
    }

    return groups;
  }, [eventTasks, phaseFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const toggleComplete = useCallback(
    async (task: EventTask) => {
      try {
        if (task.status === 'completed' || task.completed_at) {
          await updateTask(task.id, { status: 'pending', completed_at: null as unknown as string });
        } else {
          await markTaskComplete(task.id);
        }
      } catch {
        toast.error('Failed to update task');
      }
    },
    [markTaskComplete, updateTask],
  );

  const handleDelete = useCallback(
    async (task: EventTask) => {
      if (!confirm(`Delete "${task.task_name}"?`)) return;
      try {
        await deleteTask(task.id);
        toast.success('Task deleted');
      } catch {
        toast.error('Failed to delete task');
      }
    },
    [deleteTask],
  );

  const handleGenerateDefaults = useCallback(async () => {
    if (!user) return;
    setGeneratingTasks(true);
    try {
      const inserts = buildTaskInserts(event.id, user.id, new Date(event.event_date));
      const { error } = await supabase.from('event_tasks').insert(inserts);
      if (error) throw error;
      await fetchEventTasks();
      toast.success('Default checklist generated');
    } catch {
      toast.error('Failed to generate default tasks');
    } finally {
      setGeneratingTasks(false);
    }
  }, [event.id, event.event_date, fetchEventTasks, user]);

  const handleTaskAdded = useCallback(async () => {
    await fetchEventTasks();
    setShowAddTask(false);
  }, [fetchEventTasks]);

  const handleTaskUpdated = useCallback(async () => {
    await fetchEventTasks();
    setEditingTask(null);
  }, [fetchEventTasks]);

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (eventTasks.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-8 sm:p-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-reop-teal-soft text-primary mb-4">
          <Sparkles className="w-5 h-5" />
        </div>
        <h3 className="text-base sm:text-lg font-semibold mb-2">No tasks yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5 leading-relaxed">
          Generate the default checklist (43 tasks across pre-event, event day, and post-event) — or add custom tasks one at a time.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={handleGenerateDefaults} disabled={generatingTasks}>
            {generatingTasks ? 'Generating…' : 'Generate default checklist'}
          </Button>
          <Button variant="outline" onClick={() => setShowAddTask(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add custom task
          </Button>
        </div>
        {showAddTask && (
          <TaskForm
            eventId={event.id}
            onClose={() => setShowAddTask(false)}
            onTaskAdded={handleTaskAdded}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase filter chips + Add-task action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1.5">
          <FilterChip
            label="All"
            count={phaseCounts.all}
            active={phaseFilter === 'all'}
            onClick={() => setPhaseFilter('all')}
          />
          <FilterChip
            label="Pre-Event"
            count={phaseCounts.pre_event}
            active={phaseFilter === 'pre_event'}
            onClick={() => setPhaseFilter('pre_event')}
            tone="purple"
          />
          <FilterChip
            label="Event Day"
            count={phaseCounts.event_day}
            active={phaseFilter === 'event_day'}
            onClick={() => setPhaseFilter('event_day')}
            tone="amber"
          />
          <FilterChip
            label="Post-Event"
            count={phaseCounts.post_event}
            active={phaseFilter === 'post_event'}
            onClick={() => setPhaseFilter('post_event')}
            tone="green"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAddTask(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add task
        </Button>
      </div>

      {/* Buckets — render in priority order. Skip empty buckets except
          Overdue (always show "0 overdue · on track" because that's a
          positive signal worth surfacing). */}
      {(['overdue', 'this_week', 'upcoming', 'done'] as Bucket[]).map((b) => {
        const list = buckets[b];
        if (list.length === 0 && b !== 'overdue') return null;
        const isDone = b === 'done';
        const collapsed = isDone && doneCollapsed;
        return (
          <BucketSection
            key={b}
            bucket={b}
            count={list.length}
            collapsed={collapsed}
            onToggleCollapse={isDone ? () => setDoneCollapsed((c) => !c) : undefined}
          >
            {b === 'overdue' && list.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1 py-2">
                Nothing overdue — you're on track.
              </p>
            ) : (
              <div className="space-y-1">
                {list.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    bucket={b}
                    onToggleComplete={() => toggleComplete(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => handleDelete(task)}
                  />
                ))}
              </div>
            )}
          </BucketSection>
        );
      })}

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

// ── Sub-components ─────────────────────────────────────────────────────

function FilterChip({
  label, count, active, onClick, tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: 'purple' | 'amber' | 'green';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] font-medium transition',
        active
          ? 'border-primary bg-reop-teal-soft text-primary'
          : 'border-border bg-card text-foreground hover:bg-muted/40',
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-semibold',
          active
            ? 'bg-primary/15 text-primary'
            : tone === 'purple'
              ? 'bg-purple-100 text-purple-700'
              : tone === 'amber'
                ? 'bg-amber-100 text-amber-700'
                : tone === 'green'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function BucketSection({
  bucket, count, collapsed, onToggleCollapse, children,
}: {
  bucket: Bucket;
  count: number;
  collapsed: boolean;
  onToggleCollapse?: () => void;
  children: React.ReactNode;
}) {
  const meta = BUCKET_META[bucket];
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggleCollapse}
        disabled={!onToggleCollapse}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border',
          onToggleCollapse && 'hover:bg-muted/30 cursor-pointer',
          !onToggleCollapse && 'cursor-default',
        )}
      >
        <div className="flex items-center gap-2 text-left">
          {meta.icon}
          <h3 className={cn('text-sm font-semibold', meta.tone)}>
            {meta.label}
            <span className="ml-1.5 text-xs font-medium text-muted-foreground">{count}</span>
          </h3>
          <span className="hidden sm:inline text-xs text-muted-foreground">
            · {meta.subtitle(count)}
          </span>
        </div>
        {onToggleCollapse && (
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition', !collapsed && 'rotate-180')} />
        )}
      </button>
      {!collapsed && <div className="p-2">{children}</div>}
    </section>
  );
}

function TaskRow({
  task, bucket, onToggleComplete, onEdit, onDelete,
}: {
  task: EventTask;
  bucket: Bucket;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isDone = bucket === 'done';
  const isOverdue = bucket === 'overdue';
  const phase = task.phase ?? 'unassigned';
  const phaseLabel = PHASE_LABELS[phase] ?? 'Other';

  // Friendly relative due date — "Today", "Tomorrow", "May 5", "3d overdue".
  const dueLabel = (() => {
    if (!task.due_date) return null;
    const due = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isSameDay(due, today)) return 'Today';
    if (isSameDay(due, addDays(today, 1))) return 'Tomorrow';
    const diff = differenceInDays(due, today);
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff < 7) return format(due, 'EEE, MMM d');
    return format(due, 'MMM d');
  })();

  return (
    <div
      className={cn(
        'group flex items-start sm:items-center gap-3 px-2.5 py-2.5 rounded-md transition-colors',
        isOverdue && 'hover:bg-red-50/40',
        !isOverdue && 'hover:bg-muted/40',
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggleComplete}
        aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
        className={cn(
          'mt-0.5 sm:mt-0 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition border',
          isDone
            ? 'bg-reop-green border-reop-green text-white'
            : isOverdue
              ? 'border-red-300 bg-red-50 hover:bg-red-100'
              : 'border-border bg-card hover:border-primary',
        )}
      >
        {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', isDone && 'line-through text-muted-foreground')}>
          {task.task_name}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11.5px] text-muted-foreground">
          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide', PHASE_CHIP[phase])}>
            {phaseLabel}
          </span>
          {dueLabel && (
            <span className={cn(isOverdue && 'text-red-700 font-medium')}>
              {dueLabel}
            </span>
          )}
          {task.responsible_person && task.responsible_person !== 'Agent' && (
            <span>{task.responsible_person}</span>
          )}
          {task.notes && (
            <span className="truncate text-muted-foreground/80">· {task.notes}</span>
          )}
        </div>
      </div>

      {/* Actions — visible on hover only on desktop, always on mobile */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0 sm:opacity-0 max-sm:opacity-100">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label="Edit task">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-red-700"
          onClick={onDelete}
          aria-label="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * NewsletterScheduleManager — agent-facing UI for the recurring cadence
 * feature. Lists existing schedules and provides a create-form.
 *
 * The math (next_send_at) is computed in `useNewsletterSchedules`. This
 * component is purely presentational + form glue.
 */

import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Repeat, Pause, Play, Pencil, Trash2, Plus, CheckCircle2, Clock,
  AlertCircle, X, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  useNewsletterSchedules,
  type NewsletterSchedule,
  type Recurrence,
  type NewSchedule,
} from '@/hooks/useNewsletterSchedules';
import { useNewsletterTemplates } from '@/hooks/useNewsletterTemplates';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: 'One-time',
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
};

function describeSchedule(s: NewsletterSchedule): string {
  const hour = formatHourLabel(s.recurrence_hour);
  if (s.recurrence === 'monthly') {
    return `Every month on the ${ordinal(s.recurrence_day ?? 1)} at ${hour}`;
  }
  if (s.recurrence === 'weekly') {
    return `Every ${DAYS_OF_WEEK[s.recurrence_day ?? 0]} at ${hour}`;
  }
  if (s.recurrence === 'biweekly') {
    return `Every other ${DAYS_OF_WEEK[s.recurrence_day ?? 0]} at ${hour}`;
  }
  return s.scheduled_at ? `One-time · ${format(parseISO(s.scheduled_at), 'MMM d, h:mm a')}` : 'One-time';
}

function formatHourLabel(h: number): string {
  // 24h UTC → friendlier display. Agents will see UTC for now; we can layer
  // local-tz later. Display as "10:00 UTC" so it's unambiguous.
  return `${String(h).padStart(2, '0')}:00 UTC`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function NewsletterScheduleManager() {
  const { schedules, loading, createSchedule, updateSchedule, deleteSchedule, togglePause } = useNewsletterSchedules();
  const { templates, isLoading: templatesLoading } = useNewsletterTemplates();
  const [showCreate, setShowCreate] = useState(false);

  // Recurring schedules surface here. Pure one-off scheduled sends still work
  // via the existing builder Send/Schedule panel, so we filter them out of
  // this list to keep the page focused on cadence.
  const recurringSchedules = useMemo(
    () => schedules.filter((s) => s.recurrence !== 'once'),
    [schedules],
  );

  if (loading || templatesLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Empty: agent has zero recurring schedules.
  if (recurringSchedules.length === 0) {
    return (
      <>
        <div className="bg-card border border-dashed border-border rounded-xl p-8 sm:p-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-reop-teal-soft text-primary mb-4">
            <Repeat className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold mb-2">
            No recurring schedules yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5 leading-relaxed">
            Set up a recurring schedule once — your newsletter goes out every month (or week) on autopilot.
            The Coach handles the rhythm; you stay top of mind.
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            disabled={templates.length === 0}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {templates.length === 0 ? 'Save a template first' : 'Set up cadence'}
          </Button>
          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Recurring schedules need a saved template to send. Open the builder to create one.
            </p>
          )}
        </div>
        {showCreate && (
          <ScheduleDialog
            open={showCreate}
            onOpenChange={setShowCreate}
            onSubmit={async (input) => {
              await createSchedule(input);
              toast.success('Recurring schedule created');
            }}
            templates={templates}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold leading-tight">Recurring schedules</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-fires hourly via the dispatcher cron. Pause anytime.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New schedule
        </Button>
      </div>

      {/* Schedule cards */}
      <div className="space-y-3">
        {recurringSchedules.map((s) => {
          const template = templates.find((t) => t.id === s.template_id);
          return (
            <ScheduleCard
              key={s.id}
              schedule={s}
              templateName={template?.name ?? 'Deleted template'}
              templateMissing={!template}
              onTogglePause={async () => {
                await togglePause(s.id, !s.is_active);
                toast.success(s.is_active ? 'Schedule paused' : 'Schedule resumed');
              }}
              onDelete={async () => {
                if (confirm(`Delete this schedule? This won't delete the template "${template?.name ?? ''}".`)) {
                  await deleteSchedule(s.id);
                  toast.success('Schedule deleted');
                }
              }}
              onEdit={(updates) => updateSchedule(s.id, updates)}
            />
          );
        })}
      </div>

      {showCreate && (
        <ScheduleDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSubmit={async (input) => {
            await createSchedule(input);
            toast.success('Recurring schedule created');
          }}
          templates={templates}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function ScheduleCard({
  schedule, templateName, templateMissing, onTogglePause, onDelete, onEdit,
}: {
  schedule: NewsletterSchedule;
  templateName: string;
  templateMissing: boolean;
  onTogglePause: () => Promise<void>;
  onDelete: () => Promise<void>;
  onEdit: (updates: Partial<NewsletterSchedule>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const isActive = schedule.is_active;

  return (
    <div className={cn(
      'bg-card border rounded-xl p-4 transition',
      isActive ? 'border-border' : 'border-border bg-muted/30',
      templateMissing && 'border-amber-300 bg-amber-50/40',
    )}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          isActive
            ? 'bg-reop-teal-soft text-primary'
            : 'bg-muted text-muted-foreground',
        )}>
          <Repeat className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className={cn('text-sm font-semibold leading-tight', !isActive && 'text-muted-foreground')}>
              {templateName}
            </h4>
            <span className={cn(
              'inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
              isActive
                ? 'bg-reop-teal-soft text-primary border border-primary/30'
                : 'bg-muted text-muted-foreground border border-border',
            )}>
              {isActive ? 'Active' : 'Paused'}
            </span>
            <span className="inline-flex items-center text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {RECURRENCE_LABEL[schedule.recurrence]}
            </span>
            {templateMissing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                <AlertCircle className="w-2.5 h-2.5" />
                Template deleted
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {describeSchedule(schedule)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
            {schedule.next_send_at && isActive && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Next: {format(parseISO(schedule.next_send_at), 'EEE, MMM d · h:mm a')}
              </span>
            )}
            {schedule.last_sent_at && (
              <span className="inline-flex items-center gap-1 text-reop-green">
                <CheckCircle2 className="w-3 h-3" />
                Last sent: {format(parseISO(schedule.last_sent_at), 'MMM d')}
              </span>
            )}
            <span>Subject: {schedule.subject || '(empty)'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePause}
            className="gap-1.5 h-8"
          >
            {isActive ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Resume
              </>
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(true)} aria-label="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-700" onClick={onDelete} aria-label="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {editing && (
        <ScheduleDialog
          open={editing}
          onOpenChange={setEditing}
          initial={schedule}
          onSubmit={async (input) => {
            await onEdit({
              template_id: input.template_id,
              subject: input.subject,
              sender_name: input.sender_name,
              recurrence: input.recurrence,
              recurrence_day: input.recurrence_day,
              recurrence_hour: input.recurrence_hour,
            });
            toast.success('Schedule updated');
          }}
        />
      )}
    </div>
  );
}

function ScheduleDialog({
  open, onOpenChange, onSubmit, initial, templates,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: NewSchedule) => Promise<void>;
  initial?: NewsletterSchedule;
  templates?: { id: string; name: string }[];
}) {
  const [templateId, setTemplateId] = useState(initial?.template_id ?? templates?.[0]?.id ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>((initial?.recurrence ?? 'monthly') as Recurrence);
  const [recurrenceDay, setRecurrenceDay] = useState(initial?.recurrence_day ?? 15);
  const [recurrenceHour, setRecurrenceHour] = useState(initial?.recurrence_hour ?? 10);
  const [submitting, setSubmitting] = useState(false);

  const isWeekly = recurrence === 'weekly' || recurrence === 'biweekly';

  const handleSubmit = async () => {
    if (!templateId) {
      toast.error('Pick a template');
      return;
    }
    if (!subject.trim()) {
      toast.error('Add a subject line');
      return;
    }
    setSubmitting(true);
    try {
      // Snap day to valid range when frequency changes (e.g. switching from
      // monthly day=15 to weekly day=15 → coerce to 0-6).
      let day = recurrenceDay;
      if (isWeekly) day = Math.max(0, Math.min(6, day));
      else day = Math.max(1, Math.min(31, day));

      await onSubmit({
        template_id: templateId,
        subject: subject.trim(),
        recurrence,
        recurrence_day: day,
        recurrence_hour: recurrenceHour,
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save schedule';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit recurring schedule' : 'New recurring schedule'}</DialogTitle>
          <DialogDescription>
            Pick a template, choose how often it sends, and we'll handle the rest. Pause anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template */}
          <div>
            <Label htmlFor="sched-template" className="text-xs text-muted-foreground mb-1.5 block">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="sched-template" className="h-9">
                <SelectValue placeholder="Pick a template…" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
                {templates && templates.length === 0 && (
                  <SelectItem value="__none" disabled>No templates yet</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="sched-subject" className="text-xs text-muted-foreground mb-1.5 block">Subject line</Label>
            <Input
              id="sched-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your monthly market update"
            />
          </div>

          {/* Frequency + day + hour */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Frequency</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                  <SelectItem value="monthly">Every month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {isWeekly ? 'Day of week' : 'Day of month'}
              </Label>
              {isWeekly ? (
                <Select value={String(recurrenceDay)} onValueChange={(v) => setRecurrenceDay(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={recurrenceDay}
                  onChange={(e) => setRecurrenceDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                  className="h-9"
                />
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Hour (UTC)</Label>
              <Select value={String(recurrenceHour)} onValueChange={(v) => setRecurrenceHour(Number(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, '0')}:00 UTC
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">
            Times are in UTC. {isWeekly ? 'Weekly' : 'Monthly'} sends fire on the schedule above; you can pause from the list.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            <X className="w-3.5 h-3.5 mr-1.5" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {submitting ? 'Saving…' : (initial ? 'Save changes' : 'Create schedule')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

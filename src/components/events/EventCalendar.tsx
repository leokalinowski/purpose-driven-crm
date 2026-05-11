/**
 * EventCalendar — month grid showing events + their tasks color-coded by
 * status: green = done, neutral = to-do, red = overdue.
 *
 * Phase 3 of the Events comprehensive sweep. The previous Events page only
 * had a tiny side calendar with a dot for each event day; agents had no way
 * to see "what's on my plate this month" at a glance. This component fixes
 * that and is intended to be rendered in a Calendar tab on the Events page.
 *
 * Design choices:
 *   - Self-rolled 7-column grid (not FullCalendar / react-big-calendar) —
 *     ~150 lines of logic, exactly the features described, no 80KB+ dep.
 *   - Each cell shows up to 1 event chip + up to 3 task badges. Overflow
 *     surfaces a "+N" chip; clicking the cell opens a side panel with the
 *     full day breakdown.
 *   - On mobile (md-) the grid collapses to a vertical agenda list grouped
 *     by date. Trying to render 7 columns at 375px breaks readability.
 *   - Events display the event TITLE (truncated). Tasks display the TASK
 *     name (truncated). Both link to the relevant detail page.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, X,
  CheckCircle2, Circle, AlertCircle, MapPin, Clock,
} from 'lucide-react';
import { format, parseISO, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { Event as Ev, EventTask } from '@/hooks/useEvents';

interface EventCalendarProps {
  events: Ev[];
  tasks: EventTask[];
  onTaskToggle?: (task: EventTask) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Internal task-status discriminator used by the badges + side panel. */
type TaskStatusBucket = 'done' | 'overdue' | 'todo';

function statusFor(t: EventTask): TaskStatusBucket {
  if (t.status === 'completed' || t.completed_at) return 'done';
  if (t.due_date) {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (new Date(t.due_date) < todayMidnight) return 'overdue';
  }
  return 'todo';
}

const STATUS_DOT: Record<TaskStatusBucket, string> = {
  done: 'bg-reop-green',
  overdue: 'bg-red-500',
  todo: 'bg-muted-foreground/40',
};

const STATUS_TEXT: Record<TaskStatusBucket, string> = {
  done: 'text-reop-green line-through',
  overdue: 'text-red-700',
  todo: 'text-foreground',
};

const STATUS_BADGE: Record<TaskStatusBucket, string> = {
  done: 'bg-[hsl(140_50%_94%)] text-[hsl(140_50%_30%)]',
  overdue: 'bg-red-50 text-red-700 border border-red-200',
  todo: 'bg-muted/70 text-foreground',
};

export function EventCalendar({ events, tasks, onTaskToggle }: EventCalendarProps) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Group events + tasks by ISO date string (YYYY-MM-DD) for O(1) day lookup.
  const byDay = useMemo(() => {
    const map = new Map<string, { events: Ev[]; tasks: EventTask[] }>();
    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { events: [], tasks: [] });
      return map.get(key)!;
    };
    for (const e of events) {
      const key = e.event_date.slice(0, 10); // 'YYYY-MM-DDTHH...' → 'YYYY-MM-DD'
      ensure(key).events.push(e);
    }
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      ensure(key).tasks.push(t);
    }
    return map;
  }, [events, tasks]);

  const monthStart = startOfMonth(new Date(cursor.year, cursor.month, 1));
  const monthEnd = endOfMonth(monthStart);

  // Pad to fill complete weeks. JS Date.getDay() returns 0=Sun.
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const goPrev = () =>
    setCursor(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  const goNext = () =>
    setCursor(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));
  const goToday = () => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Selected day → side panel content. Pulled from the same `byDay` map.
  const selectedDayKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedDayContent = selectedDayKey ? byDay.get(selectedDayKey) : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            className="h-8 w-8 p-0"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold tracking-tight min-w-[180px] text-center">
            {MONTHS_FULL[cursor.month]} {cursor.year}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            className="h-8 w-8 p-0"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="h-8 text-xs ml-1"
          >
            Today
          </Button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <LegendItem className="bg-reop-green" label="Done" />
          <LegendItem className="bg-muted-foreground/40" label="To do" />
          <LegendItem className="bg-red-500" label="Overdue" />
          <LegendItem className="bg-primary" label="Event" hollow />
        </div>
      </div>

      {/* Desktop month grid */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-[10px] uppercase tracking-[0.05em] font-semibold text-muted-foreground text-center py-2"
            >
              {d}
            </div>
          ))}
        </div>
        {/* Days */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayContent = byDay.get(key);
            const isOtherMonth = !isSameMonth(day, monthStart);
            const isCurrentDay = isToday(day);
            const dayEvents = dayContent?.events ?? [];
            const dayTasks = dayContent?.tasks ?? [];
            const visibleTasks = dayTasks.slice(0, 3);
            const hiddenTaskCount = dayTasks.length - visibleTasks.length;

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'group relative min-h-[100px] p-1.5 border-b border-r border-border text-left transition cursor-pointer hover:bg-muted/30',
                  // Last column has no right border
                  (i + 1) % 7 === 0 && 'border-r-0',
                  // Last row has no bottom border
                  i >= days.length - 7 && 'border-b-0',
                  isOtherMonth && 'bg-muted/20',
                )}
              >
                {/* Date number + today highlight */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center text-xs font-semibold w-6 h-6 rounded-full',
                      isOtherMonth && 'text-muted-foreground/50 font-normal',
                      isCurrentDay && 'bg-reop-dark-blue text-white',
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* Event chip(s) — at most 1 inline; rest go to the day panel */}
                {dayEvents.slice(0, 1).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); navigate(`/events/${ev.id}`); }}
                    className="text-[10.5px] font-semibold truncate px-1.5 py-0.5 rounded mb-0.5 bg-reop-teal-soft text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground transition cursor-pointer"
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 1 && (
                  <div className="text-[10px] text-primary font-semibold px-1 mb-0.5">
                    +{dayEvents.length - 1} more event{dayEvents.length - 1 > 1 ? 's' : ''}
                  </div>
                )}

                {/* Tasks — small badges, color by status */}
                <div className="space-y-0.5">
                  {visibleTasks.map((t) => {
                    const s = statusFor(t);
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          'flex items-center gap-1 text-[10px] px-1 py-0.5 rounded truncate',
                          STATUS_BADGE[s],
                        )}
                        title={t.task_name}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_DOT[s])} />
                        <span className="truncate">{t.task_name}</span>
                      </div>
                    );
                  })}
                  {hiddenTaskCount > 0 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{hiddenTaskCount} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile agenda — vertical list grouped by day. Easier to scan on
          a phone than a 7-col grid. Shows only days that actually have
          events or tasks. */}
      <div className="md:hidden space-y-3">
        {/* Weekday strip on mobile is too noisy; just show date + content. */}
        {days
          .filter((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const c = byDay.get(key);
            const inMonth = isSameMonth(day, monthStart);
            return inMonth && c && (c.events.length > 0 || c.tasks.length > 0);
          })
          .map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const c = byDay.get(key)!;
            return (
              <button
                key={key}
                onClick={() => setSelectedDay(day)}
                className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary transition"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                      {WEEKDAY_LABELS[day.getDay()]}
                    </div>
                    <div className={cn(
                      'text-xl font-medium tracking-tight',
                      isToday(day) && 'text-primary',
                    )}>
                      {format(day, 'MMM d')}
                    </div>
                  </div>
                  {isToday(day) && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-reop-dark-blue text-white">
                      Today
                    </span>
                  )}
                </div>
                {c.events.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); navigate(`/events/${ev.id}`); }}
                    className="text-sm font-semibold mb-1 px-2 py-1 rounded bg-reop-teal-soft text-primary inline-block"
                  >
                    {ev.title}
                  </div>
                ))}
                <div className="space-y-1 mt-1">
                  {c.tasks.map((t) => {
                    const s = statusFor(t);
                    return (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[s])} />
                        <span className={cn('truncate', s === 'done' && 'line-through opacity-60')}>
                          {t.task_name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        {days.filter((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const c = byDay.get(key);
          return isSameMonth(day, monthStart) && c && (c.events.length > 0 || c.tasks.length > 0);
        }).length === 0 && (
          <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
            <CalendarIcon className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nothing scheduled in {MONTHS_FULL[cursor.month]} {cursor.year}.
            </p>
          </div>
        )}
      </div>

      {/* Day-detail side panel */}
      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col" side="right">
          {selectedDay && (
            <>
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    {format(selectedDay, 'EEEE')}
                    {isToday(selectedDay) && <span className="ml-2 text-primary">· Today</span>}
                  </p>
                  <h2 className="text-xl font-medium tracking-tight">
                    {format(selectedDay, 'MMMM d, yyyy')}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedDay(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                {/* Events */}
                {selectedDayContent?.events.length ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Events ({selectedDayContent.events.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedDayContent.events.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => { setSelectedDay(null); navigate(`/events/${ev.id}`); }}
                          className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-primary transition"
                        >
                          <div className="font-semibold text-sm mb-1">{ev.title}</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(parseISO(ev.event_date), 'h:mm a')}
                            </span>
                            {ev.location && (
                              <span className="inline-flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3" />
                                {ev.location}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Tasks — grouped by status, click toggles complete via the
                    optional `onTaskToggle` callback the parent page provides. */}
                {selectedDayContent?.tasks.length ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Tasks ({selectedDayContent.tasks.length})
                    </h3>
                    <div className="space-y-1.5">
                      {selectedDayContent.tasks
                        .slice()
                        .sort((a, b) => {
                          // Order: overdue first, then to-do, then done.
                          const order: Record<TaskStatusBucket, number> = { overdue: 0, todo: 1, done: 2 };
                          return order[statusFor(a)] - order[statusFor(b)];
                        })
                        .map((t) => {
                          const s = statusFor(t);
                          return (
                            <button
                              key={t.id}
                              onClick={() => onTaskToggle?.(t)}
                              disabled={!onTaskToggle}
                              className={cn(
                                'w-full text-left flex items-start gap-2 py-2 px-2 rounded transition',
                                onTaskToggle && 'hover:bg-muted/50 cursor-pointer',
                                !onTaskToggle && 'cursor-default',
                              )}
                            >
                              {s === 'done' && <CheckCircle2 className="w-4 h-4 text-reop-green flex-shrink-0 mt-0.5" />}
                              {s === 'overdue' && <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />}
                              {s === 'todo' && <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                              <div className="min-w-0 flex-1">
                                <div className={cn('text-sm', STATUS_TEXT[s])}>{t.task_name}</div>
                                {t.responsible_person && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {t.responsible_person}
                                    {t.phase && ` · ${formatPhase(t.phase)}`}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ) : null}

                {!selectedDayContent?.events.length && !selectedDayContent?.tasks.length && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nothing scheduled this day.
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LegendItem({ className, label, hollow }: { className: string; label: string; hollow?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          hollow ? 'border-2 border-primary bg-transparent' : className,
        )}
      />
      {label}
    </span>
  );
}

function formatPhase(phase: string): string {
  const map: Record<string, string> = {
    pre_event: 'Pre-event',
    event_day: 'Event day',
    post_event: 'Post-event',
  };
  return map[phase] ?? phase.replace(/_/g, ' ');
}

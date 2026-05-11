import { useMemo, useState } from 'react';
import { CalendarClock, Phone, MessageSquare, Share2, UserPlus, Calendar, ListChecks, Sparkles, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, format, isSameDay, isAfter, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSphereSyncTasks, type SphereSyncTask } from '@/hooks/useSphereSyncTasks';
import { useDashboardBlocks } from '@/hooks/useDashboardBlocks';
import { useContactSheet } from '../ContactSheetProvider';
import { useConversationStarter } from '@/components/comm/ConversationStarterProvider';
import { buildWeekOptions, SPHERESYNC_CALLS, SPHERESYNC_TEXTS } from '@/utils/sphereSyncLogic';

// REOP weekly cadence defaults — these are the playbook targets for any agent
// without a custom goal set yet. Calls + texts come from the SphereSync letter
// rotation (real, per-week list), so those targets ARE that list's length.
// Appts / new contacts / social are fixed REOP defaults.
const REOP_DEFAULT_TARGETS = {
  appts: 3,
  newContacts: 3,
  social: 4,
} as const;

type Goal = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  current: number;
  target: number;
  helper: string;
  done?: boolean;
  warn?: boolean;
};

type DayHeat = 'today' | 'past-empty' | 'past-low' | 'past-mid' | 'past-high' | 'future';
type Day = { dow: string; value: string; tone: DayHeat; isToday: boolean };

function helperFor(current: number, target: number): { text: string; warn?: boolean; done?: boolean } {
  if (target === 0) return { text: 'No target this week' };
  if (current >= target) return { text: 'Complete ✓', done: true };
  const remaining = target - current;
  // Neutral phrasing — no guilt-trip, just status. Bars carry the visual signal.
  return { text: `${remaining} to go`, warn: current === 0 };
}

function GoalBar({ g }: { g: Goal }) {
  const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
  const valueColor = g.warn ? 'hsl(35 80% 38%)' : 'var(--primary)';
  const barFill = g.warn ? 'hsl(35 80% 55%)' : g.done ? 'hsl(140 50% 50%)' : 'hsl(184 100% 34%)';
  return (
    <div>
      <div className="flex justify-between text-[12.5px] mb-1.5">
        <span className="font-semibold inline-flex items-center gap-1.5">
          <g.icon className="w-[13px] h-[13px] text-primary" />
          {g.label}
        </span>
        <span className="font-bold" style={{ color: valueColor }}>
          {g.current} <span className="font-normal text-muted-foreground">/ {g.target}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[hsl(210_20%_94%)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barFill }} />
      </div>
      <div
        className="text-[11px] mt-1"
        style={{ color: g.done ? 'hsl(142 55% 28%)' : 'var(--muted-foreground)', fontWeight: g.done ? 600 : 400 }}
      >
        {g.helper}
      </div>
    </div>
  );
}

function DayCell({ d }: { d: Day }) {
  // Heatmap palette: intensity scales with touch volume. Today is the dark
  // anchor; future days are flat gray. The cell value is ALWAYS the count
  // (0 → "—", >0 → number) so the box is never visually empty.
  const styles: Record<DayHeat, { bg: string; color: string }> = {
    'today':      { bg: 'hsl(184 100% 34%)',  color: 'white' },             // dark teal
    'past-high':  { bg: 'hsl(142 50% 70%)',   color: 'hsl(142 55% 18%)' },  // saturated green
    'past-mid':   { bg: 'hsl(142 45% 84%)',   color: 'hsl(142 55% 24%)' },  // medium green
    'past-low':   { bg: 'hsl(142 40% 92%)',   color: 'hsl(142 55% 28%)' },  // light green
    'past-empty': { bg: 'hsl(210 20% 96%)',   color: 'hsl(215 16% 60%)' },  // very light gray
    'future':     { bg: 'hsl(210 20% 96%)',   color: 'hsl(215 16% 60%)' },
  };
  const s = styles[d.tone];
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-[0.07em] text-muted-foreground font-bold mb-1.5">
        {d.isToday ? 'Today' : d.dow}
      </div>
      <div
        className="rounded-lg py-2 px-1 text-[13px] font-bold"
        style={{ background: s.bg, color: s.color }}
      >
        {d.value}
      </div>
    </div>
  );
}

function getInitials(t: SphereSyncTask): string {
  const f = t.lead.first_name?.trim();
  const l = t.lead.last_name?.trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  return '··';
}

function fullName(t: SphereSyncTask): string {
  const f = t.lead.first_name?.trim() ?? '';
  const l = t.lead.last_name?.trim() ?? '';
  return [f, l].filter(Boolean).join(' ') || 'Unknown contact';
}

function TaskRow({
  task,
  onToggle,
  onOpen,
}: {
  task: SphereSyncTask;
  onToggle: (id: string, completed: boolean) => void;
  onOpen: (task: SphereSyncTask) => void;
}) {
  const { openStarter } = useConversationStarter();
  const done = task.completed;
  const isCall = task.task_type === 'call';
  const phone = task.lead.phone;
  const dnc = task.lead.dnc;
  const PrimaryIcon = isCall ? Phone : MessageSquare;
  const primaryLabel = isCall ? 'Call' : 'Text';
  const primaryChannel: 'call' | 'text' = isCall ? 'call' : 'text';

  // DNC is informational for sphere contacts — surfaced via the badge in the
  // row + a banner inside the conversation modal. We don't block the action.
  const handleStart = () => {
    if (!phone) return;
    openStarter(primaryChannel, {
      id: task.lead_id,
      first_name: task.lead.first_name,
      last_name: task.lead.last_name,
      phone: task.lead.phone,
      email: task.lead.email,
      dnc: task.lead.dnc,
    });
  };

  return (
    <div
      className={cn(
        'grid items-center gap-3 px-4 sm:px-5 py-3 border-b border-border last:border-b-0 transition-colors',
        'grid-cols-[20px_34px_1fr_auto] hover:bg-[hsl(210_20%_98.5%)]',
        'max-sm:grid-cols-[20px_1fr_auto] max-sm:gap-y-1.5',
      )}
    >
      <button
        onClick={() => onToggle(task.id, !done)}
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        className={cn(
          'w-5 h-5 border-[1.5px] rounded-md flex items-center justify-center transition-all',
          done ? 'bg-primary border-primary' : 'bg-white border-border hover:border-primary',
        )}
      >
        {done && (
          <span className="block w-2.5 h-1.5 border-l-2 border-b-2 border-white rotate-[-45deg] -translate-y-px translate-x-px" />
        )}
      </button>

      <div className="max-sm:hidden">
        <div className="w-[34px] h-[34px] rounded-full bg-reop-teal-soft text-primary flex items-center justify-center font-bold text-[11.5px] shrink-0">
          {getInitials(task)}
        </div>
      </div>

      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onOpen(task)}
            className={cn(
              'text-sm font-semibold text-left text-reop-dark-blue hover:text-primary hover:underline underline-offset-2 transition',
              done && 'opacity-55 line-through',
            )}
          >
            {fullName(task)}
          </button>
          <span className="inline-flex items-center px-1.5 py-px rounded-full bg-[hsl(210_20%_94%)] text-[10px] font-semibold text-muted-foreground tracking-wide">
            {task.lead.category || '·'}
          </span>
          {dnc && (
            <span className="inline-flex items-center px-1.5 py-px rounded-full bg-[hsl(0_84%_95%)] text-[10px] font-semibold text-[hsl(0_84%_40%)]">
              DNC
            </span>
          )}
        </div>
        <div className={cn('text-xs text-muted-foreground leading-[1.4]', done && 'opacity-55 line-through')}>
          {phone ?? 'No phone on file'}
        </div>
        {task.ai_reason && !done && (
          <div className="inline-flex items-start gap-1.5 text-xs text-primary font-medium mt-0.5">
            <Sparkles className="w-3 h-3 mt-px shrink-0" />
            <span className="line-clamp-2">{task.ai_reason}</span>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 max-sm:col-span-full max-sm:justify-end">
        <button
          type="button"
          onClick={handleStart}
          disabled={!phone}
          title={dnc ? `${primaryLabel} ${fullName(task)} (DNC — sphere outreach OK under EBR)` : primaryLabel}
          className="inline-flex items-center gap-1.5 h-[40px] px-3 rounded-lg border border-border bg-card text-[12.5px] font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PrimaryIcon className="w-[14px] h-[14px]" />
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

function WeeklyCallTextList({
  callTasks,
  textTasks,
  loading,
  updateTask,
}: {
  callTasks: SphereSyncTask[];
  textTasks: SphereSyncTask[];
  loading: boolean;
  updateTask: (id: string, patch: Partial<SphereSyncTask>) => void;
}) {
  const { openContact } = useContactSheet();
  const [mode, setMode] = useState<'call' | 'text'>('call');

  const items = mode === 'call' ? callTasks : textTasks;
  const completedCount = items.filter((t) => t.completed).length;

  const handleToggle = (id: string, completed: boolean) => {
    updateTask(id, { completed });
  };

  return (
    <section className="bg-card border border-border rounded-xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap p-5 pb-3 border-b border-border">
        <h3 className="m-0 text-base font-semibold inline-flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-primary" />
          This week&apos;s call &amp; text list
        </h3>
        <div className="inline-flex gap-0.5 rounded-[9px] bg-[hsl(210_20%_94%)] p-[3px]" role="tablist">
          {(['call', 'text'] as const).map((m) => {
            const count = m === 'call' ? callTasks.length : textTasks.length;
            const active = mode === m;
            const Icon = m === 'call' ? Phone : MessageSquare;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={active}
                onClick={() => setMode(m)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-[6px] rounded-[7px] text-[12.5px] transition-all',
                  active
                    ? 'bg-card text-reop-dark-blue font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-muted-foreground hover:text-reop-dark-blue font-medium',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {m === 'call' ? 'Calls' : 'Texts'}
                <span
                  className={cn(
                    'ml-0.5 inline-flex items-center px-1.5 rounded-full text-[10px] font-semibold',
                    active ? 'bg-reop-teal-soft text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!loading && items.length > 0 && (
        <div className="px-5 py-2.5 text-[11.5px] text-muted-foreground border-b border-border bg-[hsl(210_20%_98%)]">
          {completedCount} of {items.length} {mode === 'call' ? 'calls' : 'texts'} done this week
        </div>
      )}

      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">
          Loading {mode === 'call' ? 'calls' : 'texts'}…
        </div>
      ) : items.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          No {mode === 'call' ? 'calls' : 'texts'} scheduled for this week. They&apos;ll appear when your contacts&apos;
          last-name letters come up in the rotation.
        </div>
      ) : (
        <div>
          {items.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onOpen={(t) => openContact(t.lead_id, { task: t })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface WeekCounts {
  perDay: Record<string, number>;
  appointmentsThisWeek: number;
  newContactsThisWeek: number;
  socialPostsThisWeek: number;
}

function useThisWeekActivityCounts() {
  const { user } = useAuth();
  const wStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const wEnd = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 1 }), []);

  return useQuery<WeekCounts>({
    queryKey: ['cadence-week-counts', user?.id, format(wStart, 'yyyy-MM-dd')],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      // Run the queries in parallel — they're all RLS-bounded by agent_id.
      // NOTE: social_posts table was Postiz-era and is gone. The Metricool-
      // backed social hub has its own counts; this tab no longer surfaces
      // a "social posts this week" stat.
      const [actsRes, apptRes, contactRes] = await Promise.all([
        supabase
          .from('contact_activities')
          .select('activity_date')
          .eq('agent_id', user!.id)
          .in('activity_type', ['call', 'text'])
          .gte('activity_date', wStart.toISOString())
          .lte('activity_date', wEnd.toISOString()),
        supabase
          .from('contact_activities')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', user!.id)
          .eq('activity_type', 'meeting')
          .gte('activity_date', wStart.toISOString())
          .lte('activity_date', wEnd.toISOString()),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', user!.id)
          .gte('created_at', wStart.toISOString())
          .lte('created_at', wEnd.toISOString()),
      ]);

      if (actsRes.error) throw actsRes.error;

      const byDay: Record<string, number> = {};
      (actsRes.data ?? []).forEach((a: { activity_date: string | null }) => {
        if (!a.activity_date) return;
        const key = format(new Date(a.activity_date), 'yyyy-MM-dd');
        byDay[key] = (byDay[key] ?? 0) + 1;
      });

      return {
        perDay: byDay,
        appointmentsThisWeek: apptRes.count ?? 0,
        newContactsThisWeek: contactRes.count ?? 0,
        socialPostsThisWeek: 0,
      };
    },
  });
}

export function CadenceTab() {
  const { callTasks, textTasks, loading: tasksLoading, updateTask, currentWeek, selectedWeek, loadTasksForWeek } = useSphereSyncTasks();
  const { data: dashboard } = useDashboardBlocks();
  const { data: counts } = useThisWeekActivityCounts();
  const weekOptions = useMemo(() => buildWeekOptions(new Date()), []);
  const selectedWeekValue = String(selectedWeek?.weekNumber ?? currentWeek.weekNumber);
  const isCurrentWeek = (selectedWeek?.weekNumber ?? currentWeek.weekNumber) === currentWeek.weekNumber;
  const handleWeekChange = (value: string) => {
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return;
    const opt = weekOptions.find((o) => o.value === value);
    loadTasksForWeek(num, opt?.year ?? currentWeek.isoYear);
  };

  // Stabilize the perDay reference so the useMemo deps below don't churn.
  const perDay = useMemo(() => counts?.perDay ?? {}, [counts?.perDay]);
  const appointmentsThisWeek = counts?.appointmentsThisWeek ?? 0;
  const newContactsThisWeek = counts?.newContactsThisWeek ?? 0;
  const socialPostsThisWeek = counts?.socialPostsThisWeek ?? 0;

  // Goals — calls/texts come from the rotation (real); appts/social/new
  // contacts use REOP playbook defaults (a fixed weekly bar that doesn't
  // slide up as you log).
  const goals: Goal[] = useMemo(() => {
    const callsDone = callTasks.filter((t) => t.completed).length;
    const callsTarget = callTasks.length;
    const textsDone = textTasks.filter((t) => t.completed).length;
    const textsTarget = textTasks.length;

    const callsHelper = helperFor(callsDone, callsTarget);
    const textsHelper = helperFor(textsDone, textsTarget);
    const apptsHelper = helperFor(appointmentsThisWeek, REOP_DEFAULT_TARGETS.appts);
    const socialHelper = helperFor(socialPostsThisWeek, REOP_DEFAULT_TARGETS.social);
    const newContactsHelper = helperFor(newContactsThisWeek, REOP_DEFAULT_TARGETS.newContacts);

    return [
      { key: 'calls', label: 'Calls', icon: Phone, current: callsDone, target: callsTarget, helper: callsHelper.text, done: callsHelper.done, warn: callsHelper.warn },
      { key: 'texts', label: 'Texts', icon: MessageSquare, current: textsDone, target: textsTarget, helper: textsHelper.text, done: textsHelper.done, warn: textsHelper.warn },
      { key: 'appts', label: 'Appts set', icon: Calendar, current: appointmentsThisWeek, target: REOP_DEFAULT_TARGETS.appts, helper: apptsHelper.text, done: apptsHelper.done, warn: apptsHelper.warn },
      { key: 'newcontacts', label: 'New contacts', icon: UserPlus, current: newContactsThisWeek, target: REOP_DEFAULT_TARGETS.newContacts, helper: newContactsHelper.text, done: newContactsHelper.done, warn: newContactsHelper.warn },
      { key: 'social', label: 'Social posts', icon: Share2, current: socialPostsThisWeek, target: REOP_DEFAULT_TARGETS.social, helper: socialHelper.text, done: socialHelper.done, warn: socialHelper.warn },
    ];
  }, [callTasks, textTasks, appointmentsThisWeek, newContactsThisWeek, socialPostsThisWeek]);

  // Days — Mon..Sun heatmap for the selected week. The cell intensity reflects
  // touch volume; future days are flat gray. The cell value is ALWAYS the
  // count (or "—" when zero) so the box is never visually empty.
  const days: Day[] = useMemo(() => {
    const now = new Date();
    const wStart = startOfWeek(now, { weekStartsOn: 1 });
    const result: Day[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(wStart, i);
      const dow = format(d, 'EEE');
      const key = format(d, 'yyyy-MM-dd');
      const count = perDay[key] ?? 0;
      const isToday = isSameDay(d, now);
      const isFuture = isAfter(d, now) && !isToday;

      let tone: DayHeat;
      if (isToday) {
        tone = 'today';
      } else if (isFuture) {
        tone = 'future';
      } else if (count >= 10) {
        tone = 'past-high';
      } else if (count >= 4) {
        tone = 'past-mid';
      } else if (count >= 1) {
        tone = 'past-low';
      } else {
        tone = 'past-empty';
      }

      const value = count > 0 ? String(count) : '—';

      result.push({ dow, value, tone, isToday });
    }
    return result;
  }, [perDay]);

  const totalTouchpoints = dashboard?.blockOne.totalTouchpoints ?? 0;

  return (
    <>
    {(() => {
      // Rotation letters that drive the selected week's call + text list.
      // Surfaces the same context the Priorities tab shows in HintBar so the
      // agent never has to guess why these specific contacts are here.
      const weekNum = selectedWeek?.weekNumber ?? currentWeek.weekNumber;
      const callLetters = SPHERESYNC_CALLS[weekNum] ?? [];
      const textLetter = SPHERESYNC_TEXTS[weekNum] ?? '';
      if (callLetters.length === 0 && !textLetter) return null;
      return (
        <div
          className="flex items-center gap-3 p-3 px-4 rounded-[10px] border mb-4 text-sm flex-wrap"
          style={{ background: 'hsl(184 100% 97%)', borderColor: 'hsl(184 50% 85%)' }}
        >
          <Info className="w-4 h-4 text-primary shrink-0" />
          <div className="leading-[1.5]">
            <b className="font-semibold">Week {weekNum} rotation:</b>{' '}
            calling last names <b className="text-primary">{callLetters.join(', ')}</b>
            {textLetter && <>, texting <b className="text-primary">{textLetter}</b></>}.
          </div>
          <div className="flex gap-1 ml-auto flex-wrap">
            {callLetters.map((l) => (
              <div
                key={l}
                className="w-[26px] h-[26px] rounded-md bg-card border flex items-center justify-center font-bold text-[13px] text-primary"
                style={{ borderColor: 'hsl(184 50% 80%)' }}
              >
                {l}
              </div>
            ))}
            {textLetter && (
              <div className="w-[26px] h-[26px] rounded-md bg-reop-green text-white border-reop-green border flex items-center justify-center font-bold text-[13px]">
                {textLetter}
              </div>
            )}
          </div>
        </div>
      );
    })()}

    {/* Week picker — lets the agent rewind 3 weeks to follow up with contacts
        they couldn't reach. Defaults to the current week. The cadence tiles +
        call/text list below all reflect whichever week is selected. */}
    <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <span>Showing week:</span>
        <select
          value={selectedWeekValue}
          onChange={(e) => handleWeekChange(e.target.value)}
          className="h-9 px-2.5 rounded-md border border-border bg-card text-[12.5px] text-reop-dark-blue font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Showing week"
        >
          {weekOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {!isCurrentWeek && (
        <button
          type="button"
          onClick={() => loadTasksForWeek(currentWeek.weekNumber, currentWeek.isoYear)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold text-primary hover:bg-reop-teal-soft transition"
        >
          ← Back to this week
        </button>
      )}
    </div>

    <section className="bg-card border border-border rounded-xl mb-6">
      <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
        <h3 className="m-0 text-base font-semibold inline-flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          {isCurrentWeek ? 'This week’s cadence' : `Week ${selectedWeekValue} cadence`}
        </h3>
      </div>

      <div className="p-5 pt-4">
        <div
          className="grid gap-4 mb-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
        >
          {goals.map((g) => (
            <GoalBar key={g.key} g={g} />
          ))}
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-[11px] uppercase tracking-[0.06em] font-bold text-muted-foreground">
              Day-by-day this week
            </div>
            <div className="text-[11px] text-muted-foreground">
              {totalTouchpoints} total touchpoints this week
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => (
              <DayCell key={d.dow} d={d} />
            ))}
          </div>
        </div>
      </div>
    </section>
    <WeeklyCallTextList
      callTasks={callTasks}
      textTasks={textTasks}
      loading={tasksLoading}
      updateTask={updateTask}
    />
    </>
  );
}

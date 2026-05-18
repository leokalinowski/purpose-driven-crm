import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Phone, MessageSquare, Mail, ListOrdered,
  ClipboardList, RefreshCw, Loader2, Check,
} from 'lucide-react';
import { WeekHintBar } from '../WeekHintBar';
import { addDays, format, isSameDay, startOfWeek, endOfWeek, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCoachingState } from '@/hooks/useCoachingState';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { useDashboardBlocks } from '@/hooks/useDashboardBlocks';
import { usePrioritizedQueue, type QueueItem } from '@/hooks/usePrioritizedQueue';
import { useContactSheet } from '../ContactSheetProvider';
import { useConversationStarter } from '@/components/comm/ConversationStarterProvider';
import type { CommContact } from '@/lib/comm';
import { SPHERESYNC_CALLS, SPHERESYNC_TEXTS } from '@/utils/sphereSyncLogic';
import { toast } from 'sonner';

function getInitials(name: string | null | undefined): string {
  if (!name) return '··';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-[34px] h-[34px] text-[11.5px]',
    lg: 'w-12 h-12 text-[15px]',
  };
  return (
    <div className={cn('rounded-full bg-reop-teal-soft text-primary flex items-center justify-center font-bold shrink-0', sizes[size])}>
      {initials}
    </div>
  );
}

// ─── Coach trust strip — generated_at + model + manual refresh ───────────────

function CoachTrustBar() {
  const { user } = useAuth();
  const { state, refetch } = useCoachingState();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('ai-coach-agent', {
        body: { agent_id: user.id, force: true },
      });
      if (error) throw error;
      await refetch();
      toast.success('Coach refreshed');
    } catch (err) {
      toast.error('Could not refresh Coach', {
        description: err instanceof Error ? err.message : 'Try again in a minute.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const generated = state?.generated_at ? new Date(state.generated_at) : null;
  const relative = generated ? formatDistanceToNow(generated, { addSuffix: true }) : null;

  return (
    <div className="flex items-center justify-between gap-3 mb-3 text-[11.5px] text-muted-foreground flex-wrap">
      <div className="inline-flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-primary" />
        <span>
          Coach{' '}
          {generated ? (
            <>
              updated <b className="text-reop-dark-blue font-semibold">{relative}</b>
            </>
          ) : (
            <span>has not run yet</span>
          )}
        </span>
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md border border-border bg-card text-[11.5px] font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition disabled:opacity-60"
      >
        {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

// ─── FocusCard helpers ───────────────────────────────────────────────────────
//
// The FocusCard reads the top of the deterministic priority queue
// (queue.all[0]) — same scorer the Database page and SignalsView use.
// The headline reasoning sentence comes from the DB column the scorer
// writes (`item.reason`), so every surface tells the agent the same story.
// "Why now" bullets are the queue item's context chips + a relative
// last-touched marker; no re-derivation, no AI call.

function buildFocusBullets(item: QueueItem): string[] {
  const days = item.last_activity_date
    ? Math.max(0, Math.round((Date.now() - new Date(item.last_activity_date).getTime()) / 86400_000))
    : null;
  const out: string[] = [...item.context_chips];
  if (days === null) out.push('No logged touches yet');
  else if (days === 0) out.push('Last touched today');
  else out.push(`Last touched ${days}d ago`);
  return out;
}

function FocusCard() {
  const { user } = useAuth();
  const { openContact } = useContactSheet();
  const { openStarter } = useConversationStarter();
  const queue = usePrioritizedQueue();

  // Pick the first contact the agent HASN'T touched yet this week. That's
  // the "next thing to do." Falls back to queue.all[0] only when everything
  // on the list has already been touched — at which point there's nothing
  // new to highlight, so we show the highest-priority one as a stale focus.
  const focus = queue.all.find((i) => !i.touched_this_week) ?? queue.all[0] ?? null;

  if (queue.loading) {
    return (
      <div className="bg-card border border-border rounded-[14px] p-7 md:p-[28px_30px] text-sm text-muted-foreground">
        Loading priorities…
      </div>
    );
  }

  if (!focus) {
    return (
      <div className="bg-card border border-border rounded-[14px] p-7 md:p-[28px_30px]">
        <span className="eye-label inline-flex items-center gap-1.5 mb-3.5">
          <Sparkles className="w-[13px] h-[13px]" />
          Top of your queue
        </span>
        <h2 className="text-[clamp(1.5rem,2vw+0.5rem,1.875rem)] font-medium tracking-tighter leading-[1.2] mb-2.5">
          You&apos;re clear.
        </h2>
        <p className="text-sm text-muted-foreground leading-[1.6]">
          No active pipeline opportunities and this week&apos;s rotation has no matches in your sphere. Add an opportunity in the Pipeline or wait for the next rotation week.
        </p>
      </div>
    );
  }

  const handleAction = (channel: 'call' | 'text' | 'email') => {
    if (!user?.id) return;
    openStarter(channel, {
      id: focus.contact_id,
      first_name: focus.first_name,
      last_name: focus.last_name,
      phone: focus.phone,
      email: focus.email,
      dnc: focus.dnc,
    });
  };

  const initials = getInitials(focus.contact_name);
  const firstName = focus.first_name ?? 'this contact';
  const actionVerb = focus.primary_action === 'call' ? 'Call'
    : focus.primary_action === 'text' ? 'Text'
      : 'Email';

  // `focus.reason` comes straight from the DB column the scorer writes — the
  // same sentence shown in ContactQuickSheet's Coach insight pane. One story
  // per contact across the whole app.
  const reasoning = focus.reason || 'Top contact in your priority queue.';
  const bullets = buildFocusBullets(focus);
  const totalQueued = queue.all.length;

  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-[14px] p-7 md:p-[28px_30px]">
      <div className="absolute top-0 right-0 w-[280px] h-[280px] pointer-events-none"
        style={{ background: 'radial-gradient(circle at top right, hsl(184 100% 34% / 0.08), transparent 70%)' }} />
      <div className="relative">
        <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
          <span className="eye-label inline-flex items-center gap-1.5">
            <Sparkles className="w-[13px] h-[13px]" />
            Top of your queue · {actionVerb} {firstName} first
          </span>
          {totalQueued > 1 && (
            <span className="text-[11px] text-muted-foreground">
              · {totalQueued - 1} more below
            </span>
          )}
        </div>

        {/* Headline = the contact. Always. */}
        <h2 className="text-[clamp(1.5rem,2vw+0.5rem,1.875rem)] font-medium tracking-tighter leading-[1.15] mb-2.5">
          {focus.contact_name}
        </h2>

        {/* Plain-English reasoning derived from the band + signals. */}
        <p className="text-[15px] text-reop-dark-blue leading-[1.55] mb-5 max-w-[640px]">
          {reasoning}
        </p>

        {/* Why now — concrete signals as scannable bullets. */}
        {bullets.length > 0 && (
          <div className="mb-5">
            <div className="text-[10.5px] uppercase tracking-[0.07em] font-bold text-muted-foreground mb-2">
              Why now
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-5 m-0 p-0 list-none">
              {bullets.map((chip, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-reop-dark-blue">
                  <Check className="w-3.5 h-3.5 mt-px text-primary shrink-0" />
                  <span className="leading-[1.4]">{chip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contact card — quick-sheet shortcut. */}
        <button
          type="button"
          onClick={() => openContact(focus.contact_id)}
          className="flex gap-3.5 items-center p-4 bg-[hsl(210_20%_98%)] rounded-[10px] border border-border mb-4 w-full text-left hover:border-primary transition"
        >
          <div className="w-12 h-12 rounded-full bg-reop-teal-soft text-primary flex items-center justify-center font-bold text-[15px]">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-0.5">
              <b className="text-base">{focus.contact_name}</b>
              <span className="text-xs text-muted-foreground">
                {[focus.phone, focus.email].filter(Boolean).join(' · ') || 'No contact info on file'}
              </span>
            </div>
          </div>
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleAction('call')}
            disabled={!focus.phone}
            className="inline-flex items-center gap-1.5 h-[44px] px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="w-3.5 h-3.5" />Call {firstName}
          </button>
          <button
            onClick={() => handleAction('text')}
            disabled={!focus.phone}
            className="inline-flex items-center gap-1.5 h-[44px] px-3.5 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare className="w-3.5 h-3.5" />Text
          </button>
          <button
            onClick={() => handleAction('email')}
            disabled={!focus.email}
            className="inline-flex items-center gap-1.5 h-[44px] px-3.5 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-3.5 h-3.5" />Email
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  num,
  total,
  pct,
  remaining,
  accent,
}: {
  label: string;
  num: number;
  total: number;
  pct: number;
  remaining: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-[10px] p-4">
      <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground font-semibold mb-2">{label}</div>
      <div className="flex items-baseline gap-2 mb-2.5">
        <span className="text-[28px] font-semibold leading-none">{num}</span>
        <span className="text-[13px] text-muted-foreground">/ {total}</span>
      </div>
      <div className="h-1.5 bg-[hsl(210_20%_92%)] rounded-full overflow-hidden">
        <span
          className={cn('block h-full rounded-full transition-[width] duration-300', accent ? 'bg-reop-green' : 'bg-primary')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
        <span>{pct}% complete</span>
        <span>{remaining} remaining</span>
      </div>
    </div>
  );
}

function StreakCard({ weeks }: { weeks: number }) {
  const isFresh = weeks === 0;
  const hint = isFresh
    ? 'No streak yet. Hit 100% this week to start one.'
    : `Hit 100% this week to make it ${weeks + 1} weeks in a row.`;

  return (
    <div className="rounded-[10px] p-4 border" style={{
      background: isFresh ? 'hsl(210 20% 98%)' : 'linear-gradient(135deg, hsl(184 100% 97%), white)',
      borderColor: isFresh ? 'hsl(210 20% 88%)' : 'hsl(184 50% 85%)',
    }}>
      <div className="text-[11px] uppercase tracking-[0.05em] text-primary font-semibold mb-2">Streak</div>
      <div className="flex items-baseline gap-2 mb-2.5">
        <span className="text-[28px] font-semibold leading-none">{weeks}</span>
        <span className="text-[13px] text-muted-foreground">{weeks === 1 ? 'week 100%' : 'weeks 100%'}</span>
      </div>
      <div className="text-xs text-muted-foreground leading-[1.5]">{hint}</div>
    </div>
  );
}

function CadenceStrip() {
  const { user } = useAuth();
  const [perDay, setPerDay] = useState<Record<string, { call: number; text: number; event: number }>>({});

  useEffect(() => {
    if (!user) return;
    let active = true;
    const now = new Date();
    const wStart = startOfWeek(now, { weekStartsOn: 1 });
    const wEnd = endOfWeek(now, { weekStartsOn: 1 });

    (async () => {
      const [actsRes, eventsRes] = await Promise.all([
        supabase
          .from('contact_activities')
          .select('activity_type, activity_date')
          .eq('agent_id', user.id)
          .gte('activity_date', wStart.toISOString())
          .lte('activity_date', wEnd.toISOString()),
        supabase
          .from('events')
          .select('event_date')
          .eq('agent_id', user.id)
          .gte('event_date', wStart.toISOString().split('T')[0])
          .lte('event_date', wEnd.toISOString().split('T')[0]),
      ]);

      if (!active) return;
      const map: Record<string, { call: number; text: number; event: number }> = {};
      (actsRes.data ?? []).forEach((a: { activity_type: string; activity_date: string | null }) => {
        if (!a.activity_date) return;
        const key = format(new Date(a.activity_date), 'yyyy-MM-dd');
        map[key] = map[key] ?? { call: 0, text: 0, event: 0 };
        if (a.activity_type === 'call') map[key].call++;
        else if (a.activity_type === 'text') map[key].text++;
      });
      (eventsRes.data ?? []).forEach((e: { event_date: string | null }) => {
        if (!e.event_date) return;
        const key = format(new Date(e.event_date), 'yyyy-MM-dd');
        map[key] = map[key] ?? { call: 0, text: 0, event: 0 };
        map[key].event++;
      });
      setPerDay(map);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const days = useMemo(() => {
    const now = new Date();
    const wStart = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(wStart, i);
      const key = format(d, 'yyyy-MM-dd');
      const counts = perDay[key] ?? { call: 0, text: 0, event: 0 };
      const dots: ('call' | 'text' | 'event')[] = [];
      if (counts.call > 0) dots.push('call');
      if (counts.text > 0) dots.push('text');
      if (counts.event > 0) dots.push('event');
      return {
        key,
        dow: format(d, 'EEE'),
        dom: parseInt(format(d, 'd'), 10),
        today: isSameDay(d, now),
        dots,
      };
    });
  }, [perDay]);

  return (
    <div className="grid grid-cols-7 gap-1.5 mb-5">
      {days.map((d) => (
        <div
          key={d.key}
          className={cn(
            'rounded-lg p-2.5 text-center border',
            d.today
              ? 'bg-reop-dark-blue text-white border-reop-dark-blue'
              : 'bg-card border-border',
          )}
        >
          <div className={cn('text-[10.5px] uppercase tracking-[0.07em] font-semibold mb-1', d.today ? 'opacity-90' : 'opacity-70')}>
            {d.today ? 'Today' : d.dow}
          </div>
          <div className="text-lg font-semibold leading-none">{d.dom}</div>
          <div className="flex justify-center gap-[3px] mt-2 min-h-[6px]">
            {d.dots.map((dot, i) => (
              <span
                key={i}
                className={cn('w-[5px] h-[5px] rounded-full',
                  d.today ? 'bg-white' :
                  dot === 'call' ? 'bg-primary' :
                  dot === 'text' ? 'bg-reop-green' :
                  'bg-[hsl(35_80%_50%)]')}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PriorityQueue() {
  const { user } = useAuth();
  const { openContact } = useContactSheet();
  const { openStarter } = useConversationStarter();
  const queue = usePrioritizedQueue();

  const items = queue.all;

  const handleAction = (item: QueueItem, channel: 'call' | 'text' | 'email') => {
    if (!user?.id) return;
    openStarter(channel, {
      id: item.contact_id,
      first_name: item.first_name,
      last_name: item.last_name,
      phone: item.phone,
      email: item.email,
      dnc: item.dnc,
    });
  };

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden mb-8">
      <div className="flex justify-between items-center flex-wrap gap-3 px-5 py-4 bg-[hsl(210_20%_97%)] border-b border-border">
        <h3 className="m-0 text-base font-semibold inline-flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-primary" />
          Today&apos;s priority queue
          {items.length > 0 && (
            <span className="text-[12px] font-medium text-muted-foreground ml-1">
              {items.length}
            </span>
          )}
        </h3>
        <div className="text-[11.5px] text-muted-foreground">
          Pipeline first · then this week&apos;s rotation
        </div>
      </div>
      <div>
        {queue.loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading priorities…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground leading-[1.55]">
            <p className="font-semibold text-reop-dark-blue mb-1">No one to call right now.</p>
            <p>
              Add an active opportunity in the Pipeline or wait for this week&apos;s rotation
              ({/* Show the current rotation letters as context */}
              <RotationLetters />
              ) to surface contacts.
            </p>
          </div>
        ) : (
          items.map((item) => {
            return (
              <div key={item.contact_id} className={cn(
                'grid items-center gap-3.5 px-5 py-3.5 border-b border-border last:border-b-0 transition-colors',
                'grid-cols-[40px_1fr_auto] hover:bg-[hsl(210_20%_98.5%)]',
                'max-md:grid-cols-[1fr] max-md:gap-y-2 max-md:px-4',
              )}>
                <div className="max-md:hidden">
                  <Avatar initials={getInitials(item.contact_name)} size="md" />
                </div>
                <button
                  type="button"
                  onClick={() => openContact(item.contact_id)}
                  className="flex flex-col gap-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <b className={cn(
                      'text-sm font-semibold hover:text-primary hover:underline underline-offset-2',
                      // Touched pipeline contacts get muted name treatment so the
                      // "still on the list, but not the next thing to do" status
                      // reads at a glance.
                      item.touched_this_week && 'text-muted-foreground',
                    )}>{item.contact_name}</b>
                    {item.dnc && (
                      <span className="inline-flex items-center px-1.5 py-px rounded-full bg-[hsl(0_84%_95%)] text-[10px] font-semibold text-[hsl(0_84%_40%)]">
                        DNC
                      </span>
                    )}
                    {item.touched_this_week && (
                      // Green checkmark chip — only fires for items still in
                      // the queue after a touch (i.e., pipeline-band contacts;
                      // cadence-band touched contacts are filtered out entirely
                      // upstream).
                      <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-reop-green/15 text-[10px] font-semibold text-[hsl(142_55%_28%)]">
                        <Check className="w-3 h-3" />
                        Touched this week
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground leading-[1.4]">
                    {[item.phone, item.email].filter(Boolean).join(' · ') || 'No contact info'}
                  </div>
                  <div className="inline-flex items-start gap-1.5 text-xs text-primary font-medium mt-0.5">
                    <Sparkles className="w-3 h-3 mt-px shrink-0" />
                    <span className="line-clamp-2">{item.reason}</span>
                  </div>
                </button>
                <div className={cn(
                  'flex gap-1.5',
                  'max-md:col-span-full max-md:pt-2 max-md:border-t max-md:border-border max-md:justify-end',
                )}>
                  <button
                    onClick={() => handleAction(item, 'call')}
                    disabled={!item.phone}
                    className="w-[44px] h-[44px] rounded-lg border border-border bg-card text-reop-dark-blue flex items-center justify-center hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title={item.dnc ? `Call ${item.contact_name} (DNC — sphere outreach OK under EBR)` : 'Call'}
                    aria-label={`Call ${item.contact_name}`}
                  >
                    <Phone className="w-[16px] h-[16px]" />
                  </button>
                  <button
                    onClick={() => handleAction(item, 'text')}
                    disabled={!item.phone}
                    className="w-[44px] h-[44px] rounded-lg border border-border bg-card text-reop-dark-blue flex items-center justify-center hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title={item.dnc ? `Text ${item.contact_name} (DNC — sphere outreach OK under EBR)` : 'Text'}
                    aria-label={`Text ${item.contact_name}`}
                  >
                    <MessageSquare className="w-[16px] h-[16px]" />
                  </button>
                  <button
                    onClick={() => handleAction(item, 'email')}
                    disabled={!item.email}
                    className="w-[44px] h-[44px] rounded-lg border border-border bg-card text-reop-dark-blue flex items-center justify-center hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Email"
                    aria-label={`Email ${item.contact_name}`}
                  >
                    <Mail className="w-[16px] h-[16px]" />
                  </button>
                  <button
                    onClick={() => openContact(item.contact_id)}
                    className="w-[44px] h-[44px] rounded-lg border border-border bg-card text-reop-dark-blue flex items-center justify-center hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition"
                    title="View / log"
                    aria-label={`Open details for ${item.contact_name}`}
                  >
                    <ClipboardList className="w-[16px] h-[16px]" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// Tiny helper for the empty-state copy
function RotationLetters() {
  const { currentWeek } = useSphereSyncTasks();
  const calls = SPHERESYNC_CALLS[currentWeek.weekNumber] ?? [];
  const text = SPHERESYNC_TEXTS[currentWeek.weekNumber];
  const letters = Array.from(new Set([...calls, text].filter(Boolean)));
  if (letters.length === 0) return <span>this week</span>;
  return <b className="text-reop-dark-blue">{letters.join(', ')}</b>;
}

export function PrioritiesTab() {
  const { callTasks, textTasks } = useSphereSyncTasks();
  const { data: dashboard } = useDashboardBlocks();

  const callsDone = callTasks.filter((t) => t.completed).length;
  const callsTotal = callTasks.length;
  const textsDone = textTasks.filter((t) => t.completed).length;
  const textsTotal = textTasks.length;

  const callsPct = callsTotal > 0 ? Math.round((callsDone / callsTotal) * 100) : 0;
  const textsPct = textsTotal > 0 ? Math.round((textsDone / textsTotal) * 100) : 0;

  const sideStats = [
    { label: "This week's calls", num: callsDone, total: callsTotal, pct: callsPct, remaining: Math.max(0, callsTotal - callsDone), accent: false },
    { label: 'Texts sent', num: textsDone, total: textsTotal, pct: textsPct, remaining: Math.max(0, textsTotal - textsDone), accent: true },
  ];

  // Streak: walk backwards through trend counting consecutive 100% weeks (excluding current)
  const trend = useMemo(() => dashboard?.blockFour.trend ?? [], [dashboard?.blockFour.trend]);
  const streakWeeks = useMemo(() => {
    let count = 0;
    // Skip the last entry (current week, in progress)
    for (let i = trend.length - 2; i >= 0; i--) {
      if (trend[i].rate >= 100) count++;
      else break;
    }
    return count;
  }, [trend]);

  return (
    <div>
      <CoachTrustBar />

      {/* HERO: focus + side stats */}
      <section className="grid gap-5 mb-7 lg:grid-cols-[1fr_320px]">
        <FocusCard />
        <aside className="flex flex-col gap-3.5">
          {sideStats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
          <StreakCard weeks={streakWeeks} />
        </aside>
      </section>

      <WeekHintBar />
      <CadenceStrip />
      <PriorityQueue />
    </div>
  );
}

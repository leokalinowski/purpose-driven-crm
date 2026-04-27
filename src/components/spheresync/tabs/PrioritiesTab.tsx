import { useState } from 'react';
import { Sparkles, Phone, MessageSquare, ClipboardList, ListOrdered, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCoachingState, ALERT_META, TodayItem, tierFor } from '@/hooks/useCoachingState';
import { useSphereSyncTasks, WeeklyStats } from '@/hooks/useSphereSyncTasks';
import { FocusCard } from '@/components/spheresync/FocusCard';
import { WeekHintBar } from '@/components/spheresync/WeekHintBar';
import { Opportunity } from '@/hooks/usePipeline';

interface PrioritiesTabProps {
  onOpenOpportunity?: (opp: Opportunity) => void;
}

// ── Stats sidebar ────────────────────────────────────────────────────────────

function ProgressStat({
  label,
  done,
  total,
  accent,
}: {
  label: string;
  done: number;
  total: number;
  accent?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold leading-none text-foreground">{done}</span>
        <span className="text-[13px] text-muted-foreground">/ {total}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', accent ? 'bg-reop-green' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{pct}% complete</span>
        <span>{Math.max(0, total - done)} remaining</span>
      </div>
    </div>
  );
}

function StreakStat({ historicalStats }: { historicalStats: WeeklyStats[] }) {
  const streakWeeks = historicalStats.filter((s) => s.completionRate >= 100).length;
  const streakMsg = streakWeeks === 0
    ? 'Complete your first week to start a streak.'
    : streakWeeks === 1
    ? 'One week down — keep it going!'
    : `Close this week strong to make it ${streakWeeks + 1}.`;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'linear-gradient(135deg, hsl(184 100% 97%), white)',
        borderColor: 'hsl(184 50% 85%)',
      }}
    >
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-primary">
        Streak
      </div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold leading-none text-foreground">{streakWeeks}</span>
        <span className="text-[13px] text-muted-foreground">weeks 100%</span>
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">{streakMsg}</p>
    </div>
  );
}

// ── Priority queue row ───────────────────────────────────────────────────────

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ');
  const init =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] ?? '?').slice(0, 2);
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11.5px] font-bold">
      {init.toUpperCase()}
    </div>
  );
}

type QueueFilter = 'all' | 'overdue' | 'today' | 'calls' | 'texts';

function QueueRow({ item, index }: { item: TodayItem; index: number }) {
  const tier = tierFor(item.priority_score);
  const isTop = index === 0;
  const isOverdue = tier === 'urgent';
  const action = item.action;

  const pillClass = isOverdue
    ? 'bg-red-50 text-red-700 border border-red-200'
    : isTop
    ? 'bg-primary/10 text-primary'
    : 'bg-orange-50 text-orange-700 border border-orange-200';

  const pillLabel = isOverdue ? 'Overdue' : isTop ? 'Top pick' : tier === 'hot' ? 'Today' : 'Queued';

  return (
    <div
      className={cn(
        'grid items-center gap-3.5 border-b border-border px-5 py-3.5 transition-colors last:border-b-0 hover:bg-muted/30',
        'grid-cols-[20px_40px_1fr_auto_auto]',
        'max-sm:grid-cols-[20px_1fr] max-sm:grid-rows-[auto_auto]',
      )}
    >
      {/* Checkbox */}
      <button
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-border bg-white transition-colors hover:border-primary"
        onClick={() => toast.info(`Logged touch with ${item.contact_name}`)}
        title="Mark done"
      />

      {/* Avatar — hidden on mobile */}
      <Initials name={item.contact_name} />

      {/* Body */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">{item.contact_name}</span>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', pillClass)}>
            {pillLabel}
          </span>
        </div>
        {item.reasoning && (
          <div className="flex items-center gap-1 text-[12px] text-primary font-medium">
            <Sparkles className="h-3 w-3 shrink-0" />
            {item.reasoning}
          </div>
        )}
      </div>

      {/* Type tag — hidden on mobile */}
      <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground max-sm:hidden">
        {action === 'call' ? <Phone className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
        {action === 'call' ? 'Call' : action === 'text' ? 'Text' : action.charAt(0).toUpperCase() + action.slice(1)}
      </div>

      {/* Quick actions */}
      <div className="flex gap-1.5 max-sm:col-span-2 max-sm:justify-end">
        {[
          { icon: Phone, label: 'Call', fn: () => toast.info(`Calling ${item.contact_name}…`) },
          { icon: MessageSquare, label: 'Text', fn: () => toast.info(`Texting ${item.contact_name}…`) },
          { icon: ClipboardList, label: 'Log', fn: () => toast.info('Opening log…') },
        ].map(({ icon: Icon, label, fn }) => (
          <button
            key={label}
            title={label}
            onClick={fn}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── History section (6-week rolling) ────────────────────────────────────────

function HistorySection({ historicalStats }: { historicalStats: WeeklyStats[] }) {
  const weeks = historicalStats.slice(0, 6).reverse(); // oldest → newest
  if (weeks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">No historical data yet. Complete your first week to start seeing trends.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
      {weeks.map((w) => {
        const pct = Math.round(w.completionRate * 100) / 100;
        return (
          <div key={`${w.year}-${w.week}`} className="rounded-xl border border-border bg-card px-4 py-3.5">
            <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">
              Week {w.week}
            </div>
            <div className="mb-2 text-xl font-semibold text-foreground">
              {pct.toFixed(0)}%{' '}
              <small className="text-[12px] font-normal text-muted-foreground">
                · {w.completedTasks}/{w.totalTasks}
              </small>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export function PrioritiesTab({ onOpenOpportunity }: PrioritiesTabProps) {
  const { state: coach, loading: coachLoading } = useCoachingState();
  const { historicalStats, loading: statsLoading } = useSphereSyncTasks();

  const [filter, setFilter] = useState<QueueFilter>('all');

  const todayList: TodayItem[] = coach?.today_list ?? [];
  const nextHour = coach?.next_hour ?? null;
  const alerts = coach?.alerts ?? [];

  // Stats for the sidebar
  const currentStats: WeeklyStats | undefined = historicalStats[0];
  const callsDone = currentStats?.completedCalls ?? 0;
  const callsTotal = currentStats?.callTasks ?? 0;
  const textsDone = currentStats?.completedTexts ?? 0;
  const textsTotal = currentStats?.textTasks ?? 0;

  // Filtered queue
  const filteredItems = todayList.filter((item) => {
    if (filter === 'calls') return item.action === 'call';
    if (filter === 'texts') return item.action === 'text';
    if (filter === 'overdue') return tierFor(item.priority_score) === 'urgent';
    if (filter === 'today') return tierFor(item.priority_score) === 'hot' || tierFor(item.priority_score) === 'warm';
    return true;
  });

  const filterChips: { key: QueueFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: todayList.length },
    { key: 'overdue', label: 'Overdue', count: todayList.filter(i => tierFor(i.priority_score) === 'urgent').length },
    { key: 'today', label: 'Today', count: todayList.filter(i => ['hot','warm'].includes(tierFor(i.priority_score))).length },
    { key: 'calls', label: 'Calls', count: todayList.filter(i => i.action === 'call').length },
    { key: 'texts', label: 'Texts', count: todayList.filter(i => i.action === 'text').length },
  ];

  return (
    <div>
      {/* ── Hero: 2-col layout ────────────────────────────── */}
      <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_300px]">
        <FocusCard nextHour={nextHour} loading={coachLoading} />

        {/* Stats sidebar */}
        <div className="flex flex-col gap-3.5">
          <ProgressStat
            label="This week's calls"
            done={callsDone}
            total={callsTotal || 50}
          />
          <ProgressStat
            label="Texts sent"
            done={textsDone}
            total={textsTotal || 30}
            accent
          />
          <StreakStat historicalStats={historicalStats} />
        </div>
      </div>

      {/* ── Week hint bar ─────────────────────────────────── */}
      <WeekHintBar />

      {/* ── Priority queue ────────────────────────────────── */}
      <section className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
        {/* Queue header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListOrdered className="h-4 w-4 text-primary" />
            Today's priority queue
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {filterChips.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                  filter === key
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card text-foreground hover:border-primary hover:text-primary',
                )}
              >
                {label}
                <span className="opacity-60 text-[10.5px]">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Queue body */}
        {coachLoading ? (
          <div className="space-y-0 animate-pulse">
            {[0,1,2,3].map(i => (
              <div key={i} className="h-16 border-b border-border bg-muted/20 last:border-b-0" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Sparkles className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {todayList.length === 0
                ? 'The Coach hasn\'t surfaced any contacts yet'
                : 'No contacts match this filter'}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {todayList.length === 0
                ? 'Your first coaching tick runs tonight at 05:00 UTC.'
                : 'Try changing the filter above.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item, i) => (
            <QueueRow key={`${item.contact_id}-${i}`} item={item} index={i} />
          ))
        )}
      </section>

      {/* ── Coach alerts ─────────────────────────────────── */}
      {!coachLoading && alerts.length > 0 && (
        <section className="mb-6 space-y-1.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Signals
            <span className="text-xs text-muted-foreground font-normal">— what the Coach noticed</span>
          </h3>
          {alerts.slice(0, 6).map((alert, i) => {
            const meta = ALERT_META[alert.level];
            return (
              <div key={i} className={cn('flex items-start gap-2.5 rounded-lg p-3', meta.bg)}>
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', meta.dot)} />
                <p className={cn('flex-1 text-sm leading-snug', meta.text)}>{alert.message}</p>
                {alert.contact_id && (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* ── 6-week history ───────────────────────────────── */}
      {!statsLoading && historicalStats.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              Last {Math.min(6, historicalStats.length)} weeks
            </h3>
            <span className="text-[12.5px] text-muted-foreground">
              Rolling streak · {historicalStats.filter(s => s.completionRate >= 100).length}/{historicalStats.length}
            </span>
          </div>
          <HistorySection historicalStats={historicalStats} />
        </section>
      )}
    </div>
  );
}

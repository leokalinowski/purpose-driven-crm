/**
 * Modules — three KPI cards in a row.
 *
 * 1. Sphere touches  · this week — calls + texts assigned by the
 *                                  SphereSync letter rotation, real
 *                                  weekly trend sparkline from
 *                                  `historicalStats`.
 * 2. Pipeline value             — number + stage breakdown from
 *                                  `usePipeline().metrics`. No sparkline
 *                                  — `metrics` doesn't carry a time
 *                                  series and we're not inventing one.
 * 3. Delight sent · MTD         — gift count this month, with last
 *                                  month for comparison, and a real
 *                                  weekly sparkline computed via a
 *                                  count query.
 *
 * Layout reference: design/dashboard-v2.html .modules-row.
 */

import { useEffect, useState } from 'react';
import { ArrowUp, Users, KanbanSquare, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { usePipeline } from '@/hooks/usePipeline';

// ─── Shared atoms ────────────────────────────────────────────────────

type AccentTone = 'teal' | 'green' | 'amber';

const ACCENT_CLASS: Record<AccentTone, string> = {
  teal:  'bg-primary',
  green: 'bg-reop-green',
  amber: 'bg-[hsl(35_90%_55%)]',
};

const ICON_CLASS: Record<AccentTone, string> = {
  teal:  'bg-reop-teal-soft text-primary',
  green: 'bg-[hsl(74_61%_90%)] text-[hsl(74_61%_30%)]',
  amber: 'bg-[hsl(35_100%_93%)] text-[hsl(35_80%_40%)]',
};

const BAR_CLASS: Record<AccentTone, string> = {
  teal:  'bg-primary',
  green: 'bg-reop-green',
  amber: 'bg-[hsl(35_90%_55%)]',
};

interface ModuleCardProps {
  accent: AccentTone;
  icon: typeof Users;
  label: string;
  bigNumber: string;
  bigSub?: string;
  caption: string;
  /** When set, renders a progress bar at this percentage (0-100). */
  progressPct?: number | null;
  /** Sparkline bar heights as percentages (0-100). Last bar is highlighted. */
  sparkline?: number[];
  footLeft: string;
  footRight?: { text: string; tone: 'up' | 'muted' };
}

function ModuleCard({
  accent,
  icon: Icon,
  label,
  bigNumber,
  bigSub,
  caption,
  progressPct,
  sparkline,
  footLeft,
  footRight,
}: ModuleCardProps) {
  return (
    <div className="relative bg-card border border-border rounded-[16px] px-[22px] py-5 flex flex-col overflow-hidden">
      <div
        className={cn('absolute top-0 left-0 right-0 h-[3px] rounded-t-[16px]', ACCENT_CLASS[accent])}
      />
      <div className="flex justify-between items-start mb-3">
        <div
          className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center', ICON_CLASS[accent])}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-muted-foreground pt-[3px] text-right max-w-[60%]">
          {label}
        </div>
      </div>

      <div className="font-display text-[40px] font-semibold tracking-[-0.04em] leading-none text-reop-dark-blue mb-0.5">
        {bigNumber}
        {bigSub && (
          <span className="text-[18px] font-normal text-muted-foreground tracking-normal"> {bigSub}</span>
        )}
      </div>
      <div className="text-xs text-muted-foreground mb-4 leading-[1.45]">{caption}</div>

      {progressPct != null && (
        <div className="h-[5px] bg-[hsl(210_15%_92%)] rounded-full overflow-hidden mb-4">
          <div
            className={cn('h-full rounded-full', BAR_CLASS[accent])}
            style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
          />
        </div>
      )}

      {sparkline && sparkline.length > 0 && (
        <div className="flex items-end gap-[3px] h-11 mb-3.5">
          {sparkline.map((h, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 rounded-[3px] min-h-[4px] transition-colors',
                i === sparkline.length - 1 ? BAR_CLASS[accent] : 'bg-reop-teal-soft',
              )}
              style={{ height: `${Math.max(4, Math.min(100, h))}%` }}
            />
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between text-[11.5px] text-muted-foreground pt-2.5 border-t border-border">
        <span>{footLeft}</span>
        {footRight && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-bold',
              footRight.tone === 'up'
                ? 'text-[hsl(142_60%_32%)]'
                : 'text-muted-foreground',
            )}
          >
            {footRight.tone === 'up' && <ArrowUp className="w-2.5 h-2.5" />}
            {footRight.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

/** Group stages into the four buckets used by the design reference. */
function summarizeStages(stageBreakdown: Record<string, number> | undefined): string {
  if (!stageBreakdown) return 'No active opportunities';
  const buckets: { label: string; stages: string[] }[] = [
    { label: 'leads',    stages: ['new_lead', 'nurturing', 'referral_received', 'contacted'] },
    { label: 'active',   stages: ['active_search', 'pre_listing', 'showing', 'listing_appt', 'listed_active', 'active'] },
    { label: 'contract', stages: ['offer_submitted', 'offer_received', 'under_contract'] },
    { label: 'closing',  stages: ['closing_scheduled'] },
  ];
  const counts = buckets
    .map((b) => ({ label: b.label, n: b.stages.reduce((s, st) => s + (stageBreakdown[st] || 0), 0) }))
    .filter((c) => c.n > 0);
  if (counts.length === 0) return 'No active opportunities';
  return counts.map((c) => `${c.n} ${c.label}`).join(' · ');
}

// ─── Delight history hook (inline, dashboard-only) ───────────────────

interface DelightHistory {
  mtd: number;
  lastMonthSame: number;
  /** Last 7 calendar weeks, ascending, count of gifts per week. */
  weeklyCounts: number[];
  loading: boolean;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function useDelightHistory(): DelightHistory {
  const { user } = useAuth();
  const [state, setState] = useState<DelightHistory>({
    mtd: 0,
    lastMonthSame: 0,
    weeklyCounts: [],
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const lastMonthSameRange = new Date(
        lastMonthStart.getFullYear(),
        lastMonthStart.getMonth(),
        Math.min(now.getDate(), new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1, 0).getDate()),
      );
      const sevenWeeksAgo = new Date(now);
      sevenWeeksAgo.setDate(sevenWeeksAgo.getDate() - 49);

      // Three queries in parallel: MTD count, last-month-same count, 7-week roll-up.
      const [mtdRes, lmRes, rollupRes] = await Promise.all([
        supabase
          .from('contact_activities')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', user.id)
          .eq('activity_type', 'gift')
          .gte('activity_date', monthStart.toISOString()),
        supabase
          .from('contact_activities')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', user.id)
          .eq('activity_type', 'gift')
          .gte('activity_date', lastMonthStart.toISOString())
          .lte('activity_date', lastMonthSameRange.toISOString()),
        supabase
          .from('contact_activities')
          .select('activity_date')
          .eq('agent_id', user.id)
          .eq('activity_type', 'gift')
          .gte('activity_date', sevenWeeksAgo.toISOString()),
      ]);

      if (cancelled) return;

      // Bucket the rollup rows into 7 weekly bins (oldest → newest).
      const buckets = Array(7).fill(0);
      const msInWeek = 7 * 86400 * 1000;
      for (const row of (rollupRes.data ?? []) as Array<{ activity_date: string }>) {
        const diff = now.getTime() - new Date(row.activity_date).getTime();
        const bucketsFromNow = Math.floor(diff / msInWeek);
        const idx = 6 - Math.min(6, Math.max(0, bucketsFromNow));
        buckets[idx] += 1;
      }

      setState({
        mtd: mtdRes.count ?? 0,
        lastMonthSame: lmRes.count ?? 0,
        weeklyCounts: buckets,
        loading: false,
      });
    })().catch((err) => {
      console.warn('[useDelightHistory] failed:', err);
      if (!cancelled) setState((s) => ({ ...s, loading: false }));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return state;
}

// ─── Modules row ─────────────────────────────────────────────────────

export function Modules() {
  const { tasks, callTasks, textTasks, historicalStats } = useSphereSyncTasks();
  const { metrics: pipelineMetrics } = usePipeline();
  const delight = useDelightHistory();

  // ── Sphere touches data ─────────────────────────────────────────────
  const completedThisWeek =
    callTasks.filter((t) => t.completed).length + textTasks.filter((t) => t.completed).length;
  const totalThisWeek = callTasks.length + textTasks.length;
  const progressPct = pct(completedThisWeek, totalThisWeek);

  // Sparkline: last 7 weeks' completed-task counts (chronological, oldest → newest).
  const sortedStats = [...historicalStats].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.week - b.week;
  });
  const last7 = sortedStats.slice(-7);
  const maxCompleted = last7.length > 0 ? Math.max(...last7.map((s) => s.completedTasks)) : 0;
  const sphereSparkline = last7.map((s) =>
    maxCompleted > 0 ? Math.round((s.completedTasks / maxCompleted) * 100) : 0,
  );

  // "+X% vs last week" — compare LAST completed (current week) to the
  // one before it. Falls to muted "no change" when prior week is 0.
  const last7Completed = last7.map((s) => s.completedTasks);
  const thisWeekIdx = last7Completed.length - 1;
  const lastWeekCount = thisWeekIdx >= 1 ? last7Completed[thisWeekIdx - 1] : 0;
  const thisWeekCount = thisWeekIdx >= 0 ? last7Completed[thisWeekIdx] : completedThisWeek;
  const wowDelta =
    lastWeekCount > 0 ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100) : null;

  // ── Pipeline data ──────────────────────────────────────────────────
  const pipelineCaption = summarizeStages(pipelineMetrics.stageBreakdown);

  // ── Delight data ───────────────────────────────────────────────────
  const delightMaxBar = Math.max(1, ...delight.weeklyCounts);
  const delightSparkline = delight.weeklyCounts.map((c) =>
    Math.round((c / delightMaxBar) * 100),
  );
  const delightDelta =
    delight.lastMonthSame > 0
      ? Math.round(((delight.mtd - delight.lastMonthSame) / delight.lastMonthSame) * 100)
      : null;

  // Suppress unused — `tasks` was the entry point and is implicitly read
  // through callTasks/textTasks filtered above.
  void tasks;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
      {/* 1. Sphere touches */}
      <ModuleCard
        accent="teal"
        icon={Users}
        label="Sphere touches · this week"
        bigNumber={String(completedThisWeek)}
        bigSub={totalThisWeek > 0 ? `/${totalThisWeek}` : undefined}
        caption="Calls + texts assigned by your SphereSync rotation"
        progressPct={totalThisWeek > 0 ? progressPct : null}
        sparkline={sphereSparkline.length > 0 ? sphereSparkline : undefined}
        footLeft={last7.length > 0 ? `Last ${last7.length} weeks` : 'Mon–Sun'}
        footRight={
          wowDelta != null
            ? wowDelta >= 0
              ? { text: `+${wowDelta}% vs last week`, tone: 'up' }
              : { text: `${wowDelta}% vs last week`, tone: 'muted' }
            : undefined
        }
      />

      {/* 2. Pipeline value — no sparkline (no real series available) */}
      <ModuleCard
        accent="green"
        icon={KanbanSquare}
        label={`Pipeline value · ${pipelineMetrics.totalOpportunities} opportunit${pipelineMetrics.totalOpportunities === 1 ? 'y' : 'ies'}`}
        bigNumber={formatCompactCurrency(pipelineMetrics.pipelineValue)}
        caption={pipelineCaption}
        progressPct={null}
        footLeft="Active pipeline"
        footRight={
          pipelineMetrics.staleCount > 0
            ? { text: `${pipelineMetrics.staleCount} stale`, tone: 'muted' }
            : { text: 'All fresh', tone: 'up' }
        }
      />

      {/* 3. Delight sent — MTD with real history */}
      <ModuleCard
        accent="amber"
        icon={Gift}
        label="Delight sent · MTD"
        bigNumber={String(delight.mtd)}
        caption="Gifts, cards & handwritten notes"
        progressPct={null}
        sparkline={delight.weeklyCounts.some((c) => c > 0) ? delightSparkline : undefined}
        footLeft={
          delight.lastMonthSame > 0
            ? `vs ${delight.lastMonthSame} same time last month`
            : 'Last 7 weeks'
        }
        footRight={
          delightDelta != null
            ? delightDelta >= 0
              ? { text: `+${delightDelta}%`, tone: 'up' }
              : { text: `${delightDelta}%`, tone: 'muted' }
            : undefined
        }
      />
    </div>
  );
}

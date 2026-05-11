/**
 * StreakCard — the white card to the right of the Hero band.
 *
 * "Consecutive weeks completing your SphereSync calls" — backed by the
 * real `historicalStats` series from `useSphereSyncTasks`. A week
 * counts as a "hit" when every call task assigned that week was
 * completed (100% of `callTasks` count → `completedCalls`).
 *
 * Layout reference: design/dashboard-v2.html .streak-card.
 */

import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeeklyStats } from '@/hooks/useSphereSyncTasks';

interface StreakWeek {
  weekLabel: string;
  state: 'hit' | 'miss' | 'current';
}

/** Count the streak of consecutive completed-call weeks BEFORE the current week. */
function computeStreak(history: WeeklyStats[], current: { weekNumber: number; year: number }): number {
  // History as delivered is usually descending or ascending — normalize to
  // descending by year/week so we walk most-recent-first.
  const sorted = [...history].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.week - a.week;
  });

  // Walk backwards from the week BEFORE current.
  let streak = 0;
  for (const w of sorted) {
    if (w.year === current.year && w.week === current.weekNumber) continue;
    if (w.callTasks > 0 && w.completedCalls >= w.callTasks) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Build 7 squares to render — last 6 completed weeks + the current week. */
function buildWeeks(history: WeeklyStats[], current: { weekNumber: number; year: number }): StreakWeek[] {
  const sorted = [...history].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.week - b.week;
  });
  // Pull last 6 NON-current weeks chronologically, then append current.
  const past = sorted
    .filter((w) => !(w.year === current.year && w.week === current.weekNumber))
    .slice(-6);
  const out: StreakWeek[] = past.map((w) => ({
    weekLabel: `W${w.week}`,
    state: w.callTasks > 0 && w.completedCalls >= w.callTasks ? 'hit' : 'miss',
  }));
  out.push({ weekLabel: `W${current.weekNumber}`, state: 'current' });
  return out;
}

// ─── Component ───────────────────────────────────────────────────────

interface StreakCardProps {
  historicalStats: WeeklyStats[];
  currentWeek: { weekNumber: number; year: number };
  /** Remaining call tasks this week (call tasks where `completed=false`). */
  remainingCalls: number;
}

export function StreakCard({ historicalStats, currentWeek, remainingCalls }: StreakCardProps) {
  const streak = computeStreak(historicalStats, currentWeek);
  const weeks = buildWeeks(historicalStats, currentWeek);

  return (
    <section className="bg-card border border-border rounded-[20px] p-6 flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-[15px] font-bold tracking-[-0.02em] text-reop-dark-blue">
            Call streak
          </h3>
          <p className="m-0 mt-0.5 text-xs text-muted-foreground leading-[1.5]">
            Consecutive weeks completing your SphereSync calls
          </p>
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0"
          style={{ background: 'hsl(74 61% 90%)', color: 'hsl(74 61% 28%)' }}
        >
          <Zap className="w-2.5 h-2.5" />
          {streak} {streak === 1 ? 'week' : 'weeks'}
        </div>
      </div>

      {/* 7-square weekly grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.map((w) => (
          <div
            key={w.weekLabel}
            className={cn(
              'aspect-square rounded-lg flex flex-col items-center justify-center gap-[3px] text-[9px] font-bold uppercase tracking-[0.04em]',
              w.state === 'hit' && 'bg-reop-teal-soft text-primary',
              w.state === 'miss' && 'bg-reop-surface-subtle text-muted-foreground',
              w.state === 'current' && 'bg-reop-dark-blue text-white',
            )}
            style={
              w.state === 'current'
                ? { boxShadow: '0 0 0 2px white, 0 0 0 4px hsl(var(--reop-teal) / 0.4)' }
                : undefined
            }
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                w.state === 'hit' && 'bg-primary',
                w.state === 'miss' && 'bg-[hsl(210_15%_80%)]',
                w.state === 'current' && 'bg-reop-green',
              )}
              style={
                w.state === 'current'
                  ? { boxShadow: '0 0 6px hsl(var(--reop-green))' }
                  : undefined
              }
            />
            {w.weekLabel}
          </div>
        ))}
      </div>

      {/* CTA line */}
      <p className="m-0 text-[12.5px] text-muted-foreground leading-[1.55]">
        {remainingCalls > 0 ? (
          <>
            Close out{' '}
            <strong className="text-reop-dark-blue">
              {remainingCalls} more call{remainingCalls === 1 ? '' : 's'}
            </strong>{' '}
            to {streak > 0 ? `keep the ${streak}-week streak` : 'start a streak'}.
          </>
        ) : streak > 0 ? (
          <>
            <strong className="text-reop-dark-blue">All calls done.</strong>{' '}
            Your streak is alive — current count {streak + 1} pending Sunday rollover.
          </>
        ) : (
          <>
            <strong className="text-reop-dark-blue">All calls done.</strong>{' '}
            Hit it again next week to start a streak.
          </>
        )}
      </p>
    </section>
  );
}

/**
 * RecentCheckInsPanel — restored from the old /coaching page.
 *
 * Shows the last N submitted check-ins as a vertical list. Each row:
 *   - Week label + date range on the left
 *   - 4 mini stats (dials, conversations, appointments, closings)
 *   - "Submitted MMM D" timestamp
 *
 * Excludes the current ISO week (it's still in the editor) — this list is
 * about historical context.
 */

import { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { CoachingSubmission } from '@/hooks/useCoaching';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';
import { cn } from '@/lib/utils';

interface Props {
  submissions: CoachingSubmission[];
  limit?: number;
}

function weekRangeLabel(weekNumber: number, year: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Mon);
  start.setUTCDate(week1Mon.getUTCDate() + (weekNumber - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)}–${fmt(end)}`;
}

export function RecentCheckInsPanel({ submissions, limit = 6 }: Props) {
  const currentWeek = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();

  const rows = useMemo(
    () =>
      submissions
        .filter((s) => !(s.week_number === currentWeek && s.year === currentYear))
        .slice(0, limit),
    [submissions, currentWeek, currentYear, limit],
  );

  return (
    <section className="bg-card border border-border rounded-[14px] overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          Recent check-ins
        </h3>
        <span className="text-[12px] text-muted-foreground">
          {rows.length === 0 ? 'No history yet' : `${rows.length} of ${submissions.length - 1} shown`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No prior check-ins yet. Your weekly history will show up here as you submit.
          </p>
        </div>
      ) : (
        <div className="px-6 pb-1">
          {rows.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                'grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-3.5 py-4',
                i !== rows.length - 1 && 'border-b border-border',
              )}
            >
              <div className="text-xs text-muted-foreground">
                <b className="block text-sm text-reop-dark-blue font-semibold">
                  Week {s.week_number} · {s.year}
                </b>
                {weekRangeLabel(s.week_number, s.year)}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] tabular-nums">
                <Stat label="Dials" value={s.dials_made} />
                <Stat label="Convos" value={s.conversations} />
                <Stat label="Appts" value={s.appointments_set} />
                <Stat label="Closings" value={s.closings} />
                {Number(s.closing_amount || 0) > 0 && (
                  <Stat label="GCI" value={`$${Math.round(Number(s.closing_amount)).toLocaleString()}`} />
                )}
              </div>
              <div className="text-[11.5px] text-muted-foreground self-start md:self-center">
                Submitted{' '}
                {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <span>
      <b className="text-reop-dark-blue font-semibold">{value ?? 0}</b>
      <span className="text-muted-foreground ml-1">{label}</span>
    </span>
  );
}

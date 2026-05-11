/**
 * MonthlyTrajectoryChart — clean GCI/Closings trajectory.
 *
 * Faithful port of `design/scoreboard.html`'s "GCI trajectory — 6 months":
 *   - 6 monthly bars (current month + 5 prior)
 *   - Each month renders TWO bars side-by-side: this year (solid) + last
 *     year same month (ghost). Ghost dimmed to ~50% opacity.
 *   - Horizontal dashed goal line if an annual goal is set
 *     (annual / 12 = monthly target).
 *   - Y-axis labels left-aligned. X-axis labels under each bar pair.
 *   - Bars are GENEROUSLY spaced — the original problem was packing 12 thin
 *     bars into too-tight a chart.
 *
 * Mode prop: 'gci' aggregates closing_amount, 'closings' aggregates
 * closings count. Default 'gci'.
 */

import { useMemo } from 'react';
import type { CoachingSubmission } from '@/hooks/useCoaching';

interface MonthlyTrajectoryChartProps {
  submissions: CoachingSubmission[];
  /** Which metric to chart. 'gci' (default) uses closing_amount sum; 'closings' uses count. */
  mode?: 'gci' | 'closings';
  /** Annual goal for the chosen metric. Drives the horizontal goal line; null = no line. */
  annualGoal?: number | null;
}

interface MonthlyBucket {
  monthIndex: number; // 0-11
  year: number;
  label: string;      // "Mar"
  thisYearValue: number;
  lastYearValue: number;
}

const MONTH_LABEL = (mi: number) =>
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mi];

function valueFor(sub: CoachingSubmission, mode: 'gci' | 'closings'): number {
  return mode === 'gci' ? Number(sub.closing_amount || 0) : Number(sub.closings || 0);
}

/** ISO week number → midpoint date (Thursday of that week). Used to bucket. */
function midpointOfIsoWeek(year: number, weekNumber: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (day - 1));
  const mon = new Date(week1Mon);
  mon.setUTCDate(week1Mon.getUTCDate() + (weekNumber - 1) * 7);
  const thu = new Date(mon);
  thu.setUTCDate(mon.getUTCDate() + 3);
  return thu;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function MonthlyTrajectoryChart({
  submissions, mode = 'gci', annualGoal,
}: MonthlyTrajectoryChartProps) {
  const buckets = useMemo<MonthlyBucket[]>(() => {
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    // 6 buckets: 5 months ago through current month.
    const arr: MonthlyBucket[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = (currentMonth - i + 12) % 12;
      const y = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      arr.push({
        monthIndex: m,
        year: y,
        label: MONTH_LABEL(m),
        thisYearValue: 0,
        lastYearValue: 0,
      });
    }

    for (const sub of submissions) {
      const mid = midpointOfIsoWeek(sub.year, sub.week_number);
      const subM = mid.getUTCMonth();
      const subY = mid.getUTCFullYear();
      const v = valueFor(sub, mode);

      // Match this-year buckets.
      const thisIdx = arr.findIndex((b) => b.monthIndex === subM && b.year === subY);
      if (thisIdx >= 0) {
        arr[thisIdx].thisYearValue += v;
        continue;
      }
      // Match last-year buckets (same month, previous year).
      const lastIdx = arr.findIndex((b) => b.monthIndex === subM && b.year - 1 === subY);
      if (lastIdx >= 0) {
        arr[lastIdx].lastYearValue += v;
      }
    }
    return arr;
  }, [submissions, mode]);

  // Monthly goal line: annual / 12.
  const monthlyGoal =
    annualGoal != null && annualGoal > 0 ? annualGoal / 12 : null;

  const max = useMemo(() => {
    const m = Math.max(
      1,
      ...buckets.map((b) => b.thisYearValue),
      ...buckets.map((b) => b.lastYearValue),
      monthlyGoal ?? 0,
    );
    return m * 1.1; // 10% headroom
  }, [buckets, monthlyGoal]);

  // Layout
  const width = 800;
  const height = 260;
  const padL = 48;
  const padR = 20;
  const padT = 24;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const colW = innerW / buckets.length;
  const barW = Math.min(30, colW * 0.32);
  const groupGap = 4;

  const yFor = (v: number) => padT + innerH - (v / max) * innerH;

  const ticks = useMemo(() => {
    // 4 horizontal grid lines at 25/50/75/100%
    const out: Array<{ pct: number; label: string }> = [];
    for (const pct of [0.25, 0.5, 0.75, 1]) {
      const v = max * pct;
      out.push({ pct, label: mode === 'gci' ? formatUsd(v) : String(Math.round(v)) });
    }
    return out;
  }, [max, mode]);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-[260px] w-full overflow-visible">
        {/* Y axis grid + labels */}
        {ticks.map(({ pct, label }) => {
          const y = yFor(max * pct);
          return (
            <g key={pct}>
              <line
                x1={padL} y1={y} x2={width - padR} y2={y}
                stroke="hsl(210 20% 92%)" strokeWidth="1"
              />
              <text
                x={padL - 8} y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize="10.5"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Goal line */}
        {monthlyGoal != null && (
          <g>
            <line
              x1={padL} y1={yFor(monthlyGoal)} x2={width - padR} y2={yFor(monthlyGoal)}
              stroke="hsl(184 100% 34%)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7"
            />
            <text
              x={width - padR - 4} y={yFor(monthlyGoal) - 6}
              textAnchor="end"
              fontSize="10.5"
              fontWeight="600"
              fill="hsl(184 100% 34%)"
            >
              Monthly goal · {mode === 'gci' ? formatUsd(monthlyGoal) : Math.round(monthlyGoal)}
            </text>
          </g>
        )}

        {/* Bars */}
        {buckets.map((b, i) => {
          const xCenter = padL + colW * (i + 0.5);
          const xLast = xCenter - barW - groupGap / 2;
          const xThis = xCenter + groupGap / 2;
          const thisH = (b.thisYearValue / max) * innerH;
          const lastH = (b.lastYearValue / max) * innerH;
          const isCurrent = i === buckets.length - 1;

          return (
            <g key={`${b.year}-${b.monthIndex}`}>
              {/* Last year ghost */}
              {b.lastYearValue > 0 && (
                <rect
                  x={xLast} y={padT + innerH - lastH}
                  width={barW} height={lastH}
                  fill="hsl(210 20% 75%)"
                  rx="3"
                  opacity="0.65"
                />
              )}
              {/* This year solid */}
              {b.thisYearValue > 0 && (
                <rect
                  x={xThis} y={padT + innerH - thisH}
                  width={barW} height={thisH}
                  fill={isCurrent ? 'hsl(184 100% 34%)' : 'hsl(184 80% 60%)'}
                  rx="3"
                />
              )}
              {/* X axis label */}
              <text
                x={xCenter} y={height - 12}
                textAnchor="middle"
                fontSize="10.5"
                className="fill-muted-foreground"
                fontWeight={isCurrent ? '600' : '400'}
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-primary" />
          This year (current month)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[hsl(184_80%_60%)]" />
          Earlier this year
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[hsl(210_20%_75%)] opacity-65" />
          Same month last year
        </div>
        {monthlyGoal != null && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-5 border-t-[1.5px] border-dashed border-[hsl(184_100%_34%)]" />
            Monthly goal
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { History, Phone, MessageSquare, Target } from 'lucide-react';
import { useDashboardBlocks } from '@/hooks/useDashboardBlocks';
import { useSphereSyncTasks, type WeeklyStats } from '@/hooks/useSphereSyncTasks';
import { buildWeekOptions } from '@/utils/sphereSyncLogic';

type Streak = {
  week: string;
  pct: string;
  detail: string;
  helper: string;
  tone: 'warn' | 'good' | 'current';
};

function StreakCard({ s }: { s: Streak }) {
  const borderColor =
    s.tone === 'good' ? 'var(--reop-green)' : s.tone === 'current' ? 'var(--primary)' : 'hsl(35 80% 55%)';
  const numColor =
    s.tone === 'good' ? 'hsl(142 55% 28%)' : s.tone === 'current' ? 'var(--primary)' : 'hsl(35 80% 38%)';
  const helperColor =
    s.tone === 'good' ? 'hsl(142 55% 28%)' : s.tone === 'current' ? 'var(--primary)' : 'var(--muted-foreground)';
  const helperWeight = s.tone === 'warn' ? 400 : 600;
  const barFill = s.tone === 'good' ? 'hsl(142 50% 50%)' : s.tone === 'current' ? 'hsl(184 100% 34%)' : 'hsl(35 80% 55%)';
  const widthPct = Math.min(100, parseInt(s.pct, 10) || 0);
  const bg = s.tone === 'current' ? 'hsl(184 100% 98%)' : 'var(--card)';

  return (
    <div
      className="rounded-xl border border-border p-4"
      style={{ borderLeft: `3px solid ${borderColor}`, background: bg }}
    >
      <b style={{ color: s.tone === 'current' ? 'var(--primary)' : 'inherit' }}>{s.week}</b>
      <div className="mt-1.5" style={{ color: numColor, fontSize: 18, fontWeight: 700 }}>
        {s.pct} <small className="font-normal text-[12px] text-muted-foreground">· {s.detail}</small>
      </div>
      <div className="h-1.5 rounded-full bg-[hsl(210_20%_94%)] overflow-hidden mt-2">
        <div className="h-full rounded-full" style={{ width: `${widthPct}%`, background: barFill }} />
      </div>
      <div className="text-[11px] mt-1" style={{ color: helperColor, fontWeight: helperWeight }}>
        {s.helper}
      </div>
    </div>
  );
}

function helperFor(rate: number, isCurrent: boolean): string {
  if (isCurrent) return 'In progress';
  if (rate >= 100) return 'Perfect week';
  if (rate >= 90) return 'Strong finish';
  if (rate >= 80) return 'On pace';
  if (rate === 0) return 'No tasks logged';
  return `${rate}% completion`;
}

export function HistoryTab() {
  const { data: dashboard, loading } = useDashboardBlocks();
  const { historicalStats, currentWeek, selectedWeek, loadTasksForWeek } = useSphereSyncTasks();
  const weekOptions = useMemo(() => buildWeekOptions(new Date()), []);
  const selectedWeekValue = String(selectedWeek?.weekNumber ?? currentWeek.weekNumber);
  const isCurrentWeek = (selectedWeek?.weekNumber ?? currentWeek.weekNumber) === currentWeek.weekNumber;
  const handleWeekChange = (value: string) => {
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return;
    const opt = weekOptions.find((o) => o.value === value);
    loadTasksForWeek(num, opt?.year ?? currentWeek.isoYear);
  };

  // Memoize the trend slice so dependent useMemo hooks below have stable deps.
  const trend = useMemo(() => dashboard?.blockFour.trend ?? [], [dashboard?.blockFour.trend]);

  // Index stats by week label "W{number}" for quick lookup
  const statsByWeek = useMemo(() => {
    const m = new Map<string, WeeklyStats>();
    (historicalStats || []).forEach((s) => m.set(`W${s.week}`, s));
    return m;
  }, [historicalStats]);

  const streaks: Streak[] = useMemo(() => {
    return trend.map((t, i) => {
      const isCurrent = i === trend.length - 1;
      const s = statsByWeek.get(t.week);
      const total = s?.totalTasks ?? 0;
      const done = s?.completedTasks ?? 0;
      const detail = total > 0 ? `${done}/${total}` : '—';
      const tone: Streak['tone'] = isCurrent ? 'current' : t.rate >= 95 ? 'good' : 'warn';
      return {
        week: isCurrent ? `${t.week} ←` : t.week,
        pct: total > 0 ? `${t.rate}%` : '—',
        detail,
        helper: helperFor(t.rate, isCurrent),
        tone,
      };
    });
  }, [trend, statsByWeek]);

  // Build the metric rows: calls + texts per week from sphere historical stats
  const callsRow = trend.map((t) => statsByWeek.get(t.week)?.completedCalls ?? 0);
  const textsRow = trend.map((t) => statsByWeek.get(t.week)?.completedTexts ?? 0);
  const goalRow = trend.map((t) => `${t.rate}%`);

  const weekLabels = trend.map((t, i) => (i === trend.length - 1 ? `${t.week} ←` : t.week));

  return (
    <section className="mb-6">
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <span>Focused on week:</span>
          <select
            value={selectedWeekValue}
            onChange={(e) => handleWeekChange(e.target.value)}
            className="h-9 px-2.5 rounded-md border border-border bg-card text-[12.5px] text-reop-dark-blue font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Focused on week"
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

      <div className="flex items-center justify-between mb-4">
        <h3 className="m-0 text-base font-semibold inline-flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Weekly history
        </h3>
        <span className="text-[12.5px] text-muted-foreground">Rolling 8-week performance</span>
      </div>

      {loading && trend.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
          Loading history…
        </div>
      ) : trend.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
          No history yet. Complete tasks across a few weeks to build your streak.
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-x-auto mb-5">
          <div className="min-w-[640px]">
            <div
              className="text-[11px] uppercase tracking-[0.05em] font-bold text-muted-foreground py-2.5 px-4 bg-[hsl(210_20%_97%)] border-b border-border"
              style={{
                display: 'grid',
                gridTemplateColumns: `120px repeat(${weekLabels.length}, 1fr)`,
                gap: 0,
              }}
            >
              <span>Metric</span>
              {weekLabels.map((w, i) => (
                <span
                  key={w}
                  className="text-center"
                  style={{ color: i === weekLabels.length - 1 ? 'var(--primary)' : undefined }}
                >
                  {w}
                </span>
              ))}
            </div>

            <div
              className="px-4 py-3 border-b border-border items-center"
              style={{ display: 'grid', gridTemplateColumns: `120px repeat(${weekLabels.length}, 1fr)`, gap: 0 }}
            >
              <span className="text-[12.5px] font-semibold inline-flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-primary" />
                Calls
              </span>
              {callsRow.map((v, i) => {
                const isLast = i === callsRow.length - 1;
                return (
                  <span
                    key={i}
                    className="text-center text-[13px]"
                    style={{ color: isLast ? 'var(--primary)' : undefined, fontWeight: isLast ? 700 : 400 }}
                  >
                    {v}
                  </span>
                );
              })}
            </div>

            <div
              className="px-4 py-3 border-b border-border items-center"
              style={{
                display: 'grid',
                gridTemplateColumns: `120px repeat(${weekLabels.length}, 1fr)`,
                gap: 0,
                background: 'hsl(210 20% 98.5%)',
              }}
            >
              <span className="text-[12.5px] font-semibold inline-flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-primary" />
                Texts
              </span>
              {textsRow.map((v, i) => {
                const isLast = i === textsRow.length - 1;
                return (
                  <span
                    key={i}
                    className="text-center text-[13px]"
                    style={{ color: isLast ? 'var(--primary)' : undefined, fontWeight: isLast ? 700 : 400 }}
                  >
                    {v}
                  </span>
                );
              })}
            </div>

            <div
              className="px-4 py-3 items-center"
              style={{ display: 'grid', gridTemplateColumns: `120px repeat(${weekLabels.length}, 1fr)`, gap: 0 }}
            >
              <span className="text-[12.5px] font-semibold inline-flex items-center gap-1.5">
                <Target className="w-3 h-3 text-primary" />
                % of goal
              </span>
              {goalRow.map((v, i) => {
                const isLast = i === goalRow.length - 1;
                const pct = parseInt(v, 10) || 0;
                const color = isLast ? 'var(--primary)' : pct >= 95 ? 'hsl(142 55% 28%)' : 'hsl(35 80% 38%)';
                const weight = isLast || pct >= 95 ? 700 : 400;
                return (
                  <span key={i} className="text-center text-[13px]" style={{ color, fontWeight: weight }}>
                    {v}
                  </span>
                );
              })}
            </div>

            <div className="px-4 py-2.5 bg-[hsl(210_20%_97%)] border-t border-border text-[11.5px] text-muted-foreground">
              Current week in progress · updates as you log tasks
            </div>
          </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {streaks.map((s) => (
              <StreakCard key={s.week} s={s} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

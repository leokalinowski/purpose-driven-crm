/**
 * Scoreboard — merged "Coaching + Success Scoreboard" page.
 *
 * Rebuilt 2026-05 against `design/scoreboard.html`, `design/coaching.html`,
 * and `design/checkin.html`. Layout (top → bottom):
 *
 *   1. ScoreboardHero          — gradient hero with "How did your week go?"
 *                                + streak block + "Submit weekly check-in"
 *                                button that opens WeeklyCheckInModalV2.
 *                                When this-week is logged, shows the
 *                                must-do task as an inline italic quote.
 *   2. KPI grid (4 cards)      — Closings, GCI, sphere touch, lead conv.
 *                                pace + annual-goal progress bars.
 *   3. MonthlyTrajectoryChart  — 6 months, this-yr vs last-yr ghost bars,
 *                                horizontal goal line, clean spacing.
 *   4. 2-col split             — GrowthGoalsCard (left, 1.4fr) +
 *                                RecentCheckInsPanel (right, 1fr).
 *
 * Auto-opens the modal when:
 *   - URL has ?checkin=1 (deep link from Coach action items / nudges)
 *   - URL has ?nudge=… (the coaching-weekly-nudge action_url scheme)
 *
 * The old `/coaching` route still redirects here.
 */

import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUp, ArrowDown, TrendingUp, Loader2, type LucideIcon,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useCoachingSubmissions,
  usePersonalMetrics,
  useWeeklyStreak,
  useLast4Weeks,
  type CoachingSubmission,
} from '@/hooks/useCoaching';
import { useCoachingGoals } from '@/hooks/useCoachingGoals';
import { useUserProfile } from '@/hooks/useUserProfile';
import { ScoreboardHero } from '@/components/scoreboard/ScoreboardHero';
import { MonthlyTrajectoryChart } from '@/components/scoreboard/MonthlyTrajectoryChart';
import { GrowthGoalsCard } from '@/components/scoreboard/GrowthGoalsCard';
import { RecentCheckInsPanel } from '@/components/scoreboard/RecentCheckInsPanel';
import { WeeklyCheckInModalV2 } from '@/components/scoreboard/WeeklyCheckInModalV2';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

// ── Tiny formatting helpers ────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
    : `$${Math.round(n).toLocaleString('en-US')}`;

function TrendIcon({ dir }: { dir: 'up' | 'down' | 'flat' }) {
  const Icon: LucideIcon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : TrendingUp;
  return <Icon className="h-3 w-3" />;
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

function deltaTrend(current: number, prior: number): { dir: 'up' | 'down' | 'flat'; text: string } | null {
  if (prior === 0 && current === 0) return null;
  if (prior === 0) return { dir: 'up', text: 'New activity' };
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct > 0) return { dir: 'up', text: `+${pct}% vs prior 4 wks` };
  if (pct < 0) return { dir: 'down', text: `${pct}% vs prior 4 wks` };
  return { dir: 'flat', text: 'Flat vs prior 4 wks' };
}

// ── Page ───────────────────────────────────────────────────────────────

export default function Scoreboard() {
  const { data: submissions = [], isLoading: subLoading } = useCoachingSubmissions();
  const { data: personalMetrics = [] } = usePersonalMetrics();
  const { data: streak = 0 } = useWeeklyStreak();
  const { data: last4 = [] } = useLast4Weeks();
  const { goals } = useCoachingGoals();
  const { profile } = useUserProfile();
  void personalMetrics; // reserved: future surfaces

  const [searchParams, setSearchParams] = useSearchParams();

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false);

  // Auto-open from deep links: ?checkin=1 (manual) OR ?nudge=… (Coach nudge).
  useEffect(() => {
    const wantsModal = searchParams.has('checkin') || searchParams.has('nudge');
    if (wantsModal && !modalOpen) setModalOpen(true);
  }, [searchParams, modalOpen]);

  function closeModal() {
    setModalOpen(false);
    // Strip the deep-link params so refresh doesn't re-open.
    if (searchParams.has('checkin') || searchParams.has('nudge')) {
      const next = new URLSearchParams(searchParams);
      next.delete('checkin');
      next.delete('nudge');
      setSearchParams(next, { replace: true });
    }
  }

  // ── Identity ──
  const agentFirstName = useMemo(() => {
    const fn = profile?.first_name?.trim();
    if (fn) return fn;
    const fallback = (profile?.full_name ?? '').trim().split(/\s+/)[0];
    return fallback || 'there';
  }, [profile]);

  const currentWeek = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();
  const thisWeekSub = useMemo<CoachingSubmission | null>(
    () => submissions.find((s) => s.week_number === currentWeek && s.year === currentYear) ?? null,
    [submissions, currentWeek, currentYear],
  );

  // ── Totals (YTD) ──
  const ytdSlice = useMemo(() => submissions.filter((s) => s.year === currentYear), [submissions, currentYear]);
  const ytd = useMemo(() => {
    return ytdSlice.reduce(
      (a, s) => ({
        closings: a.closings + (s.closings || 0),
        gci: a.gci + Number(s.closing_amount || 0),
        conversations: a.conversations + (s.conversations || 0),
        dials: a.dials + (s.dials_made || 0),
        appointments: a.appointments + (s.appointments_set || 0),
        agreements: a.agreements + (s.agreements_signed || 0),
        weeks: a.weeks + 1,
      }),
      { closings: 0, gci: 0, conversations: 0, dials: 0, appointments: 0, agreements: 0, weeks: 0 },
    );
  }, [ytdSlice]);

  // Trend: last 4 weeks vs prior 4 weeks (uses raw submissions order).
  const last4Convos = useMemo(() => last4.reduce((sum, w) => sum + (w.conversations || 0), 0), [last4]);
  const prior4Convos = useMemo(() => {
    if (submissions.length < 8) return 0;
    return submissions.slice(4, 8).reduce((sum, w) => sum + (w.conversations || 0), 0);
  }, [submissions]);
  const last4Appts = useMemo(() => last4.reduce((sum, w) => sum + (w.appointments_set || 0), 0), [last4]);
  const prior4Appts = useMemo(() => {
    if (submissions.length < 8) return 0;
    return submissions.slice(4, 8).reduce((sum, w) => sum + (w.appointments_set || 0), 0);
  }, [submissions]);

  const convTrend = deltaTrend(last4Convos, prior4Convos);
  const apptTrend = deltaTrend(last4Appts, prior4Appts);

  // Conversion %: NULL when nothing to convert.
  const conversionPct: number | null = ytd.appointments > 0
    ? Math.round((ytd.closings / ytd.appointments) * 100)
    : null;

  // YTD pace projection (extrapolate weekly avg to full year).
  const paceFromYtd = (val: number): number | null =>
    ytd.weeks === 0 ? null : (val / ytd.weeks) * 52;

  const gciPace = paceFromYtd(ytd.gci);
  const closingsPace = paceFromYtd(ytd.closings);

  // KPI: closings card
  const closingsProgress = goals.annual_closings_goal && goals.annual_closings_goal > 0
    ? Math.min(100, Math.round((ytd.closings / goals.annual_closings_goal) * 100))
    : null;
  const gciProgress = goals.annual_gci_goal && goals.annual_gci_goal > 0
    ? Math.min(100, Math.round((ytd.gci / goals.annual_gci_goal) * 100))
    : null;

  const weekRange = weekRangeLabel(currentWeek, currentYear);
  const noSubmissions = !subLoading && submissions.length === 0;

  return (
    <Layout>
      <Helmet>
        <title>Success Scoreboard — REOP</title>
      </Helmet>

      <div className="mb-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary">
          Success Scoreboard
        </span>
        <h1 className="mt-1.5 text-[clamp(1.6rem,2.4vw+0.5rem,2.1rem)] font-medium tracking-[-0.035em] text-reop-dark-blue">
          The numbers don't lie.
        </h1>
        <p className="mt-1 max-w-[640px] text-sm text-muted-foreground mb-7">
          Your weekly check-in feeds this dashboard. The Coach reads the same numbers.
        </p>
      </div>

      {/* ── HERO ── */}
      <ScoreboardHero
        agentFirstName={agentFirstName}
        weekNumber={currentWeek}
        weekRange={weekRange}
        streak={streak}
        thisWeekSub={thisWeekSub}
        onOpenCheckIn={() => setModalOpen(true)}
      />

      {/* ── Empty state OR data ── */}
      {noSubmissions ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <h3 className="text-base font-semibold text-reop-dark-blue mb-2">
            No check-ins yet — your scoreboard will fill in here.
          </h3>
          <p className="text-sm text-muted-foreground max-w-[460px] mx-auto mb-5">
            Submit your first weekly check-in. Streak, closings, GCI, conversion — all of it draws from your weekly numbers.
          </p>
          <Button size="lg" onClick={() => setModalOpen(true)}>
            Open check-in form
          </Button>
        </div>
      ) : subLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading scoreboard…
        </div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <KpiCard
              label="YTD closings"
              value={String(ytd.closings)}
              sub={
                goals.annual_closings_goal && closingsPace != null
                  ? `Goal ${goals.annual_closings_goal} · pace ${Math.round(closingsPace)}/yr`
                  : `${ytd.weeks} ${ytd.weeks === 1 ? 'week' : 'weeks'} logged`
              }
              progress={closingsProgress}
              trend={null}
            />
            <KpiCard
              label="YTD GCI"
              value={fmtCurrency(ytd.gci)}
              sub={
                goals.annual_gci_goal && gciPace != null
                  ? `Goal ${fmtCurrency(goals.annual_gci_goal)} · pace ${fmtCurrency(gciPace)}/yr`
                  : `avg ${fmtCurrency(ytd.weeks > 0 ? ytd.gci / ytd.weeks : 0)}/week`
              }
              progress={gciProgress}
              trend={null}
            />
            <KpiCard
              label="Conversations · last 4 wks"
              value={String(last4Convos)}
              sub={`avg ${Math.round(last4Convos / Math.max(1, last4.length))} / week`}
              progress={null}
              trend={convTrend}
            />
            <KpiCard
              label="Appts · last 4 wks"
              value={String(last4Appts)}
              sub={
                conversionPct == null
                  ? 'no appointments to convert yet'
                  : `${conversionPct}% appt → close YTD`
              }
              progress={null}
              trend={apptTrend}
            />
          </div>

          {/* ── Trajectory chart ── */}
          <section className="bg-card border border-border rounded-[14px] p-5 md:p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold tracking-[-0.01em] text-reop-dark-blue">
                  GCI trajectory — 6 months
                </h3>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">
                  This year vs same month last year. Goal line = annual ÷ 12.
                </p>
              </div>
            </div>
            <MonthlyTrajectoryChart
              submissions={submissions}
              mode="gci"
              annualGoal={goals.annual_gci_goal}
            />
          </section>

          {/* ── 2-col: growth goals + recent check-ins ── */}
          <div className="mb-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <GrowthGoalsCard />
            <RecentCheckInsPanel submissions={submissions} limit={6} />
          </div>
        </>
      )}

      <WeeklyCheckInModalV2
        open={modalOpen}
        onClose={closeModal}
        agentFirstName={agentFirstName}
      />
    </Layout>
  );
}

// ── KpiCard ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, trend, progress,
}: {
  label: string;
  value: string;
  sub: string;
  trend: { dir: 'up' | 'down' | 'flat'; text: string } | null;
  /** 0-100 progress toward annual goal — renders a thin bar at the bottom. */
  progress: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </div>
      <div className="mb-1 text-[34px] font-medium leading-none tracking-[-0.02em] text-reop-dark-blue">
        {value}
      </div>
      <div className="text-[12px] text-muted-foreground">{sub}</div>
      {progress != null && (
        <div className="mt-3 h-1.5 bg-[hsl(210_20%_94%)] rounded-full overflow-hidden" aria-label={`${progress}% to annual goal`}>
          <span
            className={cn(
              'block h-full rounded-full',
              progress >= 100 ? 'bg-reop-green' : 'bg-primary',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {trend && (
        <div
          className={cn(
            'mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold',
            trend.dir === 'up' && 'text-reop-green',
            trend.dir === 'down' && 'text-[hsl(35_80%_45%)]',
            trend.dir === 'flat' && 'text-muted-foreground',
          )}
        >
          <TrendIcon dir={trend.dir} />
          {trend.text}
        </div>
      )}
    </div>
  );
}

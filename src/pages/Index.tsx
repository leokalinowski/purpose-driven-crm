/**
 * Dashboard (route `/`) — agent's home page.
 *
 * Layout reference: design/dashboard-v2.html. Top-to-bottom:
 *   1. Hero band + Streak card  (grid 1.65fr / 1fr)
 *   2. Modules row              (3 columns: Sphere touches, Pipeline value, Delight sent)
 *   3. Recent activity + Upcoming  (split 1.1fr / 1fr)
 *   4. Jump back in             (shortcuts grid)
 *
 * Every number is a real query. No fabricated trends, no
 * Coach-recommended contact bleeding into the agent's greeting.
 */

import { Helmet } from 'react-helmet-async';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { useCompletedSphereTouchesThisWeek } from '@/hooks/useCompletedSphereTouchesThisWeek';
import { usePipeline } from '@/hooks/usePipeline';
import { useDelightOpportunities } from '@/hooks/useDelight';
import { supabase } from '@/integrations/supabase/client';

import { CommanderHero, type HeroKpi } from '@/components/dashboard/CommanderHero';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { Modules } from '@/components/dashboard/Modules';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents';
import { JumpBackIn } from '@/components/dashboard/JumpBackIn';

// ─── Time / greeting helpers ─────────────────────────────────────────

const today = new Date();
const greetDate = today.toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const hourNow = today.getHours();
const greeting = hourNow < 12 ? 'Good morning' : hourNow < 18 ? 'Good afternoon' : 'Good evening';

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

// ─── Prior-year YTD-equivalent count ─────────────────────────────────
// Used by the "YTD closed" KPI to render "vs N last yr". Counts
// closed_won opportunities with actual_close_date >= Jan 1 prior year
// AND <= today's date in the prior year. Only renders when > 0.

function usePriorYearYtdClosed(): number | null {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const priorJan1 = new Date(now.getFullYear() - 1, 0, 1);
      const priorSameDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const { count: c, error } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .eq('outcome', 'closed_won')
        .gte('actual_close_date', priorJan1.toISOString())
        .lte('actual_close_date', priorSameDate.toISOString());
      if (cancelled) return;
      if (error) {
        console.warn('[usePriorYearYtdClosed]', error.message);
        return;
      }
      setCount(c ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  return count;
}

// ─── YTD conversations from coaching_submissions ─────────────────────
// Drives the 4th Hero KPI. Source of truth: agent-self-reported weekly
// `conversations` count from the Scoreboard check-in. Compared to the
// same period last year (current week number and earlier).
//
// Math safety: the table does NOT have a unique constraint on
// (agent_id, year, week_number). If duplicates ever appear, we dedupe
// per-week by taking MAX(conversations) — i.e. the most-generous count
// for that week. SUM is then over the deduped per-week values.

interface YtdConversationsState {
  ytd: number;
  priorYearSamePeriod: number | null;
  weeksWithData: number;
  loading: boolean;
}

function useYtdConversations(): YtdConversationsState {
  const { user } = useAuth();
  const [state, setState] = useState<YtdConversationsState>({
    ytd: 0,
    priorYearSamePeriod: null,
    weeksWithData: 0,
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      // ISO year + ISO week for matching against coaching_submissions
      // (which uses ISO week_number and year — consistent with rest of
      // the coaching system).
      const isoYear = (() => {
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - day);
        return d.getUTCFullYear();
      })();
      const isoWeek = (() => {
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      })();

      // Two queries in parallel.
      const [thisYearRes, priorYearRes] = await Promise.all([
        supabase
          .from('coaching_submissions')
          .select('week_number, conversations')
          .eq('agent_id', user.id)
          .eq('year', isoYear),
        supabase
          .from('coaching_submissions')
          .select('week_number, conversations')
          .eq('agent_id', user.id)
          .eq('year', isoYear - 1)
          .lte('week_number', isoWeek),
      ]);

      if (cancelled) return;

      if (thisYearRes.error) {
        console.warn('[useYtdConversations] this year:', thisYearRes.error.message);
      }
      if (priorYearRes.error) {
        console.warn('[useYtdConversations] prior year:', priorYearRes.error.message);
      }

      // Dedupe per-week: MAX(conversations) per week_number, then sum.
      // Defensive against the missing UNIQUE constraint on
      // (agent_id, year, week_number).
      const dedupeAndSum = (rows: Array<{ week_number: number; conversations: number | null }>) => {
        const byWeek = new Map<number, number>();
        for (const r of rows) {
          const c = r.conversations ?? 0;
          const existing = byWeek.get(r.week_number);
          if (existing === undefined || c > existing) byWeek.set(r.week_number, c);
        }
        let sum = 0;
        for (const v of byWeek.values()) sum += v;
        return { sum, weeks: byWeek.size };
      };

      const thisYear = dedupeAndSum(thisYearRes.data ?? []);
      const priorYear = dedupeAndSum(priorYearRes.data ?? []);

      setState({
        ytd: thisYear.sum,
        priorYearSamePeriod: priorYear.weeks > 0 ? priorYear.sum : null,
        weeksWithData: thisYear.weeks,
        loading: false,
      });
    })().catch((err) => {
      console.warn('[useYtdConversations] failed:', err);
      if (!cancelled) setState((s) => ({ ...s, loading: false }));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return state;
}

// ─── Component ───────────────────────────────────────────────────────

export default function Index() {
  const { profile, loading: profileLoading } = useUserProfile();
  // Empty while the profile is still loading — CommanderHero renders just
  // the greeting until we have a real name to show, so we never flash
  // "{greeting}, Email address." before swapping to the real first name.
  // Falls back to `'there'` only if the loaded profile has no usable name.
  const firstName = (() => {
    if (profileLoading) return '';
    const fromProfile = (profile?.first_name ?? '').trim();
    if (fromProfile) return fromProfile.split(' ')[0];
    const fromLast = (profile?.last_name ?? '').trim();
    if (fromLast) return fromLast;
    return 'there';
  })();

  const { callTasks, textTasks, historicalStats, currentWeek } = useSphereSyncTasks();
  const { metrics: pipelineMetrics } = usePipeline();
  const { data: delightOpps = [] } = useDelightOpportunities(7);
  const priorYearYtdClosed = usePriorYearYtdClosed();
  const { ytd: ytdConversations, priorYearSamePeriod: priorYearConvs, weeksWithData: convWeeks } =
    useYtdConversations();
  const sphereTouchesThisWeek = useCompletedSphereTouchesThisWeek();

  // ── Hero numbers ────────────────────────────────────────────────────
  // "Remaining" uses this week's *assigned* tasks (denominator-style) so
  // the subline's "X calls / Y texts stand between you and a perfect week"
  // reflects what's still on Pam's plate for the current rotation.
  const totalCalls = callTasks.length;
  const completedCallsAssigned = callTasks.filter((t) => t.completed).length;
  const remainingCalls = Math.max(0, totalCalls - completedCallsAssigned);

  const totalTexts = textTasks.length;
  const completedTextsAssigned = textTasks.filter((t) => t.completed).length;
  const remainingTexts = Math.max(0, totalTexts - completedTextsAssigned);

  // The headline "Sphere touches" KPI counts EVERY sphere task completed
  // this week — including catch-up completions of tasks assigned to a
  // prior week. This is why Recent Activity can show touches while the
  // assignment-based count showed 0.
  const completedTouches = sphereTouchesThisWeek.calls + sphereTouchesThisWeek.texts;
  const totalTouches = totalCalls + totalTexts;

  const giftsAhead = delightOpps.length;
  const ytdClosed = pipelineMetrics.closedDeals ?? 0;

  // ── Hero sub-line — computed from real numbers ─────────────────────
  let subline: string | null;
  if (remainingCalls + remainingTexts + giftsAhead === 0 && totalCalls + totalTexts > 0) {
    subline = "You're caught up on outreach. Take a victory lap.";
  } else if (remainingCalls + remainingTexts + giftsAhead === 0) {
    // No tasks generated yet AND no gift opportunities — fall back to a
    // neutral status sentence rather than fabricating one.
    subline = `${ytdClosed} closing${ytdClosed === 1 ? '' : 's'} this year so far. The week's ahead.`;
  } else {
    const parts: string[] = [];
    if (remainingCalls > 0) parts.push(`${remainingCalls} call${remainingCalls === 1 ? '' : 's'}`);
    if (remainingTexts > 0) parts.push(`${remainingTexts} text${remainingTexts === 1 ? '' : 's'}`);
    if (giftsAhead > 0) parts.push(`${giftsAhead} gift${giftsAhead === 1 ? '' : 's'} this week`);
    // Join with commas + final "and" for 3 items; just "and" for 2.
    let joined = '';
    if (parts.length === 1) {
      joined = parts[0];
    } else if (parts.length === 2) {
      joined = `${parts[0]} and ${parts[1]}`;
    } else if (parts.length === 3) {
      joined = `${parts[0]}, ${parts[1]}, and ${parts[2]}`;
    }
    subline = `${joined} stand between you and another perfect week.`;
  }

  // ── Sphere-touches trend chip wording ──────────────────────────────
  // "On pace" when completion % >= elapsed-week %, otherwise show the gap.
  const todayDow = today.getDay(); // 0 = Sun, but ISO week starts Mon
  const elapsedDays = todayDow === 0 ? 7 : todayDow; // 1..7
  const expectedFracComplete = elapsedDays / 7;
  const actualFracComplete = totalTouches > 0 ? completedTouches / totalTouches : 0;
  const touchesTrend = totalTouches === 0
    ? 'No tasks yet'
    : actualFracComplete >= expectedFracComplete
      ? 'On pace'
      : `${Math.round((expectedFracComplete - actualFracComplete) * totalTouches)} behind`;

  // ── KPI cells ──────────────────────────────────────────────────────
  const kpis: [HeroKpi, HeroKpi, HeroKpi, HeroKpi] = [
    {
      label: 'Sphere touches',
      value: String(completedTouches),
      valueSub: totalTouches > 0 ? `/${totalTouches}` : undefined,
      trend: touchesTrend,
    },
    {
      label: 'Active pipeline',
      value: formatCompactCurrency(pipelineMetrics.pipelineValue),
      trend: `${pipelineMetrics.totalOpportunities} active opportunit${pipelineMetrics.totalOpportunities === 1 ? 'y' : 'ies'}`,
    },
    {
      label: 'YTD closed',
      value: String(ytdClosed),
      valueSub: ytdClosed === 1 ? 'closing' : 'closings',
      trend:
        priorYearYtdClosed != null && priorYearYtdClosed > 0
          ? `vs ${priorYearYtdClosed} last yr`
          : ytdClosed > 0
            ? 'Closed this year'
            : undefined,
    },
    {
      label: 'Conversations YTD',
      value: ytdConversations.toLocaleString(),
      // Trend chip (in priority order):
      //   1) Compare to same period last ISO year → "vs N last yr (+X%)"
      //   2) Otherwise show average per week → "Avg N/wk"
      //   3) Nothing logged yet → clickable "Submit check-in →"
      trend: ytdConversations === 0
        ? 'Submit check-in →'
        : priorYearConvs != null && priorYearConvs > 0
          ? (() => {
              const delta = Math.round(((ytdConversations - priorYearConvs) / priorYearConvs) * 100);
              const sign = delta >= 0 ? '+' : '';
              return `vs ${priorYearConvs.toLocaleString()} last yr (${sign}${delta}%)`;
            })()
          : convWeeks > 0
            ? `Avg ${Math.round(ytdConversations / convWeeks)}/wk`
            : undefined,
      trendLink: ytdConversations === 0 ? '/scoreboard' : undefined,
    },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard — Real Estate on Purpose</title>
      </Helmet>
      <Layout>
        {/* Hero band + Streak card */}
        <div className="grid xl:grid-cols-[1.65fr_1fr] gap-4 mb-6">
          <CommanderHero
            firstName={firstName}
            greeting={greeting}
            dateLabel={greetDate}
            subline={subline}
            kpis={kpis}
          />
          <StreakCard
            historicalStats={historicalStats}
            currentWeek={{ weekNumber: currentWeek.weekNumber, year: currentWeek.isoYear }}
            remainingCalls={remainingCalls}
          />
        </div>

        {/* 3 modules */}
        <Modules />

        {/* Recent activity + Upcoming split */}
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 mb-6">
          <RecentActivityFeed limit={5} />
          <UpcomingEvents limit={5} />
        </div>

        {/* Shortcuts */}
        <JumpBackIn />
      </Layout>
    </>
  );
}

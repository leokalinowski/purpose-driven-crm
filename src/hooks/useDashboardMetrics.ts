import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { addMonths, subMonths, startOfMonth } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// NOTE: date-fns-tz v3 uses named exports and renamed helpers.
// We'll use toZonedTime/fromZonedTime via their modules for better tree-shaking.

const ET_TZ = 'America/New_York';

export type KPI = {
  label: string;
  value: number | string;
  deltaPct?: number; // positive or negative percentage change
  subtext?: string;
};

export type MonthlyPoint = { month: string; value: number };

export type DashboardData = {
  kpis: {
    totalContacts: KPI;
    sphereSyncCompletionRate: KPI;
    upcomingEvents: KPI;
    newsletterOpenRate: KPI;
    activeTransactions: KPI;
    coachingSessions: KPI;
  };
  charts: {
    leadsTrend: MonthlyPoint[];
    tasksTrend: MonthlyPoint[];
    transactionsTrend: MonthlyPoint[];
  };
};

function getETMonthBoundaries(reference: Date) {
  // Convert "now" to ET, get start of month, then convert boundaries to UTC
  // Using the module path import above to avoid default import issues.
  const etNow = toZonedTime(reference, ET_TZ) as unknown as Date;
  const currentStartET = startOfMonth(etNow);
  const nextStartET = startOfMonth(addMonths(etNow, 1));
  const prevStartET = startOfMonth(subMonths(etNow, 1));

  const currentStartUTC = fromZonedTime(currentStartET as unknown as Date, ET_TZ) as unknown as Date;
  const nextStartUTC = fromZonedTime(nextStartET as unknown as Date, ET_TZ) as unknown as Date;
  const prevStartUTC = fromZonedTime(prevStartET as unknown as Date, ET_TZ) as unknown as Date;

  return {
    currentStart: currentStartUTC.toISOString(),
    nextStart: nextStartUTC.toISOString(),
    prevStart: prevStartUTC.toISOString(),
  };
}

function pctChange(curr: number, prev: number): number | undefined {
  if (prev === 0) return undefined;
  return ((curr - prev) / prev) * 100;
}

export function useDashboardMetrics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      try {
        const now = new Date();
        const { currentStart, nextStart, prevStart } = getETMonthBoundaries(now);

        // Contacts totals and monthly adds
        const [{ count: totalContactsNow }, { count: contactsCurr }, { count: contactsPrev }] = await Promise.all([
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('agent_id', user.id),
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('agent_id', user.id).gte('created_at', currentStart).lt('created_at', nextStart),
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('agent_id', user.id).gte('created_at', prevStart).lt('created_at', currentStart),
        ]);

        // PO2 completion rate this month
        const [tasksCreatedCurrRes, tasksCompletedCurrRes, tasksCompletedPrevRes] = await Promise.all([
          supabase.from('spheresync_tasks').select('id', { count: 'exact', head: true }).eq('agent_id', user.id).gte('created_at', currentStart).lt('created_at', nextStart),
          supabase.from('spheresync_tasks').select('id', { count: 'exact', head: true }).eq('agent_id', user.id).eq('completed', true).gte('completed_at', currentStart).lt('completed_at', nextStart),
          supabase.from('spheresync_tasks').select('id', { count: 'exact', head: true }).eq('agent_id', user.id).eq('completed', true).gte('completed_at', prevStart).lt('completed_at', currentStart),
        ]);

        const tasksCreatedCurr = tasksCreatedCurrRes.count || 0;
        const tasksCompletedCurr = tasksCompletedCurrRes.count || 0;
        const tasksCompletedPrev = tasksCompletedPrevRes.count || 0;
        const completionRate = tasksCreatedCurr ? (tasksCompletedCurr / tasksCreatedCurr) * 100 : 0;
        const completionRatePrev = tasksCreatedCurr ? (tasksCompletedPrev / tasksCreatedCurr) * 100 : 0; // comparable baseline

        // Upcoming events next 30 days vs events in previous month
        const todayISO = new Date().toISOString();
        const in30DaysISO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const [{ count: upcomingEventsCount }, { count: eventsPrevMonth }] = await Promise.all([
          supabase.from('events').select('id', { count: 'exact', head: true }).eq('agent_id', user.id).gte('event_date', todayISO).lt('event_date', in30DaysISO),
          supabase.from('events').select('id', { count: 'exact', head: true }).eq('agent_id', user.id).gte('event_date', prevStart).lt('event_date', currentStart),
        ]);

        // Newsletter open rate average this month vs previous
        const [newsCurrRes, newsPrevRes] = await Promise.all([
          supabase.from('newsletter_campaigns').select('open_rate').eq('created_by', user.id).gte('created_at', currentStart).lt('created_at', nextStart),
          supabase.from('newsletter_campaigns').select('open_rate').eq('created_by', user.id).gte('created_at', prevStart).lt('created_at', currentStart),
        ]);
        const avg = (arr: any[] | null | undefined) => {
          const vals = (arr || []).map((r: any) => Number(r.open_rate) || 0);
          if (!vals.length) return 0;
          return vals.reduce((a, b) => a + b, 0) / vals.length;
        };
        const openRateCurr = avg(newsCurrRes.data);
        const openRatePrev = avg(newsPrevRes.data);

        // Active transactions now (not closed) and created this vs last month for comparison
        const [{ data: activeTxData }, { count: txCreatedCurr }, { count: txCreatedPrev }] = await Promise.all([
          supabase.from('transaction_coordination').select('id, transaction_stage').eq('responsible_agent', user.id),
          supabase.from('transaction_coordination').select('id', { count: 'exact', head: true }).eq('responsible_agent', user.id).gte('created_at', currentStart).lt('created_at', nextStart),
          supabase.from('transaction_coordination').select('id', { count: 'exact', head: true }).eq('responsible_agent', user.id).gte('created_at', prevStart).lt('created_at', currentStart),
        ]);
        const activeTx = (activeTxData || []).filter((t: any) => (t.transaction_stage || '').toLowerCase() !== 'closed').length;

        // Coaching sessions completed this month vs previous
        const [{ count: sessionsCurr }, { count: sessionsPrev }] = await Promise.all([
          supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }).eq('agent_id', user.id).gte('session_date', currentStart).lt('session_date', nextStart),
          supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }).eq('agent_id', user.id).gte('session_date', prevStart).lt('session_date', currentStart),
        ]);

        // Trends for last 6 months (compute client-side)
        const sixMonthsAgoETStart = startOfMonth(subMonths(toZonedTime(now, ET_TZ) as unknown as Date, 5));
        const sixMonthsAgoUTC = fromZonedTime(sixMonthsAgoETStart as unknown as Date, ET_TZ) as unknown as Date;
        const sinceISO = sixMonthsAgoUTC.toISOString();
        const [contactsSince, tasksSince, txSince] = await Promise.all([
          supabase.from('contacts').select('id, created_at').eq('agent_id', user.id).gte('created_at', sinceISO),
          supabase.from('spheresync_tasks').select('id, completed_at').eq('agent_id', user.id).not('completed_at', 'is', null).gte('completed_at', sinceISO),
          supabase.from('transaction_coordination').select('id, created_at').eq('responsible_agent', user.id).gte('created_at', sinceISO),
        ]);

        const monthKey = (d: string) => {
          const dt = new Date(d);
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        };
        const initMonths: Record<string, number> = {};
        for (let i = 5; i >= 0; i--) {
          const d = subMonths(now, i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          initMonths[key] = 0;
        }

        const agg = (rows: any[], field: 'created_at' | 'completed_at') => {
          const map = { ...initMonths };
          (rows || []).forEach((r) => {
            const key = monthKey(r[field]);
            if (key in map) map[key] += 1;
          });
          return Object.entries(map).map(([month, value]) => ({ month, value }));
        };

        const leadsTrend = agg(contactsSince.data || [], 'created_at');
        const tasksTrend = agg(tasksSince.data || [], 'completed_at');
        const transactionsTrend = agg(txSince.data || [], 'created_at');

        const result: DashboardData = {
          kpis: {
            totalContacts: {
              label: 'Total Leads',
              value: totalContactsNow || 0,
              deltaPct: pctChange((contactsCurr || 0), (contactsPrev || 0)),
              subtext: 'From last month',
            },
            sphereSyncCompletionRate: {
              label: 'SphereSync Completion Rate',
              value: `${Math.round(completionRate)}%`,
              deltaPct: pctChange(completionRate, completionRatePrev),
              subtext: 'This month',
            },
            upcomingEvents: {
              label: 'Upcoming Events (30d)',
              value: upcomingEventsCount || 0,
              deltaPct: pctChange((upcomingEventsCount || 0), (eventsPrevMonth || 0)),
              subtext: 'vs. last month',
            },
            newsletterOpenRate: {
              label: 'Newsletter Open Rate',
              value: `${Math.round(openRateCurr || 0)}%`,
              deltaPct: pctChange((openRateCurr || 0), (openRatePrev || 0)),
              subtext: 'Avg this month',
            },
            activeTransactions: {
              label: 'Active Transactions',
              value: activeTx,
              deltaPct: pctChange((txCreatedCurr || 0), (txCreatedPrev || 0)),
              subtext: 'New vs last month',
            },
            coachingSessions: {
              label: 'Coaching Sessions',
              value: sessionsCurr || 0,
              deltaPct: pctChange((sessionsCurr || 0), (sessionsPrev || 0)),
              subtext: 'This month',
            },
          },
          charts: { leadsTrend, tasksTrend, transactionsTrend },
        };

        if (!cancelled) setData(result);
      } catch (e) {
        console.error('Failed to load dashboard metrics', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();

    // Realtime updates to refresh
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spheresync_tasks' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_campaigns' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_coordination' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_sessions' }, () => fetchAll())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { data, loading };
}

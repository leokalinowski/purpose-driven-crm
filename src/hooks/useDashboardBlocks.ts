import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfWeek, endOfWeek, subWeeks, format, differenceInDays, startOfYear } from 'date-fns';

// ---------- Types ----------

export type TouchpointBreakdown = {
  spheresync: number;
  events: number;
  newsletter: number;
  social: number;
};

export type BlockOneTouchpoints = {
  totalTouchpoints: number;
  uniqueContactsTouched: number;
  breakdown: TouchpointBreakdown;
};

export type SystemTask = {
  id: string;
  title: string;
  subtitle?: string;
  dueDate?: string;
  status?: string;
  contactName?: string;
  contactPhone?: string;
  taskType?: string;
  navigateTo?: string;
};

export type BlockTwoTasks = {
  spheresync: SystemTask[];
  events: SystemTask[];
  newsletter: SystemTask[];
  social: SystemTask[];
  scoreboard: { submitted: boolean; weekNumber: number };
};

export type BlockThreeOpportunity = {
  databaseSize: number;
  annualTarget: number;
  monthlyTarget: number;
  currentYearTransactions: number;
  gap: number;
  potentialGCI: number;
  progressPct: number;
};

export type WeeklyPerformance = {
  week: string;
  rate: number;
};

export type BlockFourPerformance = {
  currentWeekPct: number;
  completedThisWeek: number;
  totalThisWeek: number;
  trend: WeeklyPerformance[];
  bySystem: { label: string; completed: number; total: number }[];
};

export type OverdueTask = {
  id: string;
  system: 'spheresync' | 'events' | 'coaching';
  title: string;
  daysOverdue: number;
  contactPhone?: string;
  navigateTo?: string;
};

export type BlockFiveOverdue = {
  tasks: OverdueTask[];
};

export type DashboardBlocks = {
  blockOne: BlockOneTouchpoints;
  blockTwo: BlockTwoTasks;
  blockThree: BlockThreeOpportunity;
  blockFour: BlockFourPerformance;
  blockFive: BlockFiveOverdue;
};

// ---------- Helpers ----------

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ---------- Hook ----------

export function useDashboardBlocks() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const yearStart = startOfYear(now).toISOString();
      const currentWeekNum = getISOWeekNumber(now);
      const currentYear = now.getFullYear();

      // Fetch all data in parallel
      const [
        sphereTasksAll,
        sphereTasksWeek,
        eventTasksWeek,
        eventTasksOverdue,
        newsletterWeek,
        socialWeek,
        coachingThisWeek,
        coachingMissing,
        contactsCount,
        transactionsYear,
        eventEmailsWeek,
        // Historical data for trend (8 weeks)
        sphereTasksHistory,
        eventTasksHistory,
      ] = await Promise.all([
        // SphereSync: all incomplete for overdue
        supabase.from('spheresync_tasks').select('id, task_type, completed, completed_at, created_at, week_number, year, lead_id, notes')
          .eq('agent_id', user.id).eq('completed', false),
        // SphereSync: this week
        supabase.from('spheresync_tasks').select('id, task_type, completed, completed_at, created_at, week_number, year, lead_id, notes')
          .eq('agent_id', user.id).eq('week_number', currentWeekNum).eq('year', currentYear),
        // Event tasks: due this week, not completed
        supabase.from('event_tasks').select('id, task_name, due_date, status, completed_at, event_id, phase')
          .eq('agent_id', user.id).gte('due_date', weekStart.split('T')[0]).lte('due_date', weekEnd.split('T')[0]).is('completed_at', null),
        // Event tasks: overdue
        supabase.from('event_tasks').select('id, task_name, due_date, status, completed_at, event_id')
          .eq('agent_id', user.id).lt('due_date', now.toISOString().split('T')[0]).is('completed_at', null),
        // Newsletter: drafts or scheduled this week
        supabase.from('newsletter_campaigns').select('id, campaign_name, status, send_date, created_at')
          .eq('created_by', user.id).gte('created_at', weekStart).lte('created_at', weekEnd),
        // Social: scheduled this week, not posted
        supabase.from('social_posts').select('id, content, platform, schedule_time, status')
          .eq('agent_id', user.id).gte('schedule_time', weekStart).lte('schedule_time', weekEnd).neq('status', 'posted'),
        // Coaching: this week's submission
        supabase.from('coaching_submissions').select('id')
          .eq('agent_id', user.id).eq('week_number', currentWeekNum).eq('year', currentYear),
        // Coaching: past weeks without submission (last 4 weeks)
        supabase.from('coaching_submissions').select('week_number, year')
          .eq('agent_id', user.id).eq('year', currentYear).gte('week_number', currentWeekNum - 4),
        // Contacts count
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('agent_id', user.id),
        // Transactions this year
        supabase.from('transaction_coordination').select('id, gci, status, created_at')
          .eq('responsible_agent', user.id).gte('created_at', yearStart),
        // Event emails sent this week (touchpoints)
        supabase.from('event_emails').select('id, recipient_email')
          .gte('sent_at', weekStart).lte('sent_at', weekEnd),
        // Historical spheresync (last 8 weeks)
        supabase.from('spheresync_tasks').select('id, completed, completed_at, week_number, year')
          .eq('agent_id', user.id).gte('year', currentYear - 1),
        // Historical event tasks (last 8 weeks)
        supabase.from('event_tasks').select('id, completed_at, due_date, created_at')
          .eq('agent_id', user.id).gte('created_at', subWeeks(now, 8).toISOString()),
      ]);

      // ----- BLOCK ONE: Weekly Touchpoints -----
      const completedSphereThisWeek = (sphereTasksWeek.data || []).filter(t => t.completed);
      const sphereTouchpoints = completedSphereThisWeek.length;
      const eventEmailsTouchpoints = eventEmailsWeek.data?.length || 0;
      const newsletterTouchpoints = (newsletterWeek.data || []).filter((n: any) => n.status === 'sent').length;
      const socialTouchpoints = (socialWeek.data || []).filter(s => s.status === 'posted').length;

      // Unique contacts: sphere lead_ids + event email recipients
      const contactIds = new Set<string>();
      completedSphereThisWeek.forEach(t => { if (t.lead_id) contactIds.add(t.lead_id); });
      (eventEmailsWeek.data || []).forEach(e => { if (e.recipient_email) contactIds.add(e.recipient_email); });

      const blockOne: BlockOneTouchpoints = {
        totalTouchpoints: sphereTouchpoints + eventEmailsTouchpoints + newsletterTouchpoints + socialTouchpoints,
        uniqueContactsTouched: contactIds.size,
        breakdown: {
          spheresync: sphereTouchpoints,
          events: eventEmailsTouchpoints,
          newsletter: newsletterTouchpoints,
          social: socialTouchpoints,
        },
      };

      // ----- BLOCK TWO: Tasks by System -----
      const sphereTasks: SystemTask[] = (sphereTasksWeek.data || []).filter(t => !t.completed).map(t => ({
        id: t.id,
        title: t.task_type === 'call' ? 'Make a Call' : 'Send a Text',
        taskType: t.task_type,
        contactName: t.lead_id || undefined,
        subtitle: t.notes || undefined,
      }));

      const eventTasks: SystemTask[] = (eventTasksWeek.data || []).map(t => ({
        id: t.id,
        title: t.task_name,
        dueDate: t.due_date || undefined,
        status: t.status || 'pending',
        navigateTo: '/events',
      }));

      const newsletterTasks: SystemTask[] = (newsletterWeek.data || []).filter((n: any) => n.status !== 'sent').map((n: any) => ({
        id: n.id,
        title: n.campaign_name || 'Untitled Campaign',
        status: n.status || 'draft',
        dueDate: n.send_date || undefined,
        navigateTo: '/newsletter',
      }));

      const socialTasks: SystemTask[] = (socialWeek.data || []).map(s => ({
        id: s.id,
        title: s.content?.substring(0, 60) + (s.content && s.content.length > 60 ? '...' : ''),
        subtitle: s.platform,
        dueDate: s.schedule_time,
        status: s.status,
        navigateTo: '/social-scheduler',
      }));

      const blockTwo: BlockTwoTasks = {
        spheresync: sphereTasks,
        events: eventTasks,
        newsletter: newsletterTasks,
        social: socialTasks,
        scoreboard: {
          submitted: (coachingThisWeek.data?.length || 0) > 0,
          weekNumber: currentWeekNum,
        },
      };

      // ----- BLOCK THREE: Transaction Opportunity -----
      const dbSize = contactsCount.count || 0;
      const annualTarget = Math.round(dbSize / 6);
      const monthlyTarget = Math.round(annualTarget / 12);
      const yearTransactions = transactionsYear.data?.length || 0;
      const closedTransactions = transactionsYear.data?.filter(t => t.status === 'closed').length || 0;
      const avgGCI = transactionsYear.data && transactionsYear.data.length > 0
        ? transactionsYear.data.reduce((sum, t) => sum + (t.gci || 0), 0) / transactionsYear.data.length
        : 8000;
      const gap = Math.max(0, annualTarget - yearTransactions);
      const potentialGCI = Math.round(gap * avgGCI);
      const monthsElapsed = now.getMonth() + 1;
      const expectedByNow = Math.round((annualTarget / 12) * monthsElapsed);
      const progressPct = expectedByNow > 0 ? Math.min(100, Math.round((yearTransactions / expectedByNow) * 100)) : 0;

      const blockThree: BlockThreeOpportunity = {
        databaseSize: dbSize,
        annualTarget,
        monthlyTarget,
        currentYearTransactions: yearTransactions,
        gap,
        potentialGCI,
        progressPct,
      };

      // ----- BLOCK FOUR: Performance -----
      const allSphereWeek = sphereTasksWeek.data || [];
      const completedSphereCount = allSphereWeek.filter(t => t.completed).length;
      const totalSphereCount = allSphereWeek.length;

      const allEventWeek = eventTasksWeek.data || [];
      const completedEventCount = 0; // these are filtered to non-completed
      const totalEventCount = allEventWeek.length;

      const totalThisWeek = totalSphereCount + totalEventCount + (blockTwo.scoreboard.submitted ? 0 : 1);
      const completedThisWeek = completedSphereCount + completedEventCount + (blockTwo.scoreboard.submitted ? 1 : 0);
      const currentWeekPct = totalThisWeek > 0 ? Math.round((completedThisWeek / totalThisWeek) * 100) : 0;

      // Build 8-week trend from spheresync history
      const trend: WeeklyPerformance[] = [];
      for (let i = 7; i >= 0; i--) {
        const wDate = subWeeks(now, i);
        const wNum = getISOWeekNumber(wDate);
        const wYear = wDate.getFullYear();
        const weekTasks = (sphereTasksHistory.data || []).filter(t => t.week_number === wNum && t.year === wYear);
        const weekCompleted = weekTasks.filter(t => t.completed).length;
        const weekTotal = weekTasks.length;
        trend.push({
          week: `W${wNum}`,
          rate: weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0,
        });
      }

      const blockFour: BlockFourPerformance = {
        currentWeekPct,
        completedThisWeek,
        totalThisWeek,
        trend,
        bySystem: [
          { label: 'SphereSync', completed: completedSphereCount, total: totalSphereCount },
          { label: 'Events', completed: completedEventCount, total: totalEventCount },
          { label: 'Scoreboard', completed: blockTwo.scoreboard.submitted ? 1 : 0, total: 1 },
        ],
      };

      // ----- BLOCK FIVE: Overdue -----
      const overdueItems: OverdueTask[] = [];

      // SphereSync overdue: incomplete tasks from past weeks
      (sphereTasksAll.data || []).forEach(t => {
        if (t.week_number && t.year) {
          const isCurrentWeek = t.week_number === currentWeekNum && t.year === currentYear;
          if (!isCurrentWeek) {
            // Approximate days overdue from week_number
            const weeksDiff = (currentYear - (t.year || currentYear)) * 52 + (currentWeekNum - (t.week_number || currentWeekNum));
            overdueItems.push({
              id: t.id,
              system: 'spheresync',
              title: `${t.task_type === 'call' ? 'Call' : 'Text'} task from W${t.week_number}`,
              daysOverdue: weeksDiff * 7,
              navigateTo: '/spheresync-tasks',
            });
          }
        }
      });

      // Event tasks overdue
      (eventTasksOverdue.data || []).forEach(t => {
        const days = differenceInDays(now, new Date(t.due_date!));
        overdueItems.push({
          id: t.id,
          system: 'events',
          title: t.task_name,
          daysOverdue: days,
          navigateTo: '/events',
        });
      });

      // Coaching: missing past weeks (check last 4 weeks)
      const submittedWeeks = new Set((coachingMissing.data || []).map(s => `${s.year}-${s.week_number}`));
      for (let i = 1; i <= 4; i++) {
        const pastWeek = currentWeekNum - i;
        if (pastWeek > 0 && !submittedWeeks.has(`${currentYear}-${pastWeek}`)) {
          overdueItems.push({
            id: `coaching-${currentYear}-${pastWeek}`,
            system: 'coaching',
            title: `Scoreboard submission missing for W${pastWeek}`,
            daysOverdue: i * 7,
            navigateTo: '/coaching',
          });
        }
      }

      overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

      const blockFive: BlockFiveOverdue = { tasks: overdueItems };

      setData({ blockOne, blockTwo, blockThree, blockFour, blockFive });
    } catch (err) {
      console.error('Dashboard blocks fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

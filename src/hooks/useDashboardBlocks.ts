import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfWeek, endOfWeek, subWeeks, differenceInDays, startOfYear } from 'date-fns';

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
  contactName?: string;
  contactPhone?: string;
  weekNumber?: number;
  navigateTo?: string;
};

export type BlockFiveOverdue = {
  accountabilityScore: number;
  priorityTasks: OverdueTask[];
  nextMilestone: { score: number; tasksNeeded: number };
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

      // Step 1: Fetch user's event IDs first (needed to scope event_emails)
      const { data: userEvents } = await supabase
        .from('events')
        .select('id')
        .eq('agent_id', user.id);
      const userEventIds = (userEvents || []).map(e => e.id);

      // Step 2: Fetch all data in parallel
      const [
        sphereTasksAll,
        sphereTasksWeek,
        eventTasksWeekAll,     // All event tasks this week (for performance)
        eventTasksOverdue,
        newsletterWeek,
        socialWeekAll,         // All social posts this week (both posted and pending)
        coachingThisWeek,
        coachingMissing,
        contactsCount,
        transactionsYear,
        eventEmailsWeek,
        sphereTasksHistory,
        eventTasksHistory,
        coachingHistory,
      ] = await Promise.all([
        // SphereSync: all incomplete for overdue
        supabase.from('spheresync_tasks').select('id, task_type, completed, completed_at, created_at, week_number, year, lead_id, notes')
          .eq('agent_id', user.id).eq('completed', false),
        // SphereSync: this week
        supabase.from('spheresync_tasks').select('id, task_type, completed, completed_at, created_at, week_number, year, lead_id, notes')
          .eq('agent_id', user.id).eq('week_number', currentWeekNum).eq('year', currentYear),
        // Event tasks: ALL for this week (completed + incomplete) for accurate performance tracking
        supabase.from('event_tasks').select('id, task_name, due_date, status, completed_at, event_id, phase, created_at')
          .eq('agent_id', user.id).gte('due_date', weekStart.split('T')[0]).lte('due_date', weekEnd.split('T')[0]),
        // Event tasks: overdue
        supabase.from('event_tasks').select('id, task_name, due_date, status, completed_at, event_id, created_at')
          .eq('agent_id', user.id).lt('due_date', now.toISOString().split('T')[0]).is('completed_at', null),
        // Newsletter: drafts or scheduled this week
        supabase.from('newsletter_campaigns').select('id, campaign_name, status, send_date, created_at')
          .eq('created_by', user.id).gte('created_at', weekStart).lte('created_at', weekEnd),
        // Social: ALL posts this week (remove .neq filter so we can split client-side)
        supabase.from('social_posts').select('id, content, platform, schedule_time, status')
          .eq('agent_id', user.id).gte('schedule_time', weekStart).lte('schedule_time', weekEnd),
        // Coaching: this week's submission
        supabase.from('coaching_submissions').select('id')
          .eq('agent_id', user.id).eq('week_number', currentWeekNum).eq('year', currentYear),
        // Coaching: past weeks without submission (last 4 weeks)
        supabase.from('coaching_submissions').select('week_number, year')
          .eq('agent_id', user.id).eq('year', currentYear).gte('week_number', currentWeekNum - 4),
        // Contacts count
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('agent_id', user.id),
        // Closings this year (self-reported from coaching submissions)
        supabase.from('coaching_submissions').select('closings')
          .eq('agent_id', user.id).eq('year', currentYear),
        // Event emails: SCOPED to user's events only
        ...(userEventIds.length > 0
          ? [supabase.from('event_emails').select('id, recipient_email, event_id')
              .in('event_id', userEventIds)
              .gte('sent_at', weekStart).lte('sent_at', weekEnd)]
          : [Promise.resolve({ data: [], error: null })]),
        // Historical spheresync (last 8 weeks)
        supabase.from('spheresync_tasks').select('id, completed, completed_at, week_number, year')
          .eq('agent_id', user.id).gte('year', currentYear - 1),
        // Historical event tasks (last 8 weeks)
        supabase.from('event_tasks').select('id, completed_at, due_date, created_at')
          .eq('agent_id', user.id).gte('created_at', subWeeks(now, 8).toISOString()),
        // Historical coaching (for trend)
        supabase.from('coaching_submissions').select('week_number, year')
          .eq('agent_id', user.id).eq('year', currentYear),
      ]);

      // ----- BLOCK ONE: Weekly Touchpoints -----
      const completedSphereThisWeek = (sphereTasksWeek.data || []).filter(t => t.completed);
      const sphereTouchpoints = completedSphereThisWeek.length;
      const eventEmailsTouchpoints = (eventEmailsWeek as any).data?.length || 0;
      const newsletterTouchpoints = (newsletterWeek.data || []).filter((n: any) => n.status === 'sent').length;
      // Fix Bug 5: filter posted from the full list (no longer pre-filtered)
      const socialTouchpoints = (socialWeekAll.data || []).filter(s => s.status === 'posted').length;

      // Unique contacts: sphere lead_ids + event email recipients (approximation — different ID types)
      const contactIds = new Set<string>();
      completedSphereThisWeek.forEach(t => { if (t.lead_id) contactIds.add(t.lead_id); });
      ((eventEmailsWeek as any).data || []).forEach((e: any) => { if (e.recipient_email) contactIds.add(e.recipient_email); });

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

      // Fetch contact names for this week's sphere tasks
      const incompleteSphere = (sphereTasksWeek.data || []).filter(t => !t.completed);
      const weekLeadIds = incompleteSphere.map(t => t.lead_id).filter(Boolean) as string[];
      let weekContactMap = new Map<string, { name: string; phone?: string }>();
      if (weekLeadIds.length > 0) {
        const { data: weekContacts } = await supabase.from('contacts')
          .select('id, first_name, last_name, phone').in('id', weekLeadIds);
        (weekContacts || []).forEach(c => {
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
          if (name) weekContactMap.set(c.id, { name, phone: c.phone || undefined });
        });
      }

      const sphereTasks: SystemTask[] = incompleteSphere.map(t => {
        const contact = t.lead_id ? weekContactMap.get(t.lead_id) : undefined;
        return {
          id: t.id,
          title: contact?.name
            ? `${t.task_type === 'call' ? 'Call' : 'Text'} ${contact.name}`
            : (t.task_type === 'call' ? 'Make a Call' : 'Send a Text'),
          taskType: t.task_type,
          contactName: contact?.name,
          contactPhone: contact?.phone,
          subtitle: contact?.phone || t.notes || undefined,
        };
      });

      // For task list, only show incomplete event tasks with born-overdue guard
      const incompleteEventTasks = (eventTasksWeekAll.data || []).filter(t => {
        if (t.completed_at) return false;
        const created = new Date(t.created_at);
        const due = new Date(t.due_date);
        return created <= due; // exclude born-overdue template tasks
      });
      const eventTasks: SystemTask[] = incompleteEventTasks.map(t => ({
        id: t.id,
        title: t.task_name,
        dueDate: t.due_date || undefined,
        status: t.status || 'pending',
        navigateTo: '/events',
      }));

      // Newsletter: compute virtual tasks based on frequency settings
      const { data: nlSettings } = await (supabase as any)
        .from('newsletter_task_settings')
        .select('*')
        .eq('agent_id', user.id)
        .maybeSingle();

      const nlFrequency = nlSettings?.frequency || 'monthly';
      const nlDayOfMonth = nlSettings?.day_of_month || 15;
      const nlEnabled = nlSettings?.enabled !== false;

      let newsletterTasks: SystemTask[] = [];
      if (nlEnabled) {
        const weekStartDate = startOfWeek(now, { weekStartsOn: 1 });
        const weekEndDate = endOfWeek(now, { weekStartsOn: 1 });
        let isDue = false;

        if (nlFrequency === 'weekly') {
          isDue = true;
        } else if (nlFrequency === 'biweekly') {
          isDue = currentWeekNum % 2 === 1; // odd weeks
        } else {
          // monthly: check if day_of_month falls within this week
          const targetDate = new Date(now.getFullYear(), now.getMonth(), nlDayOfMonth);
          isDue = targetDate >= weekStartDate && targetDate <= weekEndDate;
        }

        if (isDue) {
          // Check if a campaign was already created/sent this period
          const existingSent = (newsletterWeek.data || []).length > 0;
          if (!existingSent) {
            newsletterTasks.push({
              id: `newsletter-virtual-${currentWeekNum}`,
              title: 'Write & schedule your newsletter',
              status: 'pending',
              navigateTo: '/newsletter',
            });
          }
        }
      }

      // For task list, only show non-posted social posts
      const socialTasks: SystemTask[] = (socialWeekAll.data || []).filter(s => s.status !== 'posted').map(s => ({
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
      const yearTransactions = (transactionsYear.data || []).reduce((sum, s) => sum + (s.closings || 0), 0);
      const avgGCI = 8000; // default average since self-reported data doesn't include per-transaction GCI
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

      // Fix Bug 2: count completed event tasks from the full week query
      const allEventWeek = (eventTasksWeekAll.data || []).filter(t => {
        const created = new Date(t.created_at);
        const due = new Date(t.due_date);
        return created <= due; // exclude born-overdue template tasks
      });
      const completedEventCount = allEventWeek.filter(t => t.completed_at !== null).length;
      const totalEventCount = allEventWeek.length;

      const totalThisWeek = totalSphereCount + totalEventCount + (blockTwo.scoreboard.submitted ? 0 : 1);
      const completedThisWeek = completedSphereCount + completedEventCount + (blockTwo.scoreboard.submitted ? 1 : 0);
      const currentWeekPct = totalThisWeek > 0 ? Math.round((completedThisWeek / totalThisWeek) * 100) : 0;

      // Fix Bug 3: Build 8-week trend from spheresync + events + coaching
      const coachingWeeksSet = new Set(
        (coachingHistory.data || []).map(s => `${s.year}-${s.week_number}`)
      );
      const trend: WeeklyPerformance[] = [];
      for (let i = 7; i >= 0; i--) {
        const wDate = subWeeks(now, i);
        const wNum = getISOWeekNumber(wDate);
        const wYear = wDate.getFullYear();
        const wStart = startOfWeek(wDate, { weekStartsOn: 1 });
        const wEnd = endOfWeek(wDate, { weekStartsOn: 1 });

        // SphereSync tasks for this historical week
        const weekSphereTasks = (sphereTasksHistory.data || []).filter(t => t.week_number === wNum && t.year === wYear);
        const weekSphereCompleted = weekSphereTasks.filter(t => t.completed).length;
        const weekSphereTotal = weekSphereTasks.length;

        // Event tasks for this historical week (by due_date)
        const weekEventTasks = (eventTasksHistory.data || []).filter(t => {
          if (!t.due_date) return false;
          const d = new Date(t.due_date);
          const created = new Date(t.created_at);
          return d >= wStart && d <= wEnd && created <= wEnd; // exclude tasks that didn't exist yet
        });
        const weekEventCompleted = weekEventTasks.filter(t => t.completed_at !== null).length;
        const weekEventTotal = weekEventTasks.length;

        // Coaching for this historical week
        const hasCoaching = coachingWeeksSet.has(`${wYear}-${wNum}`);
        const weekCoachingCompleted = hasCoaching ? 1 : 0;
        const weekCoachingTotal = 1; // always expected

        const weekTotal = weekSphereTotal + weekEventTotal + weekCoachingTotal;
        const weekCompleted = weekSphereCompleted + weekEventCompleted + weekCoachingCompleted;

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

      // ----- BLOCK FIVE: Overdue + Accountability Score -----
      const overdueItems: OverdueTask[] = [];

      // SphereSync overdue: incomplete tasks from past 2 weeks only
      const overdueSphereTasks = (sphereTasksAll.data || []).filter(t => {
        if (!t.week_number || !t.year) return false;
        const isCurrentWeek = t.week_number === currentWeekNum && t.year === currentYear;
        if (isCurrentWeek) return false;
        const weeksDiff = (currentYear - t.year) * 52 + (currentWeekNum - t.week_number);
        return weeksDiff <= 2; // only last 2 weeks
      });

      // Fetch contact names for overdue sphere tasks
      const leadIds = overdueSphereTasks.map(t => t.lead_id).filter(Boolean) as string[];
      let contactMap = new Map<string, string>();
      if (leadIds.length > 0) {
        const { data: contacts } = await supabase.from('contacts')
          .select('id, first_name, last_name').in('id', leadIds);
        (contacts || []).forEach(c => {
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
          if (name) contactMap.set(c.id, name);
        });
      }

      overdueSphereTasks.forEach(t => {
        const weeksDiff = (currentYear - (t.year || currentYear)) * 52 + (currentWeekNum - (t.week_number || currentWeekNum));
        const name = t.lead_id ? contactMap.get(t.lead_id) : undefined;
        overdueItems.push({
          id: t.id,
          system: 'spheresync',
          title: name
            ? `${t.task_type === 'call' ? 'Call' : 'Text'} ${name}`
            : `${t.task_type === 'call' ? 'Call' : 'Text'} task`,
          contactName: name,
          weekNumber: t.week_number,
          daysOverdue: weeksDiff * 7,
          navigateTo: '/spheresync-tasks',
        });
      });

      // Event tasks overdue
      (eventTasksOverdue.data || []).forEach(t => {
        const created = new Date(t.created_at);
        const due = new Date(t.due_date!);
        if (created > due) return; // born overdue from template — skip
        const days = differenceInDays(now, due);
        overdueItems.push({
          id: t.id,
          system: 'events',
          title: t.task_name,
          daysOverdue: days,
          navigateTo: '/events',
        });
      });

      // Coaching: missing past 2 weeks only
      const submittedWeeks = new Set((coachingMissing.data || []).map(s => `${s.year}-${s.week_number}`));
      for (let i = 1; i <= 2; i++) {
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

      // Accountability Score: ratio of completed vs expected across last 4 weeks
      const last4WeeksTrend = trend.slice(-4);
      const accountabilityScore = last4WeeksTrend.length > 0
        ? Math.round(last4WeeksTrend.reduce((sum, w) => sum + w.rate, 0) / last4WeeksTrend.length)
        : 100;

      // Next milestone: how many priority tasks to bump score by ~5 points
      const totalExpectedLast4 = last4WeeksTrend.length > 0 ? last4WeeksTrend.length : 1;
      const nextScore = Math.min(100, Math.ceil((accountabilityScore + 5) / 5) * 5);
      const tasksNeeded = Math.max(1, Math.ceil(((nextScore - accountabilityScore) / 100) * totalExpectedLast4 * (totalThisWeek || 5)));

      const blockFive: BlockFiveOverdue = {
        accountabilityScore,
        priorityTasks: overdueItems,
        nextMilestone: { score: nextScore, tasksNeeded },
      };

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

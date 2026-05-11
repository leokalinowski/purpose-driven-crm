/**
 * useNewsletterSchedules — CRUD for `newsletter_schedules`, the table that
 * powers both one-off scheduled sends AND recurring (monthly/biweekly/weekly)
 * cadences. Recurring rows get picked up hourly by the
 * `newsletter-recurring-dispatch` edge function.
 *
 * Agent flow:
 *   - Pick a template + cadence + day-of-month/week + hour
 *   - The first `next_send_at` is computed client-side and written
 *     immediately so the agent sees "Next send: Tue, May 14 at 10am" right
 *     after saving
 *   - The dispatcher takes over from there
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type Recurrence = 'once' | 'weekly' | 'biweekly' | 'monthly';

export interface NewsletterSchedule {
  id: string;
  agent_id: string;
  template_id: string;
  subject: string;
  sender_name: string | null;
  recipient_filter: Record<string, unknown> | null;
  scheduled_at: string | null;
  status: string | null;
  recipient_count: number | null;
  /** Recurrence config — added in 20260504000003 migration. */
  recurrence: Recurrence;
  /** Monthly: 1-31 (day-of-month). Weekly/biweekly: 0-6 (Sun-Sat). */
  recurrence_day: number | null;
  /** UTC hour 0-23. */
  recurrence_hour: number;
  next_send_at: string | null;
  last_sent_at: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface NewSchedule {
  template_id: string;
  subject: string;
  sender_name?: string | null;
  recipient_filter?: Record<string, unknown> | null;
  recurrence: Recurrence;
  /** For monthly: 1-31. For weekly/biweekly: 0-6 (Sun-Sat). */
  recurrence_day: number;
  /** UTC hour 0-23. */
  recurrence_hour: number;
  is_active?: boolean;
}

/**
 * Compute the next firing time for a recurring schedule. Mirrors the logic
 * in the `newsletter-recurring-dispatch` edge function so the saved
 * `next_send_at` matches what the dispatcher will eventually advance to.
 *
 * Strategy: anchor on the configured hour, then walk forward to the right
 * day-of-week (weekly/biweekly) or day-of-month (monthly). We never return
 * a time in the past — for recurring, the first send always lands on the
 * next occurrence at-or-after now.
 */
export function computeNextSendAt(
  recurrence: Recurrence,
  recurrenceDay: number,
  recurrenceHour: number,
  from: Date = new Date(),
): Date {
  const hour = Math.max(0, Math.min(23, recurrenceHour));
  const next = new Date(from);
  next.setUTCHours(hour, 0, 0, 0);

  if (recurrence === 'weekly' || recurrence === 'biweekly') {
    const targetDow = Math.max(0, Math.min(6, recurrenceDay));
    let safety = 14;
    while (safety-- > 0) {
      if (next.getUTCDay() === targetDow && next.getTime() > from.getTime()) break;
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(hour, 0, 0, 0);
    }
    return next;
  }

  // Monthly.
  const targetDom = Math.max(1, Math.min(31, recurrenceDay));
  next.setUTCDate(targetDom);
  next.setUTCHours(hour, 0, 0, 0);
  if (next.getTime() <= from.getTime()) {
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(1);
    const lastDayNextMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(targetDom, lastDayNextMonth));
    next.setUTCHours(hour, 0, 0, 0);
  }
  return next;
}

export function useNewsletterSchedules() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<NewsletterSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    if (!user?.id) {
      setSchedules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('newsletter_schedules')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSchedules((data ?? []) as NewsletterSchedule[]);
    } catch (err) {
      console.error('[useNewsletterSchedules] fetch failed:', err);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const createSchedule = useCallback(async (input: NewSchedule): Promise<NewsletterSchedule> => {
    if (!user?.id) throw new Error('Not authenticated');
    const nextSendAt = computeNextSendAt(
      input.recurrence,
      input.recurrence_day,
      input.recurrence_hour,
    ).toISOString();
    const { data, error } = await supabase
      .from('newsletter_schedules')
      .insert({
        agent_id: user.id,
        template_id: input.template_id,
        subject: input.subject,
        sender_name: input.sender_name ?? null,
        recipient_filter: input.recipient_filter ?? { type: 'all' },
        recurrence: input.recurrence,
        recurrence_day: input.recurrence_day,
        recurrence_hour: input.recurrence_hour,
        next_send_at: nextSendAt,
        is_active: input.is_active ?? true,
        status: 'scheduled',
      })
      .select()
      .single();
    if (error) throw error;
    await fetchSchedules();
    return data as NewsletterSchedule;
  }, [user?.id, fetchSchedules]);

  const updateSchedule = useCallback(async (id: string, updates: Partial<NewsletterSchedule>) => {
    // If cadence config changed, recompute next_send_at to match.
    let patch: Partial<NewsletterSchedule> = { ...updates };
    const cadenceChanged =
      'recurrence' in updates ||
      'recurrence_day' in updates ||
      'recurrence_hour' in updates;
    if (cadenceChanged && updates.is_active !== false) {
      const existing = schedules.find((s) => s.id === id);
      if (existing) {
        const nextSendAt = computeNextSendAt(
          (updates.recurrence ?? existing.recurrence) as Recurrence,
          updates.recurrence_day ?? existing.recurrence_day ?? 1,
          updates.recurrence_hour ?? existing.recurrence_hour ?? 10,
        ).toISOString();
        patch = { ...patch, next_send_at: nextSendAt };
      }
    }
    const { error } = await supabase
      .from('newsletter_schedules')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
    await fetchSchedules();
  }, [schedules, fetchSchedules]);

  const deleteSchedule = useCallback(async (id: string) => {
    const { error } = await supabase.from('newsletter_schedules').delete().eq('id', id);
    if (error) throw error;
    await fetchSchedules();
  }, [fetchSchedules]);

  const togglePause = useCallback(async (id: string, isActive: boolean) => {
    return updateSchedule(id, { is_active: isActive });
  }, [updateSchedule]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return {
    schedules,
    loading,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    togglePause,
  };
}

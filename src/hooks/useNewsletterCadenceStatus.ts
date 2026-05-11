/**
 * useNewsletterCadenceStatus — derives a single signal that drives the
 * dashboard "send your newsletter" nudge. The agent should never have to
 * remember when they last sent; the Coach surfaces it.
 *
 * Status buckets (highest urgency first):
 *   - 'never'         — agent has never sent a newsletter
 *   - 'overdue'       — last send was more than NEWSLETTER_OVERDUE_DAYS ago
 *   - 'paused'        — has recurring schedule(s) but all are paused
 *   - 'no_recurring'  — sent before but has no active recurring schedule
 *   - 'on_track'      — sent recently OR has an active recurring cadence
 *
 * The banner component renders for everything except 'on_track'.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/** Newsletter is considered "overdue" past this gap. ~5 weeks gives
 *  monthly senders a week of grace, biweekly senders ~3 cycles. */
export const NEWSLETTER_OVERDUE_DAYS = 35;

export type NewsletterCadenceStatus =
  | 'never'
  | 'overdue'
  | 'paused'
  | 'no_recurring'
  | 'on_track';

export interface NewsletterCadence {
  status: NewsletterCadenceStatus;
  lastSentAt: string | null;
  daysSinceLastSend: number | null;
  activeRecurringCount: number;
  pausedRecurringCount: number;
  loading: boolean;
}

export function useNewsletterCadenceStatus(): NewsletterCadence {
  const { user } = useAuth();
  const [state, setState] = useState<NewsletterCadence>({
    status: 'on_track',
    lastSentAt: null,
    daysSinceLastSend: null,
    activeRecurringCount: 0,
    pausedRecurringCount: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
        return;
      }
      try {
        // Two cheap queries in parallel — last successful send + recurring
        // schedules count. Both are RLS-scoped to the agent automatically.
        const [campaignsRes, schedulesRes] = await Promise.all([
          supabase
            .from('newsletter_campaigns')
            .select('send_date, status')
            .eq('created_by', user.id)
            .eq('status', 'sent')
            .order('send_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('newsletter_schedules')
            .select('id, is_active, recurrence')
            .eq('agent_id', user.id)
            .neq('recurrence', 'once'),
        ]);

        if (cancelled) return;

        const lastSentAt = campaignsRes.data?.send_date ?? null;
        const daysSinceLastSend = lastSentAt
          ? Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 86_400_000)
          : null;

        const recurring = schedulesRes.data ?? [];
        const activeRecurringCount = recurring.filter((r) => r.is_active).length;
        const pausedRecurringCount = recurring.filter((r) => !r.is_active).length;

        // Status precedence: never > overdue > paused > no_recurring > on_track.
        let status: NewsletterCadenceStatus;
        if (lastSentAt == null) {
          status = 'never';
        } else if (daysSinceLastSend != null && daysSinceLastSend > NEWSLETTER_OVERDUE_DAYS) {
          status = 'overdue';
        } else if (activeRecurringCount === 0 && pausedRecurringCount > 0) {
          status = 'paused';
        } else if (activeRecurringCount === 0) {
          status = 'no_recurring';
        } else {
          status = 'on_track';
        }

        setState({
          status,
          lastSentAt,
          daysSinceLastSend,
          activeRecurringCount,
          pausedRecurringCount,
          loading: false,
        });
      } catch (err) {
        console.warn('[useNewsletterCadenceStatus] failed:', err);
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return state;
}

/**
 * useNotificationPrefs — read + persist the user's notification + timezone
 * preferences on `profiles`.
 *
 * These live on `profiles` (not on agent_marketing_settings) because they
 * govern personal communication cadence — coaching nudges, weekly
 * reminders, in-app pings — not the agent's outbound brand. Consumers:
 *   - coaching-weekly-nudge cron: reminder_day + timezone + quiet hours
 *   - ai-coach-agent cron: quiet hours + timezone
 *   - SphereSync priority queue: quiet hours
 *   - Settings → Notifications section: read/write
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface NotificationPrefs {
  /** IANA timezone, e.g. America/New_York. */
  timezone: string;
  /** 0=Sun … 6=Sat. Default 5 (Friday). */
  reminder_day: number;
  /** Hour 0-23, local time. Default 21. */
  quiet_hours_start: number;
  /** Hour 0-23, local time. Default 7. */
  quiet_hours_end: number;
  /** Send notifications via email. */
  notify_email: boolean;
  /** Send in-app toasts/banners. */
  notify_in_app: boolean;
}

const DEFAULTS: NotificationPrefs = {
  timezone: 'America/New_York',
  reminder_day: 5,
  quiet_hours_start: 21,
  quiet_hours_end: 7,
  notify_email: true,
  notify_in_app: true,
};

export type NotificationPrefsPatch = Partial<NotificationPrefs>;

const COLUMNS = 'timezone, reminder_day, quiet_hours_start, quiet_hours_end, notify_email, notify_in_app';

export function useNotificationPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setPrefs(DEFAULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select(COLUMNS)
        .eq('user_id', user.id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      setPrefs({
        timezone: data?.timezone ?? DEFAULTS.timezone,
        reminder_day: data?.reminder_day ?? DEFAULTS.reminder_day,
        quiet_hours_start: data?.quiet_hours_start ?? DEFAULTS.quiet_hours_start,
        quiet_hours_end: data?.quiet_hours_end ?? DEFAULTS.quiet_hours_end,
        notify_email: data?.notify_email ?? DEFAULTS.notify_email,
        notify_in_app: data?.notify_in_app ?? DEFAULTS.notify_in_app,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[useNotificationPrefs] fetch error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const save = useCallback(
    async (patch: NotificationPrefsPatch): Promise<boolean> => {
      if (!user?.id) return false;
      try {
        const { error: updErr } = await supabase
          .from('profiles')
          .update(patch)
          .eq('user_id', user.id);
        if (updErr) throw updErr;
        setPrefs((prev) => ({ ...prev, ...patch }));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[useNotificationPrefs] save error:', err);
        setError(message);
        return false;
      }
    },
    [user?.id],
  );

  return { prefs, loading, error, save, refresh: fetch };
}

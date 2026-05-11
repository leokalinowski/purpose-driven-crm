/**
 * Live-progress tracker for bulk DNC checks after a CSV import.
 *
 * The dnc-monthly-check edge function processes contacts in batches with
 * its own internal pacing (50ms per call, 500ms between batches), so a 200-
 * contact import takes ~2 minutes. The agent shouldn't have to refresh to
 * see whether their import was checked — instead we surface a single
 * sonner toast that polls progress and updates in place.
 *
 * Usage:
 *   const tracker = trackBulkDNCProgress({
 *     contactIds: result.map(c => c.id),
 *     agentId: user.id,
 *     startedAt: new Date().toISOString(),
 *   });
 *   // tracker auto-cleans up after completion or timeout.
 *   // Call tracker.stop() to cancel manually.
 */

import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TrackOpts {
  contactIds: string[];
  agentId: string;
  startedAt: string;       // ISO timestamp of when the bulk check kicked off
  pollIntervalMs?: number; // Default 5000
  timeoutMs?: number;      // Default 10 minutes
}

interface Tracker {
  /** Cancel the polling immediately. The toast resolves to a dismissed state. */
  stop: () => void;
}

export function trackBulkDNCProgress(opts: TrackOpts): Tracker {
  const total = opts.contactIds.length;
  const pollInterval = opts.pollIntervalMs ?? 5000;
  const timeoutAt = Date.now() + (opts.timeoutMs ?? 10 * 60_000);

  // A stable id lets repeated toast.loading calls update the same toast in
  // place rather than stacking new ones each tick.
  const toastId = `bulk-dnc-${opts.startedAt}`;

  if (total === 0) return { stop: () => undefined };

  toast.loading(`DNC check running… 0 of ${total} contacts`, {
    id: toastId,
    description: 'Checking each phone against the registry. You can keep working.',
  });

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    toast.dismiss(toastId);
  };

  const poll = async () => {
    if (stopped) return;
    try {
      // Count how many of the imported contacts have a `dnc_last_checked`
      // timestamp at or after the import-start time. The edge function only
      // updates that column on a successful API response, so this directly
      // measures real progress.
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', opts.agentId)
        .in('id', opts.contactIds)
        .gte('dnc_last_checked', opts.startedAt);

      if (error) {
        console.warn('[dncProgress] poll failed:', error);
      } else {
        const done = count ?? 0;
        if (done >= total) {
          // Resolve the toast to success and stop polling.
          toast.success(`DNC check complete · ${done} of ${total} contacts checked`, {
            id: toastId,
            description: 'Refresh the page to see updated DNC flags.',
          });
          stopped = true;
          return;
        }
        toast.loading(`DNC check running… ${done} of ${total} contacts`, {
          id: toastId,
          description: 'Checking each phone against the registry. You can keep working.',
        });
      }
    } catch (err) {
      console.warn('[dncProgress] poll threw:', err);
    }

    if (Date.now() >= timeoutAt) {
      // Don't leave the agent staring at a forever-loading toast. Resolve
      // with a hint that the cron will eventually pick up stragglers.
      toast.warning('DNC check still running in background', {
        id: toastId,
        description: 'It can take longer for large imports. Stragglers will be picked up by the next monthly run.',
      });
      stopped = true;
      return;
    }

    timer = setTimeout(poll, pollInterval);
  };

  // Kick off the first poll after a short delay so we don't immediately
  // overwrite the "0 of N" message before the user can read it.
  timer = setTimeout(poll, pollInterval);

  return { stop };
}

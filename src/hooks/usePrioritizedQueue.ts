/**
 * usePrioritizedQueue — set-based priorities (Phase 4, 2026-05-18 evening).
 *
 * A contact is a PRIORITY iff EITHER:
 *   1. PIPELINE  — has active opp at conversation_active / opportunity_identified
 *                  / consultation_completed. Later stages are committed clients.
 *   2. CADENCE   — contacts.category is in THIS week's call OR text rotation.
 *
 * No score. No engagement set. No carryover from last week. The classifier
 * runs in `compute-priority-scores` (model `set-based-v6`) and writes
 * `priority_band` to each contact row.
 *
 * Ordering for the Priorities list:
 *   - PIPELINE first, sorted by stage: conversation_active → opportunity_identified → consultation_completed
 *   - then CADENCE, sorted by last_activity_date ASC (most stale first)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { SPHERESYNC_TEXTS, getCurrentWeekNumber } from '@/utils/sphereSyncLogic';
import { useCompletedSphereTouchesThisWeek } from '@/hooks/useCompletedSphereTouchesThisWeek';

export type QueueBand = 'pipeline' | 'cadence';
export type PrimaryAction = 'call' | 'text' | 'email';

export interface QueueItem {
  contact_id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  dnc: boolean;
  last_activity_date: string | null;
  band: QueueBand;
  primary_action: PrimaryAction;
  reason: string;
  /** Pipeline-only: stage key. Cadence: null. Used to order pipeline contacts. */
  pipeline_stage: string | null;
  /** Cadence-only: 'call' | 'text'. Pipeline: null. */
  rotation_kind: 'call' | 'text' | null;
  /** Cadence-only: the rotation letter (uppercase). */
  rotation_letter: string | null;
  context_chips: string[];
  /** True when the contact has at least one logged activity this ISO week.
   *  Used to drop pipeline contacts to the bottom of the band after the
   *  agent has already touched them this week (they stay on the list, just
   *  not highlighted). Resets automatically next ISO week. */
  touched_this_week: boolean;
}

export interface PrioritizedQueueCounts {
  pipeline: number;
  cadence: number;
  total: number;
}

interface PrioritizedQueueResult {
  pipeline: QueueItem[];
  cadence: QueueItem[];
  all: QueueItem[];
  contactIds: Set<string>;
  counts: PrioritizedQueueCounts;
  loading: boolean;
}

// Order within pipeline band — earliest stage ranks highest.
const STAGE_RANK: Record<string, number> = {
  conversation_active:    1,
  opportunity_identified: 2,
  consultation_completed: 3,
};

const BAND_RANK: Record<QueueBand, number> = { pipeline: 0, cadence: 1 };

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim() || 'Unnamed contact';
}

function humanStage(stage: string): string {
  const labels: Record<string, string> = {
    conversation_active:    'Conversation active',
    opportunity_identified: 'Opportunity identified',
    consultation_completed: 'Consultation completed',
  };
  return labels[stage] ?? stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ContactDbRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  dnc: boolean | null;
  last_activity_date: string | null;
  category: string | null;
  priority_band: QueueBand | null;
  priority_reasoning: string | null;
  priority_signals: Record<string, unknown> | null;
}

function pickPrimaryAction(c: ContactDbRow, band: QueueBand, textLetter: string): PrimaryAction {
  if (band === 'cadence' && c.category && c.category.toUpperCase() === textLetter) {
    return c.phone ? 'text' : c.email ? 'email' : 'text';
  }
  return c.phone ? 'call' : c.email ? 'email' : 'call';
}

function buildContextChips(c: ContactDbRow, band: QueueBand, sig: Record<string, unknown> | null): string[] {
  const chips: string[] = [];
  if (band === 'pipeline') {
    const stage = sig?.pipeline_stage as string | undefined;
    if (stage) chips.push(humanStage(stage));
    const days = sig?.days_in_stage;
    if (typeof days === 'number' && days > 0) chips.push(`${days}d in stage`);
  } else if (band === 'cadence') {
    const letter = (sig?.rotation_letter as string | undefined) ?? c.category ?? '';
    const kind = sig?.rotation_kind as string | undefined;
    if (letter) chips.push(`Letter ${letter.toUpperCase()}`);
    if (kind === 'text') chips.push('Text week');
    else if (kind === 'call') chips.push('Call week');
  }
  return chips;
}

export function usePrioritizedQueue(): PrioritizedQueueResult {
  const { user } = useAuth();
  const agentId = user?.id;
  const textLetter = useMemo(() => SPHERESYNC_TEXTS[getCurrentWeekNumber()] ?? '', []);
  // Completed SphereSync tasks this week — used to drop cadence contacts
  // off entirely once the agent finishes the rotation task.
  const { touchedContactIds: spheresyncTouchedIds } = useCompletedSphereTouchesThisWeek();
  // Start of the current ISO week (Mon 00:00 local). Pipeline contacts
  // touched this week sort to the bottom of their band.
  const weekStartIso = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysSinceMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysSinceMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.getTime();
  }, []);

  // Real touches this week — pulled from contact_activities. We CANNOT use
  // contacts.last_activity_date because it gets bumped by SphereSync task
  // STUBS (system-generated rows with outcome=NULL + notes 'SphereSync ...').
  // The stub generation cron runs Monday morning, so every contact in this
  // week's rotation gets a stamped last_activity_date — which made every
  // contact look "touched this week" even when the agent did nothing.
  //
  // Real signal: contact_activities rows that are NOT stubs (i.e. either
  // outcome IS NOT NULL, OR the notes don't start with the SphereSync
  // prefix). Catches calls, texts, emails, gifts — anything the agent
  // actually did.
  const realTouchesQuery = useQuery({
    queryKey: ['real-touches-this-week', agentId, weekStartIso],
    enabled: !!agentId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_activities')
        .select('contact_id, outcome, notes')
        .eq('agent_id', agentId!)
        .gte('activity_date', new Date(weekStartIso).toISOString());
      if (error) throw error;
      const ids = new Set<string>();
      for (const row of (data ?? []) as Array<{ contact_id: string | null; outcome: string | null; notes: string | null }>) {
        if (!row.contact_id) continue;
        const isStub = row.outcome === null && (row.notes?.startsWith('SphereSync ') ?? false);
        if (isStub) continue;
        ids.add(row.contact_id);
      }
      return ids;
    },
  });

  // Union: a contact is "touched this week" if EITHER they have a completed
  // SphereSync task OR a real (non-stub) contact_activities entry.
  const touchedContactIds = useMemo(() => {
    const out = new Set<string>(spheresyncTouchedIds);
    realTouchesQuery.data?.forEach((id) => out.add(id));
    return out;
  }, [spheresyncTouchedIds, realTouchesQuery.data]);

  const query = useQuery({
    queryKey: ['priority-queue-v6', agentId],
    enabled: !!agentId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id, first_name, last_name, phone, email, dnc, last_activity_date,
          category, priority_band, priority_reasoning, priority_signals
        `)
        .eq('agent_id', agentId!)
        .in('priority_band', ['pipeline', 'cadence']);

      if (error) throw error;
      return (data ?? []) as unknown as ContactDbRow[];
    },
  });

  return useMemo<PrioritizedQueueResult>(() => {
    // Filter cadence-band contacts that already have a completed spheresync_task
    // for this week. Pipeline contacts pass through untouched (a completed call
    // doesn't move them off the priority list — the opportunity stage does).
    const rows = (query.data ?? []).filter((c) => {
      if (c.priority_band === 'cadence' && touchedContactIds.has(c.id)) return false;
      return true;
    });
    const items: QueueItem[] = rows.map((c) => {
      const band = (c.priority_band ?? 'cadence') as QueueBand;
      const sig = c.priority_signals as Record<string, unknown> | null;
      const pipelineStage = (sig?.pipeline_stage as string | undefined) ?? null;
      const rotationKind = (sig?.rotation_kind as 'call' | 'text' | undefined) ?? null;
      const rotationLetter = ((sig?.rotation_letter as string | undefined) ?? c.category ?? '').toUpperCase() || null;
      // touched_this_week = the contact is in our combined "really touched"
      // set (real contact_activities this week OR completed spheresync_task).
      // We deliberately don't read last_activity_date — that column gets
      // stamped by SphereSync STUB rows on Monday morning and would mark
      // every cadence contact as "touched" before the agent does anything.
      const touchedThisWeek = touchedContactIds.has(c.id);
      return {
        contact_id: c.id,
        contact_name: fullName(c.first_name, c.last_name),
        first_name: c.first_name,
        last_name: c.last_name,
        phone: c.phone,
        email: c.email,
        dnc: !!c.dnc,
        last_activity_date: c.last_activity_date,
        band,
        primary_action: pickPrimaryAction(c, band, textLetter),
        reason: c.priority_reasoning ?? '',
        pipeline_stage: band === 'pipeline' ? pipelineStage : null,
        rotation_kind: band === 'cadence' ? rotationKind : null,
        rotation_letter: band === 'cadence' ? rotationLetter : null,
        context_chips: buildContextChips(c, band, sig),
        touched_this_week: touchedThisWeek,
      };
    });

    // Sort order:
    //   1. Band  — pipeline before cadence (always)
    //   2. Touched-this-week — untouched contacts come BEFORE touched ones
    //      within the same band. A contact you've already texted/called
    //      this week stays on the list (still a priority) but drops to
    //      the bottom of their band. Resets each ISO week.
    //   3. Within (band, touched-bucket): pipeline by stage rank
    //      (conversation_active → opportunity_identified → consultation_completed),
    //      cadence by last_activity_date ASC.
    //   4. Final tiebreak: last_activity_date ASC (most stale first).
    items.sort((a, b) => {
      const bandDiff = BAND_RANK[a.band] - BAND_RANK[b.band];
      if (bandDiff !== 0) return bandDiff;
      const touchedDiff = Number(a.touched_this_week) - Number(b.touched_this_week);
      if (touchedDiff !== 0) return touchedDiff;
      if (a.band === 'pipeline') {
        const aRank = STAGE_RANK[a.pipeline_stage ?? ''] ?? 99;
        const bRank = STAGE_RANK[b.pipeline_stage ?? ''] ?? 99;
        if (aRank !== bRank) return aRank - bRank;
      }
      const aTime = a.last_activity_date ? new Date(a.last_activity_date).getTime() : 0;
      const bTime = b.last_activity_date ? new Date(b.last_activity_date).getTime() : 0;
      return aTime - bTime;
    });

    const pipeline = items.filter((i) => i.band === 'pipeline');
    const cadence  = items.filter((i) => i.band === 'cadence');

    return {
      pipeline,
      cadence,
      all: items,
      contactIds: new Set(items.map((i) => i.contact_id)),
      counts: {
        pipeline: pipeline.length,
        cadence:  cadence.length,
        total:    items.length,
      },
      loading: query.isLoading,
    };
  }, [query.data, query.isLoading, textLetter, touchedContactIds]);
}

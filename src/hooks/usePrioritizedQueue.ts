/**
 * usePrioritizedQueue — read the deterministic priority queue from the DB.
 *
 * As of 2026-05-18 (Phase 2 of the priority system rebuild), this hook is a
 * thin wrapper over the cached `priority_score` + `priority_band` columns on
 * `contacts`. The old client-side 3-band composer was retired — every UI
 * surface (Database, Priorities, Dashboard) now reads the same score and
 * grouping written by the `compute-priority-scores` edge function.
 *
 * The band column (pipeline | cadence | engagement | sphere) is set by the
 * scorer based on which component dominates the weighted score. Within a band,
 * contacts are ordered by score DESC (then most-overdue first as tie-break).
 *
 * `reason` comes straight from the DB column the scorer writes — same sentence
 * shown in the contact drawer's "Coach insight" pane. One source of truth.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { SPHERESYNC_TEXTS, getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

export type QueueBand = 'pipeline' | 'cadence' | 'engagement' | 'sphere';
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
  score: number;
  context_chips: string[];
}

interface PrioritizedQueueResult {
  pipeline: QueueItem[];
  cadence: QueueItem[];
  engagement: QueueItem[];
  sphere: QueueItem[];
  all: QueueItem[];
  loading: boolean;
}

// How many to pull. 30 covers every realistic agent workload for a session
// (pipeline + a full week's rotation + recent engagement) without bloating
// the wire.
const QUEUE_LIMIT = 30;

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim() || 'Unnamed contact';
}

function humanStage(stage: string): string {
  const labels: Record<string, string> = {
    conversation_active:    'Conversation active',
    opportunity_identified: 'Opportunity identified',
    consultation_completed: 'Consultation completed',
    client_secured:         'Client secured',
    active_opportunity:     'Active opportunity',
    under_contract:         'Under contract',
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
  priority_score: number | null;
  priority_band: QueueBand | null;
  priority_reasoning: string | null;
  priority_signals: Record<string, unknown> | null;
}

/**
 * Decide which action button gets the primary (filled) treatment. Cadence
 * letters that fall on a TEXT-rotation week prefer text; everything else
 * defaults to call when a phone is on file, else email.
 */
function pickPrimaryAction(c: ContactDbRow, band: QueueBand, textLetter: string): PrimaryAction {
  if (band === 'cadence' && c.category && c.category.toUpperCase() === textLetter) {
    return c.phone ? 'text' : c.email ? 'email' : 'text';
  }
  return c.phone ? 'call' : c.email ? 'email' : 'call';
}

function buildContextChips(c: ContactDbRow, band: QueueBand): string[] {
  const chips: string[] = [];
  const sig = c.priority_signals as Record<string, unknown> | null;

  if (band === 'pipeline') {
    const stage = sig?.active_opportunity_stage as string | undefined;
    if (stage) chips.push(humanStage(stage));
    const days = sig?.days_in_stage;
    if (typeof days === 'number' && days > 0) chips.push(`${days}d in stage`);
  } else if (band === 'cadence') {
    const letter = (sig?.rotation_letter as string | undefined) ?? c.category;
    if (letter) chips.push(`Letter ${letter.toUpperCase()}`);
    if (sig?.letter_is_prev) chips.push('Overdue from last week');
  } else if (band === 'engagement') {
    if (sig?.gift_30d) chips.push('Gift sent');
    if (sig?.recent_rsvp) chips.push('Event RSVP');
  }
  return chips;
}

export function usePrioritizedQueue(): PrioritizedQueueResult {
  const { user } = useAuth();
  const agentId = user?.id;
  const textLetter = useMemo(() => SPHERESYNC_TEXTS[getCurrentWeekNumber()] ?? '', []);

  const query = useQuery({
    queryKey: ['priority-queue', agentId],
    enabled: !!agentId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id, first_name, last_name, phone, email, dnc, last_activity_date,
          category, priority_score, priority_band, priority_reasoning, priority_signals
        `)
        .eq('agent_id', agentId!)
        .not('priority_band', 'is', null)
        .order('priority_score', { ascending: false, nullsFirst: false })
        .order('last_activity_date', { ascending: true, nullsFirst: true })
        .limit(QUEUE_LIMIT);

      if (error) throw error;
      return (data ?? []) as unknown as ContactDbRow[];
    },
  });

  return useMemo<PrioritizedQueueResult>(() => {
    const rows = query.data ?? [];
    const items: QueueItem[] = rows.map((c) => {
      const band = (c.priority_band ?? 'sphere') as QueueBand;
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
        score: c.priority_score ?? 0,
        context_chips: buildContextChips(c, band),
      };
    });
    return {
      pipeline:   items.filter((i) => i.band === 'pipeline'),
      cadence:    items.filter((i) => i.band === 'cadence'),
      engagement: items.filter((i) => i.band === 'engagement'),
      sphere:     items.filter((i) => i.band === 'sphere'),
      all: items,
      loading: query.isLoading,
    };
  }, [query.data, query.isLoading, textLetter]);
}

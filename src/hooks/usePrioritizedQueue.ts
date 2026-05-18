/**
 * usePrioritizedQueue — the deterministic ranking that powers the Priorities tab.
 *
 * Replaces the AI-Coach-driven `today_list`. The math is hidden from the user
 * and runs entirely client-side as a composition over existing tables. The
 * hierarchy is strict — a contact in a higher band always outranks a contact
 * in a lower band, regardless of within-band score.
 *
 *   Band 1 — Pipeline    — anyone with an active opportunity (pre-transaction)
 *   Band 2 — Cadence     — anyone whose last-name letter is in this week's
 *                          SphereSync rotation, AND not already in Band 1
 *   Band 3 — Engagement  — anyone with marketing engagement (gift, event RSVP)
 *                          in the last 30 days, AND not in Bands 1 or 2
 *
 * Within each band, contacts are sorted to surface the most-overdue first
 * (Band 1 + 2) or most-recent engagement first (Band 3). The UI does NOT show
 * band labels — each row has a one-liner `reason` explaining why the contact
 * is in the queue, which is the only acknowledgment of the math.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { SPHERESYNC_CALLS, SPHERESYNC_TEXTS, getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

export type QueueBand = 'pipeline' | 'cadence' | 'engagement';
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
  // Surfaced for downstream consumers — opportunity stage, engagement type, etc.
  context_chips: string[];
}

interface PrioritizedQueueResult {
  pipeline: QueueItem[];
  cadence: QueueItem[];
  engagement: QueueItem[];
  all: QueueItem[];
  loading: boolean;
  // Lookups for downstream consumers (Database filter chip, ContactQuickSheet,
  // KPI tiles). Derived from `all` — no extra queries.
  contactIds: Set<string>;
  byContactId: Map<string, QueueItem>;
  counts: {
    pipeline: number;
    cadence: number;
    engagement: number;
    total: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ENGAGEMENT_LOOKBACK_DAYS = 30;
const PIPELINE_CAP = 8;
const CADENCE_CAP = 12;
const ENGAGEMENT_CAP = 5;

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim() || 'Unnamed contact';
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function relativeAgo(days: number | null): string {
  if (days === null) return 'never touched';
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 60) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePrioritizedQueue(): PrioritizedQueueResult {
  const { user } = useAuth();
  const agentId = user?.id;
  const week = useMemo(() => getCurrentWeekNumber(), []);
  const callLetters = useMemo(() => SPHERESYNC_CALLS[week] ?? [], [week]);
  const textLetter = useMemo(() => SPHERESYNC_TEXTS[week] ?? '', [week]);
  const rotationLetters = useMemo(
    () => Array.from(new Set([...callLetters, textLetter].filter(Boolean))),
    [callLetters, textLetter],
  );

  // ─── Band 1: Pipeline ──────────────────────────────────────────────────────
  // Active opportunities (pre-transaction). Per the product spec, anything
  // with an actual_close_date is in Transactions, not Pipeline.
  const pipelineQuery = useQuery({
    queryKey: ['priority-queue', 'pipeline', agentId],
    enabled: !!agentId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          id, stage, contact_id, last_activity_date, days_in_current_stage,
          contacts!inner ( id, first_name, last_name, phone, email, dnc, last_activity_date )
        `)
        .eq('agent_id', agentId!)
        .is('actual_close_date', null)
        .not('outcome', 'in', '(won,lost,withdrawn)')
        .order('last_activity_date', { ascending: true, nullsFirst: true });

      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        stage: string;
        contact_id: string;
        last_activity_date: string | null;
        days_in_current_stage: number | null;
        contacts: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          email: string | null;
          dnc: boolean;
          last_activity_date: string | null;
        };
      }>;
    },
  });

  // ─── Band 2: Cadence ───────────────────────────────────────────────────────
  // Contacts whose last name starts with one of this week's rotation letters.
  // Filtered later to drop anyone in Band 1.
  const cadenceQuery = useQuery({
    queryKey: ['priority-queue', 'cadence', agentId, rotationLetters.join(',')],
    enabled: !!agentId && rotationLetters.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      // Postgres ILIKE is case-insensitive; use the OR builder for letter prefixes.
      const orClause = rotationLetters
        .map((letter) => `last_name.ilike.${letter}%`)
        .join(',');
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone, email, dnc, last_activity_date')
        .eq('agent_id', agentId!)
        .or(orClause)
        .order('last_activity_date', { ascending: true, nullsFirst: true })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        dnc: boolean;
        last_activity_date: string | null;
      }>;
    },
  });

  // ─── Band 3: Engagement ────────────────────────────────────────────────────
  // Contacts who engaged with marketing in the last N days. v1 sources:
  //   • contact_activities.activity_type = 'gift' (Surprise & Delight)
  //   • event_rsvps row (any RSVP signals interest)
  // Newsletter opens/clicks could be added later when we wire `email_logs`.
  const engagementQuery = useQuery({
    queryKey: ['priority-queue', 'engagement', agentId],
    enabled: !!agentId,
    staleTime: 60_000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - ENGAGEMENT_LOOKBACK_DAYS * 86400_000).toISOString();
      const [giftRes, rsvpRes] = await Promise.all([
        supabase
          .from('contact_activities')
          .select('contact_id, activity_date, activity_type, notes')
          .eq('agent_id', agentId!)
          .eq('activity_type', 'gift')
          .gte('activity_date', cutoff)
          .order('activity_date', { ascending: false })
          .limit(40),
        supabase
          .from('event_rsvps')
          .select('contact_id, status, created_at, events!inner(title, agent_id)')
          .eq('events.agent_id', agentId!)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(40),
      ]);

      // Either query failing means the band is empty for this run — don't
      // bubble the error up because the priority queue still works without
      // engagement data.
      if (giftRes.error) console.warn('[usePrioritizedQueue] gift query failed:', giftRes.error);
      if (rsvpRes.error) console.warn('[usePrioritizedQueue] rsvp query failed:', rsvpRes.error);

      type Signal = {
        contact_id: string;
        when: string;
        kind: 'gift' | 'rsvp';
        label: string;
      };
      const signals: Signal[] = [];

      for (const g of (giftRes.data ?? [])) {
        if (!g.contact_id) continue;
        signals.push({
          contact_id: g.contact_id,
          when: g.activity_date,
          kind: 'gift',
          label: 'Sent a gift',
        });
      }
      for (const r of (rsvpRes.data ?? []) as Array<{
        contact_id: string | null;
        status: string | null;
        created_at: string;
        events: { title: string | null } | null;
      }>) {
        if (!r.contact_id) continue;
        const eventTitle = r.events?.title ?? 'an event';
        signals.push({
          contact_id: r.contact_id,
          when: r.created_at,
          kind: 'rsvp',
          label: `RSVP'd to ${eventTitle}`,
        });
      }

      // Pick the most recent signal per contact.
      const latestByContact = new Map<string, Signal>();
      for (const s of signals) {
        const existing = latestByContact.get(s.contact_id);
        if (!existing || new Date(s.when).getTime() > new Date(existing.when).getTime()) {
          latestByContact.set(s.contact_id, s);
        }
      }
      const ids = Array.from(latestByContact.keys());
      if (ids.length === 0) return [];

      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone, email, dnc, last_activity_date')
        .eq('agent_id', agentId!)
        .in('id', ids);

      if (contactsError) {
        console.warn('[usePrioritizedQueue] engagement contacts fetch failed:', contactsError);
        return [];
      }

      return (contactsData ?? []).map((c) => {
        const sig = latestByContact.get(c.id)!;
        return {
          ...c,
          signal_when: sig.when,
          signal_kind: sig.kind,
          signal_label: sig.label,
        };
      }).sort((a, b) => new Date(b.signal_when).getTime() - new Date(a.signal_when).getTime());
    },
  });

  // ─── Compose the bands ─────────────────────────────────────────────────────
  const result = useMemo<PrioritizedQueueResult>(() => {
    const pipelineRows = pipelineQuery.data ?? [];
    const cadenceRows = cadenceQuery.data ?? [];
    const engagementRows = engagementQuery.data ?? [];

    // Band 1
    const seenContactIds = new Set<string>();
    const pipelineItems: QueueItem[] = [];
    for (const opp of pipelineRows) {
      const c = opp.contacts;
      if (!c || seenContactIds.has(c.id)) continue;
      seenContactIds.add(c.id);
      const days = daysSince(c.last_activity_date);
      const stageLabel = opp.stage
        ? opp.stage.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
        : 'Active';
      pipelineItems.push({
        contact_id: c.id,
        contact_name: fullName(c.first_name, c.last_name),
        first_name: c.first_name,
        last_name: c.last_name,
        phone: c.phone,
        email: c.email,
        dnc: !!c.dnc,
        last_activity_date: c.last_activity_date,
        band: 'pipeline',
        primary_action: c.phone ? 'call' : c.email ? 'email' : 'call',
        reason: `In your pipeline · ${stageLabel} · last touch ${relativeAgo(days)}`,
        context_chips: [stageLabel],
      });
      if (pipelineItems.length >= PIPELINE_CAP) break;
    }

    // Band 2 — only contacts not already in Band 1
    const cadenceItems: QueueItem[] = [];
    for (const c of cadenceRows) {
      if (seenContactIds.has(c.id)) continue;
      seenContactIds.add(c.id);
      const days = daysSince(c.last_activity_date);
      const initial = (c.last_name?.[0] ?? '').toUpperCase();
      const isCallLetter = callLetters.includes(initial);
      const action: PrimaryAction = isCallLetter ? 'call' : 'text';
      cadenceItems.push({
        contact_id: c.id,
        contact_name: fullName(c.first_name, c.last_name),
        first_name: c.first_name,
        last_name: c.last_name,
        phone: c.phone,
        email: c.email,
        dnc: !!c.dnc,
        last_activity_date: c.last_activity_date,
        band: 'cadence',
        primary_action: action,
        reason: days === null
          ? `This week's rotation (${initial}) · never touched`
          : days > 90
            ? `This week's rotation (${initial}) · ${relativeAgo(days)} — overdue`
            : `This week's rotation (${initial}) · last touch ${relativeAgo(days)}`,
        context_chips: [`Letter ${initial}`, isCallLetter ? 'Call week' : 'Text week'],
      });
      if (cadenceItems.length >= CADENCE_CAP) break;
    }

    // Band 3 — only contacts not in 1 or 2
    const engagementItems: QueueItem[] = [];
    for (const c of engagementRows) {
      if (seenContactIds.has(c.id)) continue;
      seenContactIds.add(c.id);
      const days = daysSince(c.signal_when);
      engagementItems.push({
        contact_id: c.id,
        contact_name: fullName(c.first_name, c.last_name),
        first_name: c.first_name,
        last_name: c.last_name,
        phone: c.phone,
        email: c.email,
        dnc: !!c.dnc,
        last_activity_date: c.last_activity_date,
        band: 'engagement',
        primary_action: c.phone ? 'call' : 'email',
        reason: `${c.signal_label} ${relativeAgo(days)}`,
        context_chips: [c.signal_kind === 'gift' ? 'Gift sent' : 'Event RSVP'],
      });
      if (engagementItems.length >= ENGAGEMENT_CAP) break;
    }

    const all = [...pipelineItems, ...cadenceItems, ...engagementItems];
    const contactIds = new Set<string>();
    const byContactId = new Map<string, QueueItem>();
    for (const item of all) {
      contactIds.add(item.contact_id);
      // First write wins — pipeline > cadence > engagement (matches the band
      // hierarchy ordering in `all` above), so a contact in two bands is
      // looked up by its highest-priority band.
      if (!byContactId.has(item.contact_id)) byContactId.set(item.contact_id, item);
    }
    return {
      pipeline: pipelineItems,
      cadence: cadenceItems,
      engagement: engagementItems,
      all,
      loading: pipelineQuery.isLoading || cadenceQuery.isLoading || engagementQuery.isLoading,
      contactIds,
      byContactId,
      counts: {
        pipeline: pipelineItems.length,
        cadence: cadenceItems.length,
        engagement: engagementItems.length,
        total: all.length,
      },
    };
  }, [
    pipelineQuery.data, pipelineQuery.isLoading,
    cadenceQuery.data, cadenceQuery.isLoading,
    engagementQuery.data, engagementQuery.isLoading,
    callLetters,
  ]);

  return result;
}

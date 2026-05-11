/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type DelightOccasionKind = 'birthday' | 'spouse_birthday' | 'home_anniversary';

export interface DelightOpportunity {
  contact_id: string;
  first_name: string | null;
  last_name: string | null;
  kind: DelightOccasionKind;
  occasion_date: string;
  days_away: number;
  last_gift_sent_at: string | null;
  gift_preferences: string | null;
  category: string | null;
}

export interface GiftHistoryEntry {
  id: string;
  contact_id: string;
  contact_name: string;
  activity_date: string;
  notes: string | null;
  outcome: string | null;
  metadata: Record<string, unknown>;
}

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  birthday: string | null;
  spouse_name: string | null;
  spouse_birthday: string | null;
  home_anniversary: string | null;
  last_gift_sent_at: string | null;
  gift_preferences: string | null;
  category: string | null;
}

function nextOccurrence(monthDay: string, today: Date): Date {
  const [m, d] = monthDay.slice(5).split('-').map(Number);
  const thisYear = new Date(today.getFullYear(), m - 1, d);
  if (thisYear.getTime() < today.getTime() - 24 * 3600 * 1000) {
    return new Date(today.getFullYear() + 1, m - 1, d);
  }
  return thisYear;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function useDelightOpportunities(windowDays = 60) {
  const { user } = useAuth();

  return useQuery<DelightOpportunity[]>({
    queryKey: ['delight-opportunities', user?.id, windowDays],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('contacts')
        .select(
          'id, first_name, last_name, birthday, spouse_name, spouse_birthday, home_anniversary, last_gift_sent_at, gift_preferences, category'
        )
        .eq('agent_id', user!.id)
        .or('birthday.not.is.null,spouse_birthday.not.is.null,home_anniversary.not.is.null');

      if (error) throw error;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const out: DelightOpportunity[] = [];

      for (const c of (data || []) as ContactRow[]) {
        const checks: Array<[DelightOccasionKind, string | null]> = [
          ['birthday', c.birthday],
          ['spouse_birthday', c.spouse_birthday],
          ['home_anniversary', c.home_anniversary],
        ];
        for (const [kind, raw] of checks) {
          if (!raw) continue;
          const next = nextOccurrence(raw, today);
          const days = daysBetween(today, next);
          if (days < 0 || days > windowDays) continue;
          out.push({
            contact_id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            kind,
            occasion_date: next.toISOString().slice(0, 10),
            days_away: days,
            last_gift_sent_at: c.last_gift_sent_at,
            gift_preferences: c.gift_preferences,
            category: c.category,
          });
        }
      }
      return out.sort((a, b) => a.days_away - b.days_away);
    },
  });
}

export function useGiftHistory(limit = 24) {
  const { user } = useAuth();

  return useQuery<GiftHistoryEntry[]>({
    queryKey: ['delight-gift-history', user?.id, limit],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('contact_activities')
        .select('id, contact_id, activity_date, notes, outcome, metadata, contacts(first_name, last_name)')
        .eq('agent_id', user!.id)
        .eq('activity_type', 'gift')
        .order('activity_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return ((data || []) as any[]).map((row) => ({
        id: row.id,
        contact_id: row.contact_id,
        contact_name: [row.contacts?.first_name, row.contacts?.last_name].filter(Boolean).join(' ') || 'Unknown',
        activity_date: row.activity_date,
        notes: row.notes,
        outcome: row.outcome,
        metadata: row.metadata || {},
      }));
    },
  });
}

export interface SendGiftInput {
  contact_id: string;
  description: string;
  amount?: number | null;
  occasion?: string | null;
  send_date?: string;
  gift_preferences?: string | null;
}

export function useSendGift() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendGiftInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      const activityDate = input.send_date ? new Date(input.send_date).toISOString() : new Date().toISOString();

      const { error: actErr } = await (supabase as any).from('contact_activities').insert([
        {
          contact_id: input.contact_id,
          agent_id: user.id,
          activity_type: 'gift',
          activity_date: activityDate,
          notes: input.description,
          outcome: input.occasion || null,
          metadata: {
            amount: input.amount ?? null,
            occasion: input.occasion ?? null,
          },
        },
      ]);
      if (actErr) throw actErr;

      if (input.gift_preferences !== undefined && input.gift_preferences !== null) {
        await (supabase as any)
          .from('contacts')
          .update({ gift_preferences: input.gift_preferences })
          .eq('id', input.contact_id)
          .eq('agent_id', user.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delight-opportunities'] });
      qc.invalidateQueries({ queryKey: ['delight-gift-history'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// ── Skip / dismiss an opportunity until next year ──────────────────────

/**
 * Skip a contact's delight opportunity for this cycle. Sets
 * `contacts.delight_skipped_until` to the day AFTER the current occurrence
 * — which means once that occurrence passes, the next year's same date
 * will start surfacing again.
 */
export function useSkipDelightOpportunity() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contact_id, occasion_date }: { contact_id: string; occasion_date: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      // Skip-until = the day AFTER this year's occurrence.
      const next = new Date(occasion_date + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      const skip = next.toISOString().slice(0, 10);
      const { error } = await (supabase as any)
        .from('contacts')
        .update({ delight_skipped_until: skip })
        .eq('id', contact_id)
        .eq('agent_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delight-opportunities'] });
    },
  });
}

// ── Bulk-capture: update a contact's delight fields ────────────────────

export interface ContactDelightFields {
  birthday?: string | null;
  spouse_name?: string | null;
  spouse_birthday?: string | null;
  home_anniversary?: string | null;
  gift_preferences?: string | null;
}

export function useUpdateContactDelight() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contact_id, patch }: { contact_id: string; patch: ContactDelightFields }) => {
      if (!user?.id) throw new Error('Not authenticated');
      // Strip undefined keys; keep nulls (caller may want to clear a field).
      const clean = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(clean).length === 0) return;
      const { error } = await (supabase as any)
        .from('contacts')
        .update(clean)
        .eq('id', contact_id)
        .eq('agent_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delight-opportunities'] });
      qc.invalidateQueries({ queryKey: ['delight-missing-data'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// ── Bulk-capture: surface contacts missing key date fields ─────────────

export interface ContactMissingData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  category: string | null;
  birthday: string | null;
  spouse_name: string | null;
  spouse_birthday: string | null;
  home_anniversary: string | null;
  gift_preferences: string | null;
}

/**
 * Pulls the agent's contacts that have ZERO delight-relevant fields filled.
 * The bulk-capture banner shows these one at a time so an agent can clear
 * the backlog quickly.
 */
export function useDelightMissingData(limit = 250) {
  const { user } = useAuth();

  return useQuery<ContactMissingData[]>({
    queryKey: ['delight-missing-data', user?.id, limit],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('contacts')
        .select('id, first_name, last_name, email, category, birthday, spouse_name, spouse_birthday, home_anniversary, gift_preferences')
        .eq('agent_id', user!.id)
        .is('birthday', null)
        .is('spouse_birthday', null)
        .is('home_anniversary', null)
        .order('first_name', { ascending: true, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as ContactMissingData[];
    },
  });
}

// ── AI gift suggestions ────────────────────────────────────────────────

export interface SuggestGiftInput {
  contact_id: string;
  occasion?: string | null;
  budget_usd?: number | null;
}

export interface GiftSuggestion {
  title: string;
  description: string;
  price_band: string;
  reason: string;
}

export interface SuggestGiftResponse {
  ok: boolean;
  suggestions?: GiftSuggestion[];
  error?: string;
}

/**
 * Calls the delight-suggest-gift edge fn (Grok-powered) and returns 3-5
 * gift ideas tailored to the contact's gift_preferences + occasion + budget.
 */
export function useSuggestGift() {
  return useMutation<SuggestGiftResponse, Error, SuggestGiftInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke<SuggestGiftResponse>(
        'delight-suggest-gift',
        { body: input },
      );
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Empty response');
      if (!data.ok) throw new Error(data.error ?? 'Suggestion failed');
      return data;
    },
  });
}

export interface DelightSummary {
  upcomingCount: number;
  monthSpend: number;
  ytdSpend: number;
  giftsThisMonth: number;
  giftsYtd: number;
}

export function useDelightSummary() {
  const { user } = useAuth();

  return useQuery<DelightSummary>({
    queryKey: ['delight-summary', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const startMonth = new Date();
      startMonth.setDate(1);
      startMonth.setHours(0, 0, 0, 0);
      const startYear = new Date(startMonth.getFullYear(), 0, 1);

      const { data, error } = await (supabase as any)
        .from('contact_activities')
        .select('activity_date, metadata')
        .eq('agent_id', user!.id)
        .eq('activity_type', 'gift')
        .gte('activity_date', startYear.toISOString())
        .order('activity_date', { ascending: false });

      if (error) throw error;
      let monthSpend = 0;
      let ytdSpend = 0;
      let giftsThisMonth = 0;
      let giftsYtd = 0;
      for (const row of (data || []) as any[]) {
        const amt = Number(row.metadata?.amount ?? 0) || 0;
        const when = new Date(row.activity_date);
        ytdSpend += amt;
        giftsYtd += 1;
        if (when >= startMonth) {
          monthSpend += amt;
          giftsThisMonth += 1;
        }
      }

      return { upcomingCount: 0, monthSpend, ytdSpend, giftsThisMonth, giftsYtd };
    },
  });
}

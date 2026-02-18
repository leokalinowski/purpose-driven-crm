import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Sponsor {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  logo_url: string | null;
  sponsorship_tier: string | null;
  sponsorship_amount: number | null;
  payment_status: string | null;
  contract_status: string | null;
  renewal_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  event_count?: number;
  linked_event_ids?: string[];
}

export type SponsorInsert = Omit<Sponsor, 'id' | 'created_at' | 'updated_at' | 'event_count' | 'linked_event_ids'>;

const TIERS = ['Gold', 'Silver', 'Bronze', 'Custom'] as const;
const PAYMENT_STATUSES = ['pending', 'paid', 'partial', 'overdue'] as const;
const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'cancelled'] as const;

export { TIERS, PAYMENT_STATUSES, CONTRACT_STATUSES };

export const useSponsors = () => {
  const qc = useQueryClient();

  const sponsorsQuery = useQuery({
    queryKey: ['sponsors'],
    queryFn: async () => {
      const { data: sponsors, error } = await supabase
        .from('sponsors')
        .select('*')
        .order('company_name');
      if (error) throw error;

      // Fetch event links
      const { data: links, error: linksErr } = await supabase
        .from('sponsor_events')
        .select('sponsor_id, event_id');
      if (linksErr) throw linksErr;

      const linkMap = new Map<string, string[]>();
      (links ?? []).forEach((l) => {
        const arr = linkMap.get(l.sponsor_id) ?? [];
        arr.push(l.event_id);
        linkMap.set(l.sponsor_id, arr);
      });

      return (sponsors ?? []).map((s) => ({
        ...s,
        event_count: linkMap.get(s.id)?.length ?? 0,
        linked_event_ids: linkMap.get(s.id) ?? [],
      })) as Sponsor[];
    },
  });

  const createSponsor = useMutation({
    mutationFn: async ({ eventIds, ...sponsor }: SponsorInsert & { eventIds?: string[] }) => {
      const { data, error } = await supabase.from('sponsors').insert(sponsor).select().single();
      if (error) throw error;
      if (eventIds?.length) {
        const rows = eventIds.map((event_id) => ({ sponsor_id: data.id, event_id }));
        const { error: linkErr } = await supabase.from('sponsor_events').insert(rows);
        if (linkErr) throw linkErr;
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsors'] });
      toast({ title: 'Sponsor created' });
    },
    onError: (e: Error) => toast({ title: 'Error creating sponsor', description: e.message, variant: 'destructive' }),
  });

  const updateSponsor = useMutation({
    mutationFn: async ({ id, eventIds, ...sponsor }: Partial<Sponsor> & { id: string; eventIds?: string[] }) => {
      const { error } = await supabase.from('sponsors').update(sponsor).eq('id', id);
      if (error) throw error;
      if (eventIds !== undefined) {
        await supabase.from('sponsor_events').delete().eq('sponsor_id', id);
        if (eventIds.length) {
          const rows = eventIds.map((event_id) => ({ sponsor_id: id, event_id }));
          const { error: linkErr } = await supabase.from('sponsor_events').insert(rows);
          if (linkErr) throw linkErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsors'] });
      toast({ title: 'Sponsor updated' });
    },
    onError: (e: Error) => toast({ title: 'Error updating sponsor', description: e.message, variant: 'destructive' }),
  });

  const deleteSponsor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sponsors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsors'] });
      toast({ title: 'Sponsor deleted' });
    },
    onError: (e: Error) => toast({ title: 'Error deleting sponsor', description: e.message, variant: 'destructive' }),
  });

  return { sponsorsQuery, createSponsor, updateSponsor, deleteSponsor };
};

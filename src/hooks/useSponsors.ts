import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface SponsorContact {
  id?: string;
  sponsor_id?: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  region: string | null;
  is_primary: boolean;
}

export interface EventContribution {
  event_id: string;
  contribution_type: string | null;
  contribution_amount: number | null;
  contribution_description: string | null;
}

export interface Sponsor {
  id: string;
  company_name: string;
  website: string | null;
  logo_url: string | null;
  payment_status: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contacts: SponsorContact[];
  contributions: EventContribution[];
  total_contributed: number;
  event_count: number;
}

export type SponsorInsert = {
  company_name: string;
  website?: string | null;
  logo_url?: string | null;
  payment_status?: string | null;
  notes?: string | null;
  created_by?: string | null;
  contacts?: SponsorContact[];
  contributions?: EventContribution[];
};

const PAYMENT_STATUSES = ['pending', 'paid', 'partial', 'overdue'] as const;
const CONTRIBUTION_TYPES = ['money', 'food', 'venue', 'drinks', 'raffle', 'other'] as const;

export { PAYMENT_STATUSES, CONTRIBUTION_TYPES };

const SUPABASE_URL = 'https://cguoaokqwgqvzkqqezcq.supabase.co';

export const getLogoPublicUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/sponsor-logos/${path}`;

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

      const { data: contacts, error: cErr } = await supabase
        .from('sponsor_contacts')
        .select('*');
      if (cErr) throw cErr;

      const { data: links, error: lErr } = await supabase
        .from('sponsor_events')
        .select('sponsor_id, event_id, contribution_type, contribution_amount, contribution_description');
      if (lErr) throw lErr;

      const contactMap = new Map<string, SponsorContact[]>();
      (contacts ?? []).forEach((c: any) => {
        const arr = contactMap.get(c.sponsor_id) ?? [];
        arr.push(c);
        contactMap.set(c.sponsor_id, arr);
      });

      const contribMap = new Map<string, EventContribution[]>();
      (links ?? []).forEach((l: any) => {
        const arr = contribMap.get(l.sponsor_id) ?? [];
        arr.push({
          event_id: l.event_id,
          contribution_type: l.contribution_type,
          contribution_amount: l.contribution_amount,
          contribution_description: l.contribution_description,
        });
        contribMap.set(l.sponsor_id, arr);
      });

      return (sponsors ?? []).map((s: any) => {
        const contribs = contribMap.get(s.id) ?? [];
        const total = contribs.reduce((sum, c) => sum + (c.contribution_amount ?? 0), 0);
        return {
          ...s,
          contacts: contactMap.get(s.id) ?? [],
          contributions: contribs,
          total_contributed: total,
          event_count: contribs.length,
        };
      }) as Sponsor[];
    },
  });

  const createSponsor = useMutation({
    mutationFn: async ({ contacts, contributions, ...sponsor }: SponsorInsert) => {
      const { data, error } = await supabase.from('sponsors').insert(sponsor).select().single();
      if (error) throw error;

      if (contacts?.length) {
        const rows = contacts.map(({ id, sponsor_id, ...c }) => ({ ...c, sponsor_id: data.id }));
        const { error: cErr } = await supabase.from('sponsor_contacts').insert(rows);
        if (cErr) throw cErr;
      }

      if (contributions?.length) {
        const rows = contributions.map((c) => ({ sponsor_id: data.id, ...c }));
        const { error: lErr } = await supabase.from('sponsor_events').insert(rows);
        if (lErr) throw lErr;
      }

      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sponsors'] }); toast({ title: 'Sponsor created' }); },
    onError: (e: Error) => toast({ title: 'Error creating sponsor', description: e.message, variant: 'destructive' }),
  });

  const updateSponsor = useMutation({
    mutationFn: async ({ id, contacts, contributions, ...sponsor }: Partial<Sponsor> & { id: string; contacts?: SponsorContact[]; contributions?: EventContribution[] }) => {
      const { error } = await supabase.from('sponsors').update(sponsor).eq('id', id);
      if (error) throw error;

      if (contacts !== undefined) {
        await supabase.from('sponsor_contacts').delete().eq('sponsor_id', id);
        if (contacts.length) {
          const rows = contacts.map(({ id: _id, sponsor_id: _sid, ...c }) => ({ ...c, sponsor_id: id }));
          const { error: cErr } = await supabase.from('sponsor_contacts').insert(rows);
          if (cErr) throw cErr;
        }
      }

      if (contributions !== undefined) {
        await supabase.from('sponsor_events').delete().eq('sponsor_id', id);
        if (contributions.length) {
          const rows = contributions.map((c) => ({ sponsor_id: id, ...c }));
          const { error: lErr } = await supabase.from('sponsor_events').insert(rows);
          if (lErr) throw lErr;
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sponsors'] }); toast({ title: 'Sponsor updated' }); },
    onError: (e: Error) => toast({ title: 'Error updating sponsor', description: e.message, variant: 'destructive' }),
  });

  const deleteSponsor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sponsors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sponsors'] }); toast({ title: 'Sponsor deleted' }); },
    onError: (e: Error) => toast({ title: 'Error deleting sponsor', description: e.message, variant: 'destructive' }),
  });

  const uploadLogo = async (sponsorId: string, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `${sponsorId}/logo.${ext}`;
    const { error } = await supabase.storage.from('sponsor-logos').upload(path, file, { upsert: true });
    if (error) throw error;
    const url = getLogoPublicUrl(path);
    await supabase.from('sponsors').update({ logo_url: url }).eq('id', sponsorId);
    qc.invalidateQueries({ queryKey: ['sponsors'] });
    return url;
  };

  return { sponsorsQuery, createSponsor, updateSponsor, deleteSponsor, uploadLogo };
};

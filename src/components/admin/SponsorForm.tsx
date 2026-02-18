import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Upload } from 'lucide-react';
import { PAYMENT_STATUSES, CONTRIBUTION_TYPES, type Sponsor, type SponsorContact, type EventContribution } from '@/hooks/useSponsors';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface SponsorFormProps {
  sponsor?: Sponsor | null;
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const emptyContact = (): SponsorContact => ({
  contact_name: '', contact_email: null, contact_phone: null, region: null, is_primary: false,
});

export function SponsorForm({ sponsor, onSubmit, onCancel, isLoading }: SponsorFormProps) {
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [notes, setNotes] = useState('');
  const [contacts, setContacts] = useState<SponsorContact[]>([emptyContact()]);
  const [contributions, setContributions] = useState<(EventContribution & { selected: boolean })[]>([]);

  const eventsQuery = useQuery({
    queryKey: ['events-for-sponsors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('id, title, event_date, agent_id').order('event_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ['profiles-for-sponsor-events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    (profilesQuery.data ?? []).forEach((p) => m.set(p.user_id, p.full_name));
    return m;
  }, [profilesQuery.data]);

  useEffect(() => {
    if (sponsor) {
      setCompanyName(sponsor.company_name);
      setWebsite(sponsor.website ?? '');
      setLogoUrl(sponsor.logo_url ?? '');
      setPaymentStatus(sponsor.payment_status ?? 'pending');
      setNotes(sponsor.notes ?? '');
      setContacts(sponsor.contacts.length ? sponsor.contacts : [emptyContact()]);
    }
  }, [sponsor]);

  // Build contribution state once events load
  useEffect(() => {
    if (!eventsQuery.data) return;
    const existing = sponsor?.contributions ?? [];
    const mapped = eventsQuery.data.map((ev) => {
      const match = existing.find((c) => c.event_id === ev.id);
      return {
        event_id: ev.id,
        selected: !!match,
        contribution_type: match?.contribution_type ?? null,
        contribution_amount: match?.contribution_amount ?? null,
        contribution_description: match?.contribution_description ?? null,
      };
    });
    setContributions(mapped);
  }, [eventsQuery.data, sponsor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedContributions = contributions
      .filter((c) => c.selected)
      .map(({ selected, ...rest }) => rest);
    onSubmit({
      company_name: companyName,
      website: website || null,
      logo_url: logoUrl || null,
      payment_status: paymentStatus,
      notes: notes || null,
      contacts,
      contributions: selectedContributions,
      _logoFile: logoFile,
    });
  };

  const updateContact = (idx: number, field: string, value: string | boolean) => {
    setContacts((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value || null } : c));
  };

  const addContact = () => setContacts((prev) => [...prev, emptyContact()]);
  const removeContact = (idx: number) => setContacts((prev) => prev.filter((_, i) => i !== idx));

  const toggleEvent = (idx: number) => {
    setContributions((prev) => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  };

  const updateContribution = (idx: number, field: string, value: string | number | null) => {
    setContributions((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoUrl(URL.createObjectURL(file));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
      {/* Company Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Company Name *</Label>
          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Website</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
        </div>
      </div>

      {/* Logo Upload */}
      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          {logoUrl && <img src={logoUrl} alt="Logo preview" className="h-12 w-12 rounded object-contain border" />}
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-accent">
            <Upload className="h-4 w-4" />
            {logoFile ? logoFile.name : 'Upload logo'}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
          </label>
        </div>
      </div>

      {/* Payment Status */}
      <div className="space-y-2 max-w-xs">
        <Label>Payment Status</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Contacts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Contacts</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addContact}><Plus className="h-4 w-4 mr-1" /> Add Contact</Button>
        </div>
        {contacts.map((c, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end border rounded-md p-3">
            <div className="space-y-1 col-span-3 sm:col-span-1">
              <Label className="text-xs">Name *</Label>
              <Input value={c.contact_name} onChange={(e) => updateContact(idx, 'contact_name', e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={c.contact_email ?? ''} onChange={(e) => updateContact(idx, 'contact_email', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={c.contact_phone ?? ''} onChange={(e) => updateContact(idx, 'contact_phone', e.target.value)} />
            </div>
            <div className="flex items-end gap-1 pb-0.5">
              {contacts.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              )}
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Region</Label>
              <Input value={c.region ?? ''} onChange={(e) => updateContact(idx, 'region', e.target.value)} placeholder="e.g. DMV, Hampton Roads" />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Checkbox checked={c.is_primary} onCheckedChange={(v) => {
                // Only one primary at a time
                setContacts((prev) => prev.map((ct, i) => ({ ...ct, is_primary: i === idx ? !!v : false })));
              }} />
              <Label className="text-xs">Primary</Label>
            </div>
          </div>
        ))}
      </div>

      {/* Event Contributions */}
      <div className="space-y-2">
        <Label>Event Contributions</Label>
        <ScrollArea className="h-48 rounded border p-2">
          {contributions.map((c, idx) => {
            const ev = eventsQuery.data?.find((e) => e.id === c.event_id);
            if (!ev) return null;
            return (
              <div key={c.event_id} className="border-b last:border-0 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox checked={c.selected} onCheckedChange={() => toggleEvent(idx)} />
                  <span className="text-sm font-medium">{ev.title}</span>
                   <Badge variant="outline" className="text-xs">{format(parseISO(ev.event_date), 'MMM d, yyyy')}</Badge>
                   <span className="text-xs text-muted-foreground">({agentMap.get(ev.agent_id ?? '') ?? 'Unassigned'})</span>
                </div>
                {c.selected && (
                  <div className="grid grid-cols-3 gap-2 pl-6">
                    <Select value={c.contribution_type ?? ''} onValueChange={(v) => updateContribution(idx, 'contribution_type', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        {CONTRIBUTION_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" min="0" step="0.01" placeholder="Amount ($)"
                      className="h-8 text-xs"
                      value={c.contribution_amount ?? ''}
                      onChange={(e) => updateContribution(idx, 'contribution_amount', e.target.value ? Number(e.target.value) : null)}
                    />
                    <Input
                      placeholder="Description"
                      className="h-8 text-xs"
                      value={c.contribution_description ?? ''}
                      onChange={(e) => updateContribution(idx, 'contribution_description', e.target.value || null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {eventsQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No events found</p>}
        </ScrollArea>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{sponsor ? 'Update' : 'Add'} Sponsor</Button>
      </div>
    </form>
  );
}

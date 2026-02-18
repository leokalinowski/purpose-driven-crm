import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { TIERS, PAYMENT_STATUSES, CONTRACT_STATUSES, type Sponsor } from '@/hooks/useSponsors';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SponsorFormProps {
  sponsor?: Sponsor | null;
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SponsorForm({ sponsor, onSubmit, onCancel, isLoading }: SponsorFormProps) {
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    logo_url: '',
    sponsorship_tier: '',
    sponsorship_amount: '',
    payment_status: 'pending',
    contract_status: 'draft',
    renewal_date: null as Date | null,
    notes: '',
  });
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);

  const eventsQuery = useQuery({
    queryKey: ['events-for-sponsors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('id, title, event_date').order('event_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (sponsor) {
      setForm({
        company_name: sponsor.company_name,
        contact_name: sponsor.contact_name ?? '',
        contact_email: sponsor.contact_email ?? '',
        contact_phone: sponsor.contact_phone ?? '',
        website: sponsor.website ?? '',
        logo_url: sponsor.logo_url ?? '',
        sponsorship_tier: sponsor.sponsorship_tier ?? '',
        sponsorship_amount: sponsor.sponsorship_amount?.toString() ?? '',
        payment_status: sponsor.payment_status ?? 'pending',
        contract_status: sponsor.contract_status ?? 'draft',
        renewal_date: sponsor.renewal_date ? parseISO(sponsor.renewal_date) : null,
        notes: sponsor.notes ?? '',
      });
      setSelectedEventIds(sponsor.linked_event_ids ?? []);
    }
  }, [sponsor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      website: form.website || null,
      logo_url: form.logo_url || null,
      sponsorship_tier: form.sponsorship_tier || null,
      sponsorship_amount: form.sponsorship_amount ? Number(form.sponsorship_amount) : null,
      payment_status: form.payment_status,
      contract_status: form.contract_status,
      renewal_date: form.renewal_date ? format(form.renewal_date, 'yyyy-MM-dd') : null,
      notes: form.notes || null,
      eventIds: selectedEventIds,
    });
  };

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company_name">Company Name *</Label>
          <Input id="company_name" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_name">Contact Name</Label>
          <Input id="contact_name" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_email">Contact Email</Label>
          <Input id="contact_email" type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_phone">Contact Phone</Label>
          <Input id="contact_phone" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo_url">Logo URL</Label>
          <Input id="logo_url" value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Sponsorship Tier</Label>
          <Select value={form.sponsorship_tier} onValueChange={(v) => set('sponsorship_tier', v)}>
            <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
            <SelectContent>
              {TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sponsorship_amount">Amount ($)</Label>
          <Input id="sponsorship_amount" type="number" min="0" step="0.01" value={form.sponsorship_amount} onChange={(e) => set('sponsorship_amount', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Payment Status</Label>
          <Select value={form.payment_status} onValueChange={(v) => set('payment_status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Contract Status</Label>
          <Select value={form.contract_status} onValueChange={(v) => set('contract_status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTRACT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Renewal Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.renewal_date && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.renewal_date ? format(form.renewal_date, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.renewal_date ?? undefined} onSelect={(d) => setForm((f) => ({ ...f, renewal_date: d ?? null }))} /></PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Linked Events</Label>
        <ScrollArea className="h-32 rounded border p-2">
          {eventsQuery.data?.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 py-1">
              <Checkbox checked={selectedEventIds.includes(ev.id)} onCheckedChange={() => toggleEvent(ev.id)} id={`ev-${ev.id}`} />
              <label htmlFor={`ev-${ev.id}`} className="text-sm cursor-pointer">
                {ev.title} ({format(parseISO(ev.event_date), 'MMM d, yyyy')})
              </label>
            </div>
          ))}
          {eventsQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No events found</p>}
        </ScrollArea>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{sponsor ? 'Update' : 'Add'} Sponsor</Button>
      </div>
    </form>
  );
}

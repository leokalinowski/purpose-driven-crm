import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Gift, Sparkles, ArrowUpRight, ArrowRight, Search, Heart, Cake, Home, X,
  Send, Loader2, AlertCircle, SkipForward, Wand2, AlertTriangle,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  useDelightOpportunities, useGiftHistory, useSendGift, useDelightSummary,
  useSkipDelightOpportunity, useDelightMissingData, useSuggestGift,
  type DelightOpportunity, type GiftSuggestion,
} from '@/hooks/useDelight';
import { useContacts } from '@/hooks/useContacts';
import { toast } from '@/hooks/use-toast';
import { BulkCaptureSheet } from '@/components/delight/BulkCaptureSheet';

const fmtCurrency = (n: number) =>
  n >= 0
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '$0';

const occasionLabel: Record<DelightOpportunity['kind'], { label: string; icon: typeof Cake }> = {
  birthday: { label: 'Birthday', icon: Cake },
  spouse_birthday: { label: "Spouse's birthday", icon: Heart },
  home_anniversary: { label: 'Home anniversary', icon: Home },
};

function fmtDayOffset(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `${days} days away`;
  if (days <= 30) return `${days} days away`;
  return `${days} days away`;
}

function contactDisplayName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(' ') || 'Unknown contact';
}

export default function Delight() {
  const { data: opportunities = [], isLoading: oppLoading } = useDelightOpportunities(60);
  const { data: history = [], isLoading: histLoading } = useGiftHistory(24);
  const { data: summary } = useDelightSummary();
  const { data: missingData = [] } = useDelightMissingData(250);
  const { allContacts } = useContacts();
  const sendGift = useSendGift();
  const skipOpp = useSkipDelightOpportunity();
  const suggestGift = useSuggestGift();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkCaptureOpen, setBulkCaptureOpen] = useState(false);
  const [presetOpp, setPresetOpp] = useState<DelightOpportunity | null>(null);
  const [contactQuery, setContactQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [occasion, setOccasion] = useState('');
  const [sendDate, setSendDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [giftPrefs, setGiftPrefs] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<GiftSuggestion[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const upcomingThisWeek = useMemo(
    () => opportunities.filter((o) => o.days_away <= 7).length,
    [opportunities],
  );

  // Reset AI panel when drawer opens / closes / changes contact.
  useEffect(() => {
    setAiSuggestions([]);
    setAiError(null);
  }, [drawerOpen, selectedContactId]);

  // Compute "sphere covered" honestly: distinct contacts with at least one
  // gift logged YTD, divided by contacts that HAVE a gift-able occasion
  // (birthday, spouse_birthday, or home_anniversary). Falls back to 0
  // when nobody has a date on file (avoids the misleading 0% on day 1).
  const distinctRecipientsYtd = useMemo(() => {
    const ids = new Set<string>();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    for (const h of history) {
      if (new Date(h.activity_date).getTime() >= yearStart) ids.add(h.contact_id);
    }
    return ids.size;
  }, [history]);
  const totalContactsCount = allContacts?.length ?? 0;
  const contactsWithoutAnyDate = missingData.length;
  const contactsWithSomeDate = Math.max(totalContactsCount - contactsWithoutAnyDate, 0);
  const coveragePct = contactsWithSomeDate > 0
    ? Math.round((distinctRecipientsYtd / contactsWithSomeDate) * 100)
    : null;

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    const list = allContacts ?? [];
    if (!q) return list.slice(0, 8);
    return list
      .filter((c) => {
        const name = contactDisplayName(c.first_name, c.last_name).toLowerCase();
        return (
          name.includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [contactQuery, allContacts]);

  const openDrawer = (opp?: DelightOpportunity) => {
    setPresetOpp(opp ?? null);
    if (opp) {
      setSelectedContactId(opp.contact_id);
      setOccasion(occasionLabel[opp.kind].label);
      setSendDate(opp.occasion_date);
      setGiftPrefs(opp.gift_preferences ?? '');
      const fullName = contactDisplayName(opp.first_name, opp.last_name);
      setDescription(`Gift for ${fullName} — ${occasionLabel[opp.kind].label}`);
    } else {
      setSelectedContactId('');
      setOccasion('');
      setSendDate(new Date().toISOString().slice(0, 10));
      setGiftPrefs('');
      setDescription('');
    }
    setAmount('');
    setContactQuery('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (sendGift.isPending) return;
    setDrawerOpen(false);
  };

  const submit = async () => {
    if (!selectedContactId) {
      toast({ title: 'Pick a contact', description: 'Choose who this gift is for.' });
      return;
    }
    if (!description.trim()) {
      toast({ title: 'Add a description', description: 'What did you send?' });
      return;
    }

    try {
      await sendGift.mutateAsync({
        contact_id: selectedContactId,
        description: description.trim(),
        amount: amount ? Number(amount) : null,
        occasion: occasion.trim() || null,
        send_date: sendDate,
        gift_preferences: giftPrefs.trim() || null,
      });
      toast({ title: 'Gift logged', description: 'Activity recorded · last touch updated' });
      setDrawerOpen(false);
    } catch (err) {
      toast({
        title: 'Could not log gift',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const fetchAiSuggestions = async () => {
    if (!selectedContactId) {
      toast({ title: 'Pick a contact', description: 'Choose who this gift is for first.' });
      return;
    }
    setAiError(null);
    try {
      const result = await suggestGift.mutateAsync({
        contact_id: selectedContactId,
        occasion: occasion.trim() || null,
        budget_usd: amount ? Number(amount) : null,
      });
      setAiSuggestions(result.suggestions ?? []);
      if (result.error) setAiError(result.error);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Suggestion failed');
    }
  };

  const applySuggestion = (s: GiftSuggestion) => {
    setDescription(s.title + ' — ' + s.description);
    // Try to parse a usable number out of the price band ($30–$45 → 30).
    const m = s.price_band.match(/\d+/);
    if (m && !amount) setAmount(m[0]);
  };

  const handleSkipOpp = async (opp: DelightOpportunity) => {
    if (!confirm(`Skip ${contactDisplayName(opp.first_name, opp.last_name)} this year? They'll show up again next year.`)) return;
    try {
      await skipOpp.mutateAsync({ contact_id: opp.contact_id, occasion_date: opp.occasion_date });
      toast({ title: 'Skipped for the year', description: `${contactDisplayName(opp.first_name, opp.last_name)} won't show up again until next ${occasionLabel[opp.kind].label.toLowerCase()}.` });
    } catch (err) {
      toast({
        title: 'Could not skip',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Surprise & Delight — Real Estate on Purpose</title>
      </Helmet>

      <div className="flex justify-between items-start gap-4 mb-7 flex-wrap">
        <div>
          <span className="eye-label">Surprise & Delight</span>
          <h1 className="font-display text-[clamp(2rem,2.6vw+0.6rem,2.5rem)] font-medium tracking-tighter leading-[1.1] text-reop-dark-blue mt-1.5">
            Small gestures, unforgettable clients.
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2 max-w-[640px] leading-relaxed">
            Anniversaries, birthdays, pop-by visits — the touches that turn transactions into lifelong relationships.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button size="sm" className="gap-1.5 h-9" onClick={() => openDrawer()}>
            <Gift className="w-3.5 h-3.5" />
            Log a gift
          </Button>
        </div>
      </div>

      {/* Bulk-capture banner — only shows when there's a real backlog. */}
      {missingData.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4 flex items-start gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-reop-dark-blue">
              {missingData.length} contact{missingData.length === 1 ? '' : 's'} missing key dates
            </div>
            <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-snug">
              Birthdays and home anniversaries power your gifting calendar.
              Capture them once and the Coach starts surfacing opportunities automatically.
            </p>
          </div>
          <Button size="sm" onClick={() => setBulkCaptureOpen(true)} className="gap-1.5 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            Capture now
          </Button>
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        <SummaryTile label="Upcoming · 60d" value={String(opportunities.length)} sub={`${upcomingThisWeek} this week`} />
        <SummaryTile label="Gifts this month" value={String(summary?.giftsThisMonth ?? 0)} sub={`${fmtCurrency(summary?.monthSpend ?? 0)} spent`} />
        <SummaryTile label="Gifts YTD" value={String(summary?.giftsYtd ?? 0)} sub={`${fmtCurrency(summary?.ytdSpend ?? 0)} spent`} />
        <SummaryTile
          label="Sphere covered"
          value={coveragePct == null ? '—' : `${coveragePct}%`}
          sub={
            coveragePct == null
              ? 'Add a date on a contact to start'
              : `${distinctRecipientsYtd} of ${contactsWithSomeDate} gift-eligible contacts`
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-7">
        <div className="bg-card border border-border rounded-[14px] px-7 py-6 relative overflow-hidden">
          <div
            className="absolute -right-20 -top-20 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(35 100% 70% / 0.25), transparent 70%)' }}
          />
          <h3 className="m-0 mb-1 text-xs uppercase tracking-[0.07em] text-primary font-bold flex items-center gap-1.5">
            <Sparkles className="w-[13px] h-[13px]" />
            Upcoming gifting opportunities
          </h3>
          <div className="font-display text-[clamp(1.5rem,2vw+0.5rem,1.875rem)] font-medium tracking-[-0.03em] leading-[1.2] text-reop-dark-blue mb-4 relative">
            {oppLoading ? 'Loading…' : `${opportunities.length} ${opportunities.length === 1 ? 'person' : 'people'} to delight in the next 60 days.`}
          </div>

          {oppLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading opportunities…
            </div>
          ) : opportunities.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl px-5 py-8 text-center text-sm text-muted-foreground">
              <p className="mb-3">
                No upcoming birthdays or home anniversaries in the next 60 days. Add a birthday or close date on a contact to surface them here.
              </p>
              <Button asChild size="sm" variant="outline">
                <a href="/database">Open Database</a>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 relative max-h-[460px] overflow-y-auto">
              {opportunities.slice(0, 8).map((opp) => {
                const dt = new Date(opp.occasion_date + 'T00:00:00');
                const mo = dt.toLocaleString('en-US', { month: 'short' });
                const dn = String(dt.getDate());
                const Icon = occasionLabel[opp.kind].icon;
                const tone = opp.days_away <= 3 ? 'warn' : opp.days_away <= 14 ? 'primary' : 'plain';
                return (
                  <div
                    key={`${opp.contact_id}-${opp.kind}`}
                    className="grid grid-cols-[56px_1fr_auto] gap-3.5 p-3.5 border border-border rounded-[10px] items-center bg-card"
                  >
                    <div className="text-center bg-[hsl(210_20%_97%)] rounded-lg py-1.5">
                      <div className="text-[10px] font-bold uppercase text-primary tracking-[0.07em]">{mo}</div>
                      <div className="text-lg font-semibold leading-none text-reop-dark-blue mt-0.5">{dn}</div>
                    </div>
                    <div className="min-w-0">
                      <b className="block text-sm font-semibold mb-0.5 text-reop-dark-blue truncate">
                        {contactDisplayName(opp.first_name, opp.last_name)}
                      </b>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {occasionLabel[opp.kind].label}
                        {opp.gift_preferences ? ` · ${opp.gift_preferences}` : opp.category ? ` · ${opp.category}` : ''}
                      </span>
                      <div className="flex gap-1.5 mt-1.5">
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                            tone === 'warn' && 'bg-[hsl(35_100%_94%)] text-[hsl(35_80%_45%)]',
                            tone === 'primary' && 'bg-primary/10 text-primary',
                            tone === 'plain' && 'bg-[hsl(210_20%_94%)] text-secondary',
                          )}
                        >
                          {fmtDayOffset(opp.days_away)}
                        </span>
                        {opp.last_gift_sent_at && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[hsl(140_40%_92%)] text-reop-green">
                            Last gift {new Date(opp.last_gift_sent_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => openDrawer(opp)}
                        className="w-[34px] h-[34px] rounded-lg border border-border bg-card flex items-center justify-center text-reop-dark-blue hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition-colors"
                        aria-label="Log gift"
                        title="Log a gift for this contact"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSkipOpp(opp)}
                        disabled={skipOpp.isPending}
                        className="w-[34px] h-[34px] rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-reop-dark-blue transition-colors"
                        aria-label="Skip this year"
                        title="Skip this year (will reappear next year)"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="rounded-[14px] px-6 py-5 relative overflow-hidden text-white flex flex-col"
          style={{ background: 'linear-gradient(135deg, hsl(var(--reop-dark-blue)), hsl(210 47% 18%))' }}
        >
          <div
            className="absolute -right-10 -bottom-10 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(184 100% 50% / 0.25), transparent 70%)' }}
          />
          <h4 className="m-0 mb-1 text-[11px] uppercase tracking-[0.07em] text-[hsl(184_60%_80%)] font-bold">
            Delight spend · YTD
          </h4>
          <div className="font-display text-[40px] font-medium tracking-[-0.02em] leading-none">
            {fmtCurrency(summary?.ytdSpend ?? 0)}
          </div>
          <div className="text-[13px] text-[hsl(210_30%_80%)] mb-4">
            {summary?.giftsYtd ?? 0} gifts logged this year
          </div>
          <div className="text-[12px] text-[hsl(210_30%_80%)] leading-relaxed relative">
            Logged via the contact activity feed. Each gift updates <strong>last_gift_sent_at</strong> so the Coach knows who you've already touched.
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-3.5">
          <h3 className="m-0 text-base font-semibold text-reop-dark-blue">Recently sent</h3>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-primary" asChild>
              <a href="/database?activity=gift">
                Full history
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
        </div>
        {histLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading history…
          </div>
        ) : history.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl px-5 py-10 text-center text-sm text-muted-foreground">
            <p className="mb-3">Nothing yet. Log your first gift to start a record of who you've delighted.</p>
            <Button size="sm" onClick={() => openDrawer()}>
              <Gift className="w-3.5 h-3.5 mr-1.5" />
              Log a gift
            </Button>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {history.map((h) => {
              const dt = new Date(h.activity_date);
              const initials = h.contact_name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0]!.toUpperCase())
                .join('');
              const amt = Number(h.metadata?.amount ?? 0);
              return (
                <div
                  key={h.id}
                  className="bg-card border border-border rounded-[10px] px-4 py-3.5 flex flex-col gap-1.5"
                >
                  <div className="flex gap-2.5 items-center">
                    <div className="w-9 h-9 rounded-full bg-reop-teal-soft text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0">
                      {initials || '·'}
                    </div>
                    <div className="min-w-0">
                      <b className="text-sm font-semibold block text-reop-dark-blue truncate">{h.contact_name}</b>
                      <div className="text-[11.5px] text-muted-foreground">{dt.toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-xs text-reop-dark-blue line-clamp-2">{h.notes || h.outcome || 'Gift'}</div>
                  <div className="flex justify-between items-center mt-1.5 pt-2 border-t border-dashed border-border text-[11px] text-muted-foreground">
                    <span>{h.outcome || 'Gift'}</span>
                    <span className="font-semibold">{amt > 0 ? fmtCurrency(amt) : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {drawerOpen && (
        <div className="fixed inset-0 bg-black/30 z-[100]" onClick={closeDrawer} />
      )}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 w-[460px] max-w-[96vw] bg-background z-[101] flex flex-col shadow-[-4px_0_32px_rgba(0,0,0,0.14)] transition-transform duration-300',
          drawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="px-6 pt-5 pb-4 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-[10px] bg-[hsl(300_30%_92%)] text-[hsl(300_50%_35%)] flex items-center justify-center flex-shrink-0">
            <Gift className="w-[18px] h-[18px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold text-primary">Surprise & Delight</div>
            <div className="text-[16px] font-semibold tracking-[-0.01em] text-reop-dark-blue truncate">
              {presetOpp ? `Log gift — ${contactDisplayName(presetOpp.first_name, presetOpp.last_name)}` : 'Log a gift'}
            </div>
          </div>
          <button
            onClick={closeDrawer}
            className="w-[30px] h-[30px] rounded-[7px] border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-reop-dark-blue"
            aria-label="Close"
            disabled={sendGift.isPending}
          >
            <X className="w-[15px] h-[15px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!presetOpp && (
            <div>
              <Label className="text-xs font-semibold text-reop-dark-blue mb-1.5 block">Recipient</Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={contactQuery}
                  onChange={(e) => setContactQuery(e.target.value)}
                  placeholder="Search contacts…"
                  className="pl-9 h-10"
                />
              </div>
              <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto">
                {filteredContacts.map((c) => {
                  const active = c.id === selectedContactId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedContactId(c.id)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all border',
                        active ? 'border-primary bg-[hsl(184_100%_98%)]' : 'border-transparent hover:bg-muted',
                      )}
                    >
                      <div className="w-7 h-7 rounded-full bg-reop-teal-soft text-primary text-[10.5px] font-semibold flex items-center justify-center flex-shrink-0">
                        {(c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '') || '·'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-reop-dark-blue truncate">
                          {contactDisplayName(c.first_name, c.last_name)}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{c.email || c.phone || '—'}</div>
                      </div>
                    </button>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <div className="text-xs text-muted-foreground px-3 py-3">No matching contacts.</div>
                )}
              </div>
            </div>
          )}

          {presetOpp && (
            <div className="px-3.5 py-3 bg-[hsl(184_100%_98%)] border border-primary/30 rounded-lg text-[13px]">
              <div className="font-semibold text-reop-dark-blue">
                {contactDisplayName(presetOpp.first_name, presetOpp.last_name)}
              </div>
              <div className="text-muted-foreground text-[12px] mt-0.5">
                {occasionLabel[presetOpp.kind].label} · {fmtDayOffset(presetOpp.days_away)}
                {presetOpp.gift_preferences ? ` · prefers ${presetOpp.gift_preferences}` : ''}
              </div>
            </div>
          )}

          {/* AI suggestions panel — collapsed when empty + idle */}
          {selectedContactId && (
            <div className="rounded-lg border border-border bg-muted/30 px-3.5 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-reop-dark-blue">Need an idea?</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1.5"
                  onClick={fetchAiSuggestions}
                  disabled={suggestGift.isPending}
                >
                  {suggestGift.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Thinking…
                    </>
                  ) : aiSuggestions.length > 0 ? (
                    <>
                      <Wand2 className="w-3 h-3" />
                      Refresh
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3 h-3" />
                      Suggest 4 ideas
                    </>
                  )}
                </Button>
              </div>
              {aiError && (
                <p className="text-[11.5px] text-amber-700 mb-2">{aiError}</p>
              )}
              {aiSuggestions.length === 0 && !suggestGift.isPending && (
                <p className="text-[11.5px] text-muted-foreground leading-snug">
                  Personalized to their preferences{occasion ? ` and the ${occasion.toLowerCase()}` : ''}{amount ? ` around ${fmtCurrency(Number(amount))}` : ''}.
                </p>
              )}
              {aiSuggestions.length > 0 && (
                <div className="space-y-1.5">
                  {aiSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="w-full text-left rounded-md border border-border bg-card px-3 py-2 hover:border-primary hover:bg-reop-teal-soft transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <span className="text-[12.5px] font-semibold text-reop-dark-blue">{s.title}</span>
                        <span className="text-[11px] font-semibold text-primary flex-shrink-0">{s.price_band}</span>
                      </div>
                      <p className="text-[11.5px] text-foreground/80 leading-snug">{s.description}</p>
                      <p className="text-[10.5px] text-muted-foreground italic leading-snug mt-1">{s.reason}</p>
                    </button>
                  ))}
                  <p className="text-[10.5px] text-muted-foreground text-center pt-1">
                    Tap one to drop it into the description below.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold text-reop-dark-blue mb-1.5 block">What did you send?</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cedar cutting board, hand-delivered…"
              className="min-h-[88px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-reop-dark-blue mb-1.5 block">Amount (USD)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-reop-dark-blue mb-1.5 block">Send date</Label>
              <Input type="date" value={sendDate} onChange={(e) => setSendDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-reop-dark-blue mb-1.5 block">Occasion</Label>
            <Input
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              placeholder="Birthday, closing gift, pop-by, referral thank-you…"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-reop-dark-blue mb-1.5 block">Gift preferences (saved on contact)</Label>
            <Input
              value={giftPrefs}
              onChange={(e) => setGiftPrefs(e.target.value)}
              placeholder="Wine · sweets · dog person · no alcohol…"
            />
          </div>

          {sendGift.isError && (
            <div className="text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {sendGift.error instanceof Error ? sendGift.error.message : 'Could not log gift'}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-card flex gap-2.5 flex-shrink-0">
          <Button variant="outline" onClick={closeDrawer} disabled={sendGift.isPending} className="flex-1">
            Cancel
          </Button>
          <Button onClick={submit} disabled={sendGift.isPending || !selectedContactId} className="flex-1">
            {sendGift.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Logging…
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Log gift
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Bulk-capture sheet — fast keyboard editor for adding missing dates. */}
      <BulkCaptureSheet open={bulkCaptureOpen} onClose={() => setBulkCaptureOpen(false)} />
    </Layout>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3.5">
      <div className="text-[10.5px] uppercase tracking-[0.07em] font-bold text-muted-foreground mb-1.5">{label}</div>
      <div className="font-display text-[24px] font-medium tracking-tight text-reop-dark-blue leading-none">{value}</div>
      {sub && <div className="text-[11.5px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

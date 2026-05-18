/**
 * OpportunityDetailV2 — comprehensive real estate transaction panel
 * Tabs: Overview (next step + AI) | Transaction (property + financials + dates) | Contact | Activity
 */
import { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { CoachContactBlurb } from '@/components/commander/CoachContactBlurb';
import { useContactSheet } from '@/components/spheresync/ContactSheetProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StagePicker } from './StagePicker';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { TodayOpportunity } from '@/hooks/useToday';
import { Opportunity } from '@/hooks/usePipeline';
import { useOpportunityActivities } from '@/hooks/useOpportunityActivities';
import { QuickLogModal } from './QuickLogModal';
import { CompleteAndSetNextModal } from './CompleteAndSetNextModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  getEffectivePipelineType,
  getStageLabel, OPPORTUNITY_TYPE_LABELS, getStageAccent,
} from '@/config/pipelineStages';
import {
  ArrowRight, CheckCircle2, Zap, CalendarClock, MessageSquare,
  Phone, Mail, Users, FileText, DollarSign, Calendar, Home, Save, X,
  ExternalLink,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDue(d: string | null) {
  if (!d) return { label: 'No due date', cls: 'text-muted-foreground' };
  const dt = parseISO(d);
  if (isPast(dt) && !isToday(dt)) return { label: `Overdue · ${format(dt, 'MMM d')}`, cls: 'text-red-600 font-semibold' };
  if (isToday(dt)) return { label: 'Due today', cls: 'text-amber-600 font-semibold' };
  if (isTomorrow(dt)) return { label: 'Due tomorrow', cls: 'text-foreground' };
  return { label: format(dt, 'MMM d, yyyy'), cls: 'text-muted-foreground' };
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  called: <Phone className="h-3.5 w-3.5" />,
  texted: <MessageSquare className="h-3.5 w-3.5" />,
  text: <MessageSquare className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  emailed: <Mail className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  met: <Users className="h-3.5 w-3.5" />,
};

const CONFIDENCE_OPTS = [
  { value: 'low',    label: 'Low',    cls: 'border-red-300 text-red-700 bg-red-50' },
  { value: 'medium', label: 'Medium', cls: 'border-amber-300 text-amber-700 bg-amber-50' },
  { value: 'high',   label: 'High',   cls: 'border-green-300 text-green-700 bg-green-50' },
];

// ── Reusable field components ──────────────────────────────────────────────────

function FieldRow({
  label, value, onChange, type = 'text', placeholder, prefix,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; prefix?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn('h-8 text-sm', prefix && 'pl-6')}
        />
      </div>
    </div>
  );
}

function SelectRow({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value} className="text-sm">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// `StageSelectRow` was extracted to `./StagePicker.tsx` so EditOpportunityDialog
// and AddOpportunityDialog could reuse the same grouped-by-meta dropdown.

// ── Main component ─────────────────────────────────────────────────────────────

type Opp = TodayOpportunity | Opportunity;

interface Props {
  opportunity: Opp | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function OpportunityDetailV2({ opportunity, open, onClose, onRefresh }: Props) {
  const { toast } = useToast();
  const { timeline, refresh: refreshActivities } = useOpportunityActivities(opportunity?.id ?? null);
  // Cross-page bridge — opens the unified ContactQuickSheet (the same drawer
  // SphereSync + Database use) for the linked contact. Closes this drawer
  // first so the two sheets don't collide visually.
  const { openContact } = useContactSheet();
  const [logOpen, setLogOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable state, reset when opp changes. Phase 4.2: instead of tracking
  // a single `dealDirty` boolean and sending every field on save (including
  // server-managed columns like `is_stale`, `days_in_current_stage`, AI
  // fields), we track the SET of dirty field names. saveDeal then builds the
  // patch from only those keys — minimal payload, no risk of clobbering
  // server-computed state.
  const [deal, setDeal] = useState<Record<string, any>>({});
  const [dealDirtyFields, setDealDirtyFields] = useState<Set<string>>(new Set());
  const dealDirty = dealDirtyFields.size > 0;
  const [contactEdits, setContactEdits] = useState<Record<string, string>>({});
  const [contactDirty, setContactDirty] = useState(false);

  useEffect(() => {
    if (opportunity) {
      setDeal({ ...(opportunity as any) });
      setContactEdits({});
      setDealDirtyFields(new Set());
      setContactDirty(false);
    }
  }, [opportunity?.id]);

  if (!opportunity) return null;

  const opp = opportunity as any;
  const pipelineType = getEffectivePipelineType(opp);
  const accent = getStageAccent(opp.stage, pipelineType);

  const contactName: string =
    'contact_name' in opp && opp.contact_name
      ? opp.contact_name
      : opp.contact
        ? `${opp.contact.first_name ?? ''} ${opp.contact.last_name ?? ''}`.trim() || 'Unknown'
        : opp.title ?? 'Unknown';

  const due = formatDue(opp.next_step_due_date);

  const setDealField = (field: string, val: string) => {
    setDeal(prev => ({ ...prev, [field]: val === '' ? null : val }));
    setDealDirtyFields(prev => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  };

  const setContactField = (field: string, val: string) => {
    setContactEdits(prev => ({ ...prev, [field]: val }));
    setContactDirty(true);
  };

  const saveDeal = async () => {
    setSaving(true);
    try {
      // Phase 4.2: build the patch from only dirty fields. The previous impl
      // sent EVERY column on every save (minus a handful of joined/UI fields),
      // which:
      //   1) wasted the network payload
      //   2) clobbered server-managed columns (is_stale, stale_since,
      //      days_in_current_stage, ai_*, attention_state) with whatever
      //      stale value was loaded into local state on drawer open
      //   3) made concurrent edits dangerously last-write-wins
      // Now we only ship the columns the agent actually touched, plus the
      // updated_at bump. The blocklist below is a safety net — if a future
      // computed column accidentally gets bound to a form input, this still
      // prevents writing to it.
      const COMPUTED_OR_JOINED = new Set([
        'id', 'agent_id', 'created_at', 'updated_at',
        'contact', 'contact_name', 'attention_state',
        'is_stale', 'stale_since', 'days_in_current_stage', 'last_activity_date',
        'pipeline_type', // generated column on the table
        'ai_deal_probability', 'ai_summary', 'ai_suggested_next_action',
        'ai_risk_flags', 'ai_scored_at',
      ]);

      const patch: Record<string, any> = {};
      for (const field of dealDirtyFields) {
        if (COMPUTED_OR_JOINED.has(field)) continue;
        patch[field] = deal[field];
      }
      if (Object.keys(patch).length === 0) {
        toast({ title: 'Nothing to save' });
        setSaving(false);
        return;
      }
      patch.updated_at = new Date().toISOString();

      // Same RLS-deny detection pattern as updateStage in usePipeline.
      const { data: updated, error } = await supabase
        .from('opportunities')
        .update(patch)
        .eq('id', opp.id)
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error(
          'Update affected 0 rows — likely an RLS policy denial. Try reloading.',
        );
      }

      toast({ title: 'Saved' });
      setDealDirtyFields(new Set());
      onRefresh();
      // Fire-and-forget AI re-score so Coach reflects fresh deal state.
      supabase.functions
        .invoke('pipeline-score-opportunities', { body: { opportunity_id: opp.id } })
        .catch((err) => console.warn('[OpportunityDetailV2] re-score failed', err));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const saveContact = async () => {
    if (!opp.contact_id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ ...contactEdits, updated_at: new Date().toISOString() })
        .eq('id', opp.contact_id);
      if (error) throw error;
      toast({ title: 'Contact saved' });
      setContactDirty(false);
      onRefresh();
      // (System A `compute-priority-scores` re-score removed — UI no longer
      // reads the AI-blended score. SphereSync queue updates automatically
      // off the contacts row change.)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDone = () => { refreshActivities(); onRefresh(); };

  const d = deal;
  const c = { ...(opp.contact ?? {}), ...contactEdits } as any;

  return (
    <>
      <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <SheetContent
          className="w-full sm:max-w-lg p-0 flex flex-col overflow-hidden"
          side="right"
        >
          {/* Fixed header */}
          <div
            className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-border flex-shrink-0"
            style={{ borderLeftWidth: 3, borderLeftColor: accent, borderLeftStyle: 'solid' }}
          >
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold leading-tight">{contactName}</h2>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Badge variant="outline" className="text-xs h-5">
                  {OPPORTUNITY_TYPE_LABELS[opp.opportunity_type ?? ''] ?? opp.opportunity_type}
                </Badge>
                <Badge variant="outline" className="text-xs h-5">
                  {getStageLabel(opp.stage)}
                </Badge>
                {opp.ai_deal_probability != null && (
                  <Badge
                    variant="outline"
                    className={cn('text-xs h-5 gap-1 cursor-help',
                      opp.ai_deal_probability >= 70 ? 'text-green-700 border-green-300' :
                      opp.ai_deal_probability >= 40 ? 'text-amber-700 border-amber-300' :
                      'text-red-700 border-red-300'
                    )}
                    // Per Pipeline UX audit Should-fix #11: a probability
                    // number with no provenance reads as a fact. Showing the
                    // last-scored timestamp + a hedge phrase tells agents
                    // it's a model output, not a guarantee, and lets them
                    // judge freshness. Native title= avoids pulling in the
                    // Tooltip primitive for a one-off badge.
                    title={
                      opp.ai_scored_at
                        ? `AI-estimated likelihood of close · scored ${format(parseISO(opp.ai_scored_at), 'MMM d, h:mm a')}`
                        : 'AI-estimated likelihood of close'
                    }
                  >
                    <Zap className="h-2.5 w-2.5" />{opp.ai_deal_probability}%
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 -mt-1" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 pt-3 flex-shrink-0">
              <TabsList className="h-8 w-full grid grid-cols-4 bg-muted/60">
                <TabsTrigger value="overview"     className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="transaction"  className="text-xs">Transaction</TabsTrigger>
                <TabsTrigger value="contact"      className="text-xs">Contact</TabsTrigger>
                <TabsTrigger value="activity"     className="text-xs">Activity</TabsTrigger>
              </TabsList>
            </div>

            {/* ── Overview ── */}
            <TabsContent value="overview" className="flex-1 overflow-y-auto px-5 pt-4 pb-8 space-y-4 mt-0">

              {/* Phase E — Coach's take on this specific opportunity/contact.
                  Silently suppresses when the Coach has nothing to say. */}
              <CoachContactBlurb
                contactId={opp.contact_id}
                opportunityId={opp.id}
              />

              {/* Next step */}
              <div className={cn('rounded-xl border p-4',
                opp.next_step_title ? 'border-border' : 'bg-orange-50/60 border-orange-200'
              )}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Next Step
                  </span>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setLogOpen(true)}>
                      <MessageSquare className="h-3.5 w-3.5" />Log
                    </Button>
                    <Button size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={() => setCompleteOpen(true)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {opp.next_step_title ? 'Complete' : 'Set step'}
                    </Button>
                  </div>
                </div>
                {opp.next_step_title ? (
                  <>
                    <p className="text-sm font-medium">{opp.next_step_title}</p>
                    <p className={cn('text-xs mt-1 flex items-center gap-1', due.cls)}>
                      <CalendarClock className="h-3 w-3" />{due.label}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-orange-700 font-medium">
                    No next step — set one to stay on track.
                  </p>
                )}
              </div>

              {/* Confidence */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  My Confidence
                </p>
                <div className="flex gap-2">
                  {CONFIDENCE_OPTS.map(opt => {
                    // Read from local `deal` state (which shadows `opp` after
                    // the useEffect on line 140-147) so an optimistic flip is
                    // visible before the parent refresh round-trips. Per
                    // Pipeline UX audit Should-fix #9: clicking a confidence
                    // chip used to fire silently with no toast and no UI
                    // feedback until refresh — agents would click and not
                    // know if it worked.
                    const currentConfidence = (d.confidence ?? opp.confidence ?? 'medium');
                    return (
                      <button
                        key={opt.value}
                        onClick={async () => {
                          // Optimistic flip — local state updates immediately.
                          setDeal(prev => ({ ...prev, confidence: opt.value }));
                          try {
                            const { error } = await supabase.from('opportunities')
                              .update({ confidence: opt.value, updated_at: new Date().toISOString() })
                              .eq('id', opp.id);
                            if (error) throw error;
                            toast({ title: `Confidence set to ${opt.label.toLowerCase()}` });
                            onRefresh();
                          } catch (e: any) {
                            // Revert on failure so the UI doesn't lie.
                            setDeal(prev => ({ ...prev, confidence: opp.confidence ?? null }));
                            toast({ title: 'Error', description: e.message, variant: 'destructive' });
                          }
                        }}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                          currentConfidence === opt.value
                            ? opt.cls
                            : 'text-muted-foreground border-border hover:border-foreground/20'
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AI intel */}
              {(opp.ai_summary || opp.ai_suggested_next_action || opp.ai_risk_flags?.length > 0) && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Zap className="h-3.5 w-3.5 text-violet-600" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Intel</p>
                    </div>
                    {opp.ai_summary && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">{opp.ai_summary}</p>
                    )}
                    {opp.ai_suggested_next_action && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-violet-50 border border-violet-100 mb-2">
                        <ArrowRight className="h-3.5 w-3.5 text-violet-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-violet-800">{opp.ai_suggested_next_action}</p>
                      </div>
                    )}
                    {opp.ai_risk_flags?.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {opp.ai_risk_flags.map((flag: string) => (
                          <span key={flag} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 capitalize">
                            {flag.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Notes */}
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Notes</Label>
                <Textarea
                  value={d.notes ?? ''}
                  onChange={e => setDealField('notes', e.target.value)}
                  placeholder="Add notes about this opportunity…"
                  className="text-sm resize-none h-24"
                />
                {dealDirty && (
                  <Button size="sm" className="mt-2 h-7 text-xs gap-1" onClick={saveDeal} disabled={saving}>
                    <Save className="h-3.5 w-3.5" />{saving ? 'Saving…' : 'Save'}
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* ── Transaction ── */}
            <TabsContent value="transaction" className="flex-1 overflow-y-auto px-5 pt-4 pb-24 space-y-5 mt-0">

              {/* Stage + type. The Stage picker groups sub-stages under
                  their board-visible meta-stage labels (Leads / Working /
                  Under contract / Closed) so the dropdown vocabulary matches
                  the column vocabulary. */}
              <div className="grid grid-cols-2 gap-3">
                <StagePicker
                  value={d.stage ?? ''}
                  onChange={v => setDealField('stage', v)}
                  pipelineType={pipelineType}
                />
                <SelectRow
                  label="Type"
                  value={d.opportunity_type ?? ''}
                  onChange={v => setDealField('opportunity_type', v)}
                  options={Object.entries(OPPORTUNITY_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                />
              </div>

              {/* Financial */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />Financial
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Estimated Value" value={String(d.deal_value ?? '')}     onChange={v => setDealField('deal_value', v)}     type="number" prefix="$" />
                  <FieldRow label="List Price"     value={String(d.list_price ?? '')}     onChange={v => setDealField('list_price', v)}     type="number" prefix="$" />
                  <FieldRow label="Offer Price"    value={String(d.offer_price ?? '')}    onChange={v => setDealField('offer_price', v)}    type="number" prefix="$" />
                  <FieldRow label="Sale Price"     value={String(d.sale_price ?? '')}     onChange={v => setDealField('sale_price', v)}     type="number" prefix="$" />
                  <FieldRow label="Commission %"   value={String(d.commission_pct ?? '')} onChange={v => setDealField('commission_pct', v)} type="number" placeholder="e.g. 2.5" />
                  <FieldRow label="GCI Estimated"  value={String(d.gci_estimated ?? '')}  onChange={v => setDealField('gci_estimated', v)}  type="number" prefix="$" />
                </div>
              </div>

              <Separator />

              {/* Property */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Home className="h-3.5 w-3.5" />Property
                </p>
                <div className="space-y-3">
                  <FieldRow label="Address" value={d.property_address ?? ''} onChange={v => setDealField('property_address', v)} placeholder="123 Main St" />
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="City"  value={d.property_city ?? ''}  onChange={v => setDealField('property_city', v)} />
                    <FieldRow label="State" value={d.property_state ?? ''} onChange={v => setDealField('property_state', v)} placeholder="CA" />
                    <FieldRow label="ZIP"   value={d.property_zip ?? ''}   onChange={v => setDealField('property_zip', v)} />
                    <SelectRow
                      label="Property Type"
                      value={d.property_type ?? ''}
                      onChange={v => setDealField('property_type', v)}
                      options={[
                        { value: 'single_family', label: 'Single Family' },
                        { value: 'condo',         label: 'Condo / Townhome' },
                        { value: 'multi_family',  label: 'Multi-Family' },
                        { value: 'land',          label: 'Land' },
                        { value: 'commercial',    label: 'Commercial' },
                        { value: 'other',         label: 'Other' },
                      ]}
                    />
                    <FieldRow label="Beds"       value={String(d.property_beds ?? '')}       onChange={v => setDealField('property_beds', v)}       type="number" />
                    <FieldRow label="Baths"      value={String(d.property_baths ?? '')}      onChange={v => setDealField('property_baths', v)}      type="number" />
                    <FieldRow label="Sq Ft"      value={String(d.property_sqft ?? '')}       onChange={v => setDealField('property_sqft', v)}       type="number" />
                    <FieldRow label="Year Built" value={String(d.property_year_built ?? '')} onChange={v => setDealField('property_year_built', v)} type="number" placeholder="2005" />
                    <FieldRow label="MLS #"      value={d.property_mls_number ?? ''}         onChange={v => setDealField('property_mls_number', v)} />
                  </div>
                  <FieldRow label="Listing URL" value={d.property_url ?? ''} onChange={v => setDealField('property_url', v)} placeholder="https://…" />
                </div>
              </div>

              <Separator />

              {/* Key dates */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />Key Dates
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Expected Close"    value={d.expected_close_date ?? ''}     onChange={v => setDealField('expected_close_date', v)}     type="date" />
                  <FieldRow label="Contract Date"     value={d.contract_date ?? ''}           onChange={v => setDealField('contract_date', v)}           type="date" />
                  <FieldRow label="Offer Date"        value={d.offer_date ?? ''}              onChange={v => setDealField('offer_date', v)}              type="date" />
                  <FieldRow label="Inspection"        value={d.inspection_date ?? ''}         onChange={v => setDealField('inspection_date', v)}         type="date" />
                  <FieldRow label="Appraisal"         value={d.appraisal_date ?? ''}          onChange={v => setDealField('appraisal_date', v)}          type="date" />
                  <FieldRow label="Loan Contingency"  value={d.loan_contingency_removal ?? ''} onChange={v => setDealField('loan_contingency_removal', v)} type="date" />
                  <FieldRow label="Closing Scheduled" value={d.closing_date_scheduled ?? ''} onChange={v => setDealField('closing_date_scheduled', v)} type="date" />
                  <FieldRow label="Target Move Date"  value={d.target_move_date ?? ''}        onChange={v => setDealField('target_move_date', v)}        type="date" />
                </div>
              </div>

              {/* Sticky save */}
              {dealDirty && (
                <div className="sticky bottom-0 bg-background pt-2 pb-1">
                  <Button className="w-full h-9 text-sm gap-1.5" onClick={saveDeal} disabled={saving}>
                    <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ── Contact ── */}
            <TabsContent value="contact" className="flex-1 overflow-y-auto px-5 pt-4 pb-24 space-y-5 mt-0">

              {/* Cross-page bridge to the unified ContactQuickSheet so the
                  agent can see this person's full Database row — tags,
                  notes, family/life-events, full activity history — without
                  navigating away from the pipeline. */}
              {opp.contact_id && (
                <div className="flex items-center justify-between gap-2 -mt-1 mb-1">
                  <p className="text-xs text-muted-foreground leading-snug">
                    Editing contact fields below saves to this person's Database record.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-primary hover:text-primary"
                    onClick={() => {
                      const contactId = opp.contact_id;
                      onClose();
                      // Defer so the opportunity drawer's close animation
                      // doesn't fight the contact drawer's open.
                      setTimeout(() => openContact(contactId), 200);
                    }}
                  >
                    Open full contact view
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="First Name" value={c.first_name ?? ''} onChange={v => setContactField('first_name', v)} />
                <FieldRow label="Last Name"  value={c.last_name ?? ''}  onChange={v => setContactField('last_name', v)} />
                <FieldRow label="Phone"      value={c.phone ?? ''}      onChange={v => setContactField('phone', v)}      type="tel" />
                <FieldRow label="Email"      value={c.email ?? ''}      onChange={v => setContactField('email', v)}      type="email" />
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Buyer Profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectRow
                    label="Pre-Approval"
                    value={c.buyer_pre_approval_status ?? ''}
                    onChange={v => setContactField('buyer_pre_approval_status', v)}
                    options={[
                      { value: 'not_started',    label: 'Not Started' },
                      { value: 'in_progress',    label: 'In Progress' },
                      { value: 'pre_approved',   label: 'Pre-Approved' },
                      { value: 'fully_approved', label: 'Fully Approved' },
                      { value: 'cash_buyer',     label: 'Cash Buyer' },
                    ]}
                  />
                  <FieldRow label="Lender"     value={c.buyer_lender_name ?? ''} onChange={v => setContactField('buyer_lender_name', v)} />
                  <FieldRow label="Min Budget" value={String(c.buyer_price_min ?? '')} onChange={v => setContactField('buyer_price_min', v)} type="number" prefix="$" />
                  <FieldRow label="Max Budget" value={String(c.buyer_price_max ?? '')} onChange={v => setContactField('buyer_price_max', v)} type="number" prefix="$" />
                  <SelectRow
                    label="Loan Type"
                    value={c.buyer_loan_type ?? ''}
                    onChange={v => setContactField('buyer_loan_type', v)}
                    options={[
                      { value: 'conventional', label: 'Conventional' },
                      { value: 'fha',          label: 'FHA' },
                      { value: 'va',           label: 'VA' },
                      { value: 'usda',         label: 'USDA' },
                      { value: 'jumbo',        label: 'Jumbo' },
                      { value: 'cash',         label: 'Cash' },
                      { value: 'other',        label: 'Other' },
                    ]}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Seller Profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectRow
                    label="Listing Timeline"
                    value={c.seller_listing_timeline ?? ''}
                    onChange={v => setContactField('seller_listing_timeline', v)}
                    options={[
                      { value: 'immediate',     label: 'Immediately' },
                      { value: '1_3_months',    label: '1–3 months' },
                      { value: '3_6_months',    label: '3–6 months' },
                      { value: '6_12_months',   label: '6–12 months' },
                      { value: '12_plus_months',label: '12+ months' },
                      { value: 'unknown',       label: 'Unknown' },
                    ]}
                  />
                  <FieldRow label="Est. Home Value" value={String(c.seller_estimated_value ?? '')} onChange={v => setContactField('seller_estimated_value', v)} type="number" prefix="$" />
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">General</p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectRow
                    label="Move Timeline"
                    value={c.move_timeline ?? ''}
                    onChange={v => setContactField('move_timeline', v)}
                    options={[
                      { value: 'asap',          label: 'ASAP' },
                      { value: '1_3_months',    label: '1–3 months' },
                      { value: '3_6_months',    label: '3–6 months' },
                      { value: '6_12_months',   label: '6–12 months' },
                      { value: '12_plus_months',label: '12+ months' },
                      { value: 'just_looking',  label: 'Just Looking' },
                    ]}
                  />
                  <SelectRow
                    label="Relationship"
                    value={String(c.relationship_strength ?? '')}
                    onChange={v => setContactField('relationship_strength', v)}
                    options={[1,2,3,4,5].map(n => ({ value: String(n), label: `${n} ${'★'.repeat(n)}` }))}
                  />
                  <SelectRow
                    label="Motivation (1–10)"
                    value={String(c.motivation_score ?? '')}
                    onChange={v => setContactField('motivation_score', v)}
                    options={[1,2,3,4,5,6,7,8,9,10].map(n => ({ value: String(n), label: String(n) }))}
                  />
                </div>
              </div>

              {contactDirty && (
                <div className="sticky bottom-0 bg-background pt-2 pb-1">
                  <Button className="w-full h-9 text-sm gap-1.5" onClick={saveContact} disabled={saving}>
                    <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save Contact'}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ── Activity ── */}
            <TabsContent value="activity" className="flex-1 overflow-y-auto px-5 pt-4 pb-8 mt-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity</p>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setLogOpen(true)}>
                  <MessageSquare className="h-3.5 w-3.5" />Log
                </Button>
              </div>

              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No activity yet</p>
              ) : (
                <div className="space-y-1">
                  {/* Unified timeline — opportunity activities + contact-scoped
                      activities (calls/texts logged from SphereSync, Database,
                      ContactQuickSheet) merged by date. Cross-posted duplicates
                      are deduped in the hook. Rows from the contact-only side
                      get a small "Contact" chip so the agent can tell them
                      apart from opportunity-direct entries. */}
                  {timeline.map(act => (
                    <div key={`${act.source}-${act.id}`} className="flex gap-3 pb-3 border-b border-border/40 last:border-0">
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                        {ACTIVITY_ICONS[act.activity_type] ?? <FileText className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-medium capitalize">
                            {act.activity_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(act.activity_date), 'MMM d · h:mm a')}
                          </span>
                          {act.source === 'contact' && (
                            <span
                              className="text-[9px] uppercase tracking-wide font-semibold px-1 py-0.5 rounded bg-muted text-muted-foreground"
                              title="Logged at the contact level (e.g. from SphereSync or Database), not against this opportunity."
                            >
                              Contact
                            </span>
                          )}
                        </div>
                        {act.title && <p className="text-xs text-muted-foreground mt-0.5">{act.title}</p>}
                        {act.note && <p className="text-xs text-muted-foreground mt-0.5">{act.note}</p>}
                        {act.outcome && (
                          <span className="text-xs bg-muted rounded px-1.5 py-0.5 mt-1 inline-block capitalize">
                            {act.outcome.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <QuickLogModal
        opportunity={opp}
        open={logOpen}
        onOpenChange={setLogOpen}
        onLogged={handleDone}
      />
      <CompleteAndSetNextModal
        opportunity={opp}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        onCompleted={handleDone}
      />
    </>
  );
}

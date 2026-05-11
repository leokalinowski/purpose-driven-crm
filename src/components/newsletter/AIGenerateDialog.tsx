/**
 * AIGenerateDialog — Grok-powered draft generator.
 *
 * v3 (area-aware): now opens with three pre-questions so each monthly
 * newsletter is genuinely different:
 *   1. Area — top ZIPs / a specific city / a specific state. City + state
 *      lookups aggregate market_stats across all the agent's contact-ZIPs in
 *      that area, so the email talks about "Alexandria, VA" instead of
 *      reciting ZIP codes the reader doesn't recognize.
 *   2. Audience — buyers / sellers / both / past clients. Reframes which
 *      numbers lead the body and what voice to use.
 *   3. Goal — schedule a call / reply / visit site / top-of-mind. Drives
 *      the CTA shape.
 *
 * The original Direction (Market/Seasonal/Educational/Custom) and Voice/
 * Length pickers remain below so the agent can refine.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, Loader2, TrendingUp, Calendar, GraduationCap, Wand2,
  ChevronDown, Info, X, MapPin, Globe, Users, Phone, MessageSquare, Eye, Sun,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAgentAreas } from '@/hooks/useAgentAreas';
import { cn } from '@/lib/utils';

interface AIGenerateDialogProps {
  open: boolean;
  onClose: () => void;
}

// ── Types ───────────────────────────────────────────────────────────────

type AreaScope = 'top_zips' | 'city' | 'state';
type Audience = 'buyers' | 'sellers' | 'both' | 'past_clients';
type Goal = 'schedule_call' | 'reply' | 'visit_site' | 'top_of_mind';
type PresetKey = 'market' | 'seasonal' | 'educational' | 'custom';
type Tone = 'warm' | 'professional' | 'casual' | 'authoritative';
type Length = 'short' | 'medium' | 'long';

// ── Static option metadata ──────────────────────────────────────────────

const getSeason = (): string => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
};

interface PresetMeta {
  key: PresetKey;
  label: string;
  Icon: typeof TrendingUp;
  oneLiner: string;
  defaultPrompt: () => string;
}

const PRESETS: PresetMeta[] = [
  {
    key: 'market',
    label: 'Market update',
    Icon: TrendingUp,
    oneLiner: 'Median prices, inventory, days on market — what it means.',
    defaultPrompt: () =>
      'Write a newsletter featuring current real estate market data and trends. Include median home prices, inventory levels, days on market, and what this means for buyers and sellers right now.',
  },
  {
    key: 'seasonal',
    label: 'Seasonal',
    Icon: Calendar,
    oneLiner: `${getSeason()} ${new Date().getFullYear()} buying/selling rhythm.`,
    defaultPrompt: () =>
      `Write a newsletter about the ${getSeason()} ${new Date().getFullYear()} real estate market. Cover seasonal buying/selling trends, what homeowners should be doing this time of year, and market outlook for the coming months.`,
  },
  {
    key: 'educational',
    label: 'Educational',
    Icon: GraduationCap,
    oneLiner: 'Process explainers, maintenance tips, ownership advice.',
    defaultPrompt: () =>
      'Write an educational newsletter about the real estate process. Cover topics like home maintenance tips, understanding title insurance, how the transaction process works from offer to closing, or general homeownership advice that provides value to your database.',
  },
  {
    key: 'custom',
    label: 'Custom',
    Icon: Wand2,
    oneLiner: 'Write your own direction. The AI handles structure + voice.',
    defaultPrompt: () => '',
  },
];

interface AreaScopeMeta {
  key: AreaScope;
  label: string;
  Icon: typeof MapPin;
  oneLiner: string;
}

const AREA_SCOPES: AreaScopeMeta[] = [
  {
    key: 'top_zips',
    label: 'My top ZIPs',
    Icon: MapPin,
    oneLiner: 'Whichever ZIPs hold the most of my sphere.',
  },
  {
    key: 'city',
    label: 'A specific city',
    Icon: MapPin,
    oneLiner: 'Aggregate across all your ZIPs in that city.',
  },
  {
    key: 'state',
    label: 'A specific state',
    Icon: Globe,
    oneLiner: 'Aggregate across every ZIP you have in that state.',
  },
];

interface AudienceMeta {
  key: Audience;
  label: string;
  Icon: typeof Users;
  sub: string;
}

const AUDIENCES: AudienceMeta[] = [
  { key: 'buyers',       label: 'Buyers',        Icon: Users, sub: 'Inventory, new listings, what their budget can do.' },
  { key: 'sellers',      label: 'Sellers',       Icon: Users, sub: 'Sale prices, days on market, valuation conversation.' },
  { key: 'both',         label: 'Both',          Icon: Users, sub: 'Balanced — one fact for each side.' },
  { key: 'past_clients', label: 'Past clients',  Icon: Users, sub: 'Equity check-in, no pitch, easy to reply.' },
];

interface GoalMeta {
  key: Goal;
  label: string;
  Icon: typeof Phone;
  sub: string;
}

const GOALS: GoalMeta[] = [
  { key: 'schedule_call', label: 'Schedule a call',   Icon: Phone,         sub: 'CTA → "Book a 15-min market call".' },
  { key: 'reply',         label: 'Get a reply',       Icon: MessageSquare, sub: 'Ends with a question; "hit reply".' },
  { key: 'visit_site',    label: 'Visit my site',     Icon: Eye,           sub: 'CTA → "See current listings".' },
  { key: 'top_of_mind',   label: 'Stay top of mind',  Icon: Sun,           sub: 'No hard ask — friendly check-in.' },
];

const TONE_META: { key: Tone; label: string; sub: string }[] = [
  { key: 'warm',          label: 'Warm',           sub: 'Personal, conversational' },
  { key: 'professional',  label: 'Professional',   sub: 'Polished, knowledgeable' },
  { key: 'casual',        label: 'Casual',         sub: 'Loose, chatty' },
  { key: 'authoritative', label: 'Authoritative',  sub: 'Data-driven expert' },
];

const LENGTH_META: { key: Length; label: string; sub: string }[] = [
  { key: 'short',  label: 'Short',  sub: '3–4 blocks' },
  { key: 'medium', label: 'Medium', sub: '5–6 blocks' },
  { key: 'long',   label: 'Long',   sub: '7–9 blocks' },
];

// ── Component ───────────────────────────────────────────────────────────

interface BrandSummary {
  brandColor: string | null;
  toneGuidelines: string | null;
  targetAudience: string | null;
  contactCount: number | null;
}

export function AIGenerateDialog({ open, onClose }: AIGenerateDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Pre-questions
  const [areaScope, setAreaScope] = useState<AreaScope>('top_zips');
  const [areaCityKey, setAreaCityKey] = useState<string>('');  // value passed to backend (cityNorm)
  const [areaStateValue, setAreaStateValue] = useState<string>('');
  const [audience, setAudience] = useState<Audience>('both');
  const [goal, setGoal] = useState<Goal>('top_of_mind');

  // Direction + refinements
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('market');
  const [customPrompt, setCustomPrompt] = useState('');
  const [presetPrompts, setPresetPrompts] = useState<Record<Exclude<PresetKey, 'custom'>, string>>(() => ({
    market: PRESETS[0].defaultPrompt(),
    seasonal: PRESETS[1].defaultPrompt(),
    educational: PRESETS[2].defaultPrompt(),
  }));
  const [tone, setTone] = useState<Tone>('warm');
  const [length, setLength] = useState<Length>('medium');

  const [showBrandPanel, setShowBrandPanel] = useState(false);
  const [brand, setBrand] = useState<BrandSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Pull cities + states for the agent for the picker.
  const { cities, states, loading: areasLoading } = useAgentAreas(user?.id, open);

  // Selected city object (for display + state lookup).
  const selectedCity = useMemo(
    () => cities.find((c) => `${c.cityNorm}|${c.state}` === areaCityKey),
    [cities, areaCityKey],
  );

  // Pull a small "what the AI will know about you" summary on open.
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [marketingRes, contactRes] = await Promise.all([
          supabase
            .from('agent_marketing_settings')
            .select('primary_color, tone_guidelines, target_audience')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .not('email', 'is', null)
            .neq('email', ''),
        ]);
        if (cancelled) return;
        setBrand({
          brandColor: marketingRes.data?.primary_color ?? null,
          toneGuidelines: marketingRes.data?.tone_guidelines ?? null,
          targetAudience: marketingRes.data?.target_audience ?? null,
          contactCount: contactRes.count ?? null,
        });
      } catch {
        // Brand summary is non-critical.
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  const reset = () => {
    setAreaScope('top_zips');
    setAreaCityKey('');
    setAreaStateValue('');
    setAudience('both');
    setGoal('top_of_mind');
    setSelectedPreset('market');
    setCustomPrompt('');
    setTone('warm');
    setLength('medium');
    setShowBrandPanel(false);
  };

  const handleClose = () => {
    if (isGenerating) return;
    reset();
    onClose();
  };

  // Validation: if scope=city or state, the user must have picked a value.
  const areaValid = (() => {
    if (areaScope === 'top_zips') return true;
    if (areaScope === 'city') return !!selectedCity;
    if (areaScope === 'state') return !!areaStateValue;
    return false;
  })();

  const handleGenerate = async () => {
    if (!user) return;
    if (!areaValid) {
      toast({
        title: 'Pick an area',
        description: areaScope === 'city'
          ? 'Choose a city from the dropdown — or switch to "My top ZIPs".'
          : 'Choose a state from the dropdown — or switch to "My top ZIPs".',
        variant: 'destructive',
      });
      return;
    }

    const isCustom = selectedPreset === 'custom';
    const promptText = isCustom ? customPrompt.trim() : presetPrompts[selectedPreset];
    if (isCustom && !promptText) {
      toast({
        title: 'Custom prompt required',
        description: 'Add a few sentences telling the AI what you want this newsletter to be about.',
        variant: 'destructive',
      });
      return;
    }

    // Build the area param.
    const area =
      areaScope === 'city' && selectedCity
        ? { scope: 'city' as const, value: selectedCity.cityNorm }
        : areaScope === 'state' && areaStateValue
          ? { scope: 'state' as const, value: areaStateValue }
          : { scope: 'top_zips' as const };

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-newsletter', {
        body: {
          agent_id: user.id,
          topic_hint: isCustom ? undefined : promptText,
          custom_prompt: isCustom ? promptText : undefined,
          tone,
          length,
          area,
          audience,
          goal,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const areaLabel = data.area_label || (areaScope === 'top_zips' ? 'your top ZIPs' : '');
      const dataNote = data.market_data_used
        ? `${data.is_area_aggregate ? `aggregated across ${data.market_data_zips?.length ?? '?'} ZIPs in ${areaLabel}` : `for ${data.market_data_zips?.length ?? '?'} ZIPs`}`
        : 'no verified data — written qualitatively';

      toast({
        title: 'Draft ready',
        description: `${data.block_count} blocks · ${dataNote}. Opens in the builder for review.`,
      });
      reset();
      onClose();
      navigate(`/newsletter-builder/${data.template_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      toast({ title: 'Generation failed', description: message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-reop-teal-soft text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            Compose with AI
          </DialogTitle>
          <DialogDescription>
            Three quick questions, then we draft a personalized newsletter you can review before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ── 1. AREA ─────────────────────────────────────────────────── */}
          <Section
            number="1"
            title="What area do you want to talk about?"
            hint="Different area each month keeps your sphere from hearing the same ZIP codes over and over."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {AREA_SCOPES.map(({ key, label, Icon, oneLiner }) => {
                const active = areaScope === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAreaScope(key)}
                    className={cn(
                      'text-left p-3 rounded-lg border transition flex items-start gap-2.5',
                      active
                        ? 'border-primary bg-reop-teal-soft'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                      active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                    )}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm font-semibold leading-tight', active && 'text-primary')}>{label}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{oneLiner}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {areaScope === 'city' && (
              <div className="mt-2.5">
                <Select value={areaCityKey} onValueChange={setAreaCityKey} disabled={areasLoading}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={areasLoading ? 'Loading cities…' : cities.length === 0 ? 'No cities found in your contacts' : 'Pick a city…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => (
                      <SelectItem key={`${c.cityNorm}|${c.state}`} value={`${c.cityNorm}|${c.state}`}>
                        <span className="font-medium">{c.city}{c.state ? `, ${c.state}` : ''}</span>
                        <span className="text-muted-foreground ml-2 text-[11px]">{c.contactCount} contact{c.contactCount === 1 ? '' : 's'}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!areasLoading && cities.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    No cities in your contacts yet. Add city info to your contacts (Database → Edit) or pick "My top ZIPs" instead.
                  </p>
                )}
              </div>
            )}

            {areaScope === 'state' && (
              <div className="mt-2.5">
                <Select value={areaStateValue} onValueChange={setAreaStateValue} disabled={areasLoading}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={areasLoading ? 'Loading states…' : states.length === 0 ? 'No states found in your contacts' : 'Pick a state…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((s) => (
                      <SelectItem key={s.state} value={s.state}>
                        <span className="font-medium">{s.state}</span>
                        <span className="text-muted-foreground ml-2 text-[11px]">{s.contactCount} contact{s.contactCount === 1 ? '' : 's'}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </Section>

          {/* ── 2. AUDIENCE ─────────────────────────────────────────────── */}
          <Section
            number="2"
            title="Who's this newsletter for?"
            hint="Reframes the body voice and which numbers lead."
          >
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCES.map(({ key, label, sub, Icon }) => (
                <CardChoice
                  key={key}
                  active={audience === key}
                  onClick={() => setAudience(key)}
                  label={label}
                  sub={sub}
                  Icon={Icon}
                />
              ))}
            </div>
          </Section>

          {/* ── 3. GOAL ─────────────────────────────────────────────────── */}
          <Section
            number="3"
            title="What do you want them to do?"
            hint="Drives the call-to-action."
          >
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(({ key, label, sub, Icon }) => (
                <CardChoice
                  key={key}
                  active={goal === key}
                  onClick={() => setGoal(key)}
                  label={label}
                  sub={sub}
                  Icon={Icon}
                />
              ))}
            </div>
          </Section>

          {/* ── Refinements (collapsed-feel section) ────────────────────── */}
          <div className="border-t border-border pt-4 space-y-4">
            <div>
              <Label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2 block">
                Topic angle <span className="font-normal lowercase tracking-normal text-muted-foreground/80">(optional refinement)</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map(({ key, label, Icon }) => {
                  const active = selectedPreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedPreset(key)}
                      className={cn(
                        'text-left p-2 rounded-md border transition flex items-center gap-1.5',
                        active
                          ? 'border-primary bg-reop-teal-soft'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                      )}
                    >
                      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                      <span className={cn('text-xs font-semibold', active && 'text-primary')}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPreset === 'custom' ? (
              <div>
                <Label htmlFor="ai-custom" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5 block">
                  Your prompt
                </Label>
                <Textarea
                  id="ai-custom"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={isGenerating}
                  placeholder="e.g. Write about new construction inventory in my area — focus on the trade-off between new builds vs. resale at this price point."
                  rows={3}
                  className="text-sm"
                />
              </div>
            ) : (
              <div>
                <Label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5 block">
                  Topic prompt (edit to refine)
                </Label>
                <Textarea
                  value={presetPrompts[selectedPreset]}
                  onChange={(e) =>
                    setPresetPrompts((prev) => ({
                      ...prev,
                      [selectedPreset]: e.target.value,
                    }))
                  }
                  disabled={isGenerating}
                  rows={3}
                  className="text-sm"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5 block">
                  Voice
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TONE_META.map((t) => (
                    <PillRadio
                      key={t.key}
                      active={tone === t.key}
                      onClick={() => setTone(t.key)}
                      label={t.label}
                      sub={t.sub}
                      disabled={isGenerating}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5 block">
                  Length
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {LENGTH_META.map((l) => (
                    <PillRadio
                      key={l.key}
                      active={length === l.key}
                      onClick={() => setLength(l.key)}
                      label={l.label}
                      sub={l.sub}
                      disabled={isGenerating}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* What the AI knows about you (background context) */}
          <button
            type="button"
            onClick={() => setShowBrandPanel((v) => !v)}
            className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition"
            aria-expanded={showBrandPanel}
          >
            <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold mb-0.5">What the AI already knows about you</div>
              <p className="text-[11.5px] text-muted-foreground leading-snug">
                Brand color, tone guidelines, contact data — pulled automatically. You don't need to repeat them.
              </p>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition flex-shrink-0', showBrandPanel && 'rotate-180')} />
          </button>
          {showBrandPanel && brand && (
            <div className="grid grid-cols-2 gap-3 -mt-2 px-1">
              <BrandRow label="Brand color" value={brand.brandColor ? <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: brand.brandColor }} />{brand.brandColor}</span> : 'Not set'} />
              <BrandRow label="Recipients" value={brand.contactCount != null ? `${brand.contactCount.toLocaleString()} contacts with email` : '—'} />
              <BrandRow label="Tone guidelines" value={brand.toneGuidelines ?? <span className="text-muted-foreground italic">Not set — AI uses chosen Voice above</span>} multi />
              <BrandRow label="Target audience" value={brand.targetAudience ?? <span className="text-muted-foreground italic">Default: local sphere</span>} multi />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
            <X className="w-3.5 h-3.5 mr-1.5" />
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !areaValid} className="gap-1.5">
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Drafting…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate draft
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Section({
  number, title, hint, children,
}: { number: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[11px] font-bold text-primary bg-reop-teal-soft rounded px-1.5 py-0.5 leading-none">
          {number}
        </span>
        <Label className="text-sm font-semibold text-foreground">{title}</Label>
      </div>
      {hint && <p className="text-[11.5px] text-muted-foreground leading-snug mb-2.5 -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

function CardChoice({
  active, onClick, label, sub, Icon,
}: { active: boolean; onClick: () => void; label: string; sub: string; Icon: typeof Phone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'text-left p-3 rounded-lg border transition flex items-start gap-2.5',
        active
          ? 'border-primary bg-reop-teal-soft'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
      )}
    >
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
        active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
      )}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-semibold leading-tight', active && 'text-primary')}>{label}</div>
        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{sub}</div>
      </div>
    </button>
  );
}

function BrandRow({ label, value, multi }: { label: string; value: React.ReactNode; multi?: boolean }) {
  return (
    <div className={cn('text-[11.5px]', multi && 'col-span-2')}>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">{label}</div>
      <div className="text-foreground leading-snug">{value}</div>
    </div>
  );
}

function PillRadio({
  active, onClick, label, sub, disabled,
}: { active: boolean; onClick: () => void; label: string; sub: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'text-left p-2 rounded-md border transition',
        active
          ? 'border-primary bg-reop-teal-soft'
          : 'border-border bg-card hover:bg-muted/30',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <div className={cn('text-xs font-semibold', active && 'text-primary')}>{label}</div>
      <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">{sub}</div>
    </button>
  );
}

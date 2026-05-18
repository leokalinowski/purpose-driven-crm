import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Phone, MessageSquare, Mail, Sparkles, Clock, ExternalLink, Pencil, ClipboardList,
  MapPin, Home, User, Heart, Tag as TagIcon, Star, Activity, FileText, Briefcase,
  Calendar as CalendarIcon, AlertTriangle, Compass, Users, Cake, Gift, Link as LinkIcon,
  Instagram, Linkedin, Facebook, TrendingUp, TrendingDown, Minus, Moon, Pin, Trash2,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { useContactActivities, type ContactActivity } from '@/hooks/useContactActivities';
import { useUpdateContact } from '@/hooks/useUpdateContact';
import type { SphereSyncTask } from '@/hooks/useSphereSyncTasks';
import { useAuth } from '@/hooks/useAuth';
import { useConversationStarter } from '@/components/comm/ConversationStarterProvider';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ContactQuickSheetProps {
  contactId: string | null;
  task?: SphereSyncTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditContact?: (contactId: string) => void;
  onLogActivity?: (contactId: string, task?: SphereSyncTask | null) => void;
}

interface ContactRecord {
  id: string;
  agent_id: string;
  first_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  category: string;
  contact_type: string | null;
  tags: string[] | null;
  dnc: boolean;
  dnc_last_checked: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_activity_date: string | null;
  activity_count: number | null;
  relationship_strength: number | null;
  sphere_influence_score: number | null;
  pipeline_active: boolean | null;
  pipeline_stage_summary: string | null;
  last_pipeline_activity: string | null;
  referral_source: string | null;
  referral_source_contact_id: string | null;
  referred_contacts_count: number | null;
  motivation_score: number | null;
  motivation_notes: string | null;
  move_timeline: string | null;
  life_event: string | null;
  life_event_date: string | null;
  priority_score: number | null;
  priority_reasoning: string | null;
  priority_components: Record<string, unknown> | null;
  priority_signals: Record<string, unknown> | null;
  priority_computed_at: string | null;
  priority_watch_flag: boolean;
  buyer_price_min: number | null;
  buyer_price_max: number | null;
  buyer_bedrooms_min: number | null;
  buyer_bathrooms_min: number | null;
  buyer_property_type: string | null;
  buyer_target_cities: string[] | null;
  buyer_target_zip_codes: string[] | null;
  buyer_must_haves: string | null;
  buyer_deal_breakers: string | null;
  buyer_pre_approval_status: string | null;
  buyer_pre_approval_amount: number | null;
  buyer_pre_approval_expiry: string | null;
  buyer_lender_name: string | null;
  buyer_loan_type: string | null;
  seller_property_address: string | null;
  seller_property_city: string | null;
  seller_property_state: string | null;
  seller_property_zip: string | null;
  seller_property_type: string | null;
  seller_estimated_value: number | null;
  seller_mortgage_balance: number | null;
  seller_equity_estimate: number | null;
  seller_home_condition: string | null;
  seller_listing_timeline: string | null;
  seller_motivation_reason: string | null;
  seller_has_agent: boolean | null;
  seller_interview_date: string | null;
  birthday: string | null;
  spouse_name: string | null;
  spouse_birthday: string | null;
  home_anniversary: string | null;
  kids_count: number | null;
  family_notes: string | null;
  preferred_contact_method: string | null;
  best_contact_time: string | null;
  last_call_at: string | null;
  last_text_at: string | null;
  last_email_at: string | null;
  met_through: string | null;
  met_through_contact_id: string | null;
  social_instagram: string | null;
  social_linkedin: string | null;
  social_facebook: string | null;
  engagement_trend: string | null;
}

type TabKey = 'overview' | 'touchpoints' | 'coach';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getInitials(c: { first_name?: string | null; last_name?: string | null }): string {
  const f = c.first_name?.trim();
  const l = c.last_name?.trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  return '··';
}

function fullName(c: { first_name?: string | null; last_name?: string | null }): string {
  const f = c.first_name?.trim() ?? '';
  const l = c.last_name?.trim() ?? '';
  return [f, l].filter(Boolean).join(' ') || 'Unknown contact';
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMoney(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(n);
}

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1'))
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

function fullAddress(c: ContactRecord): string {
  const line1 = [c.address_1, c.address_2].filter(Boolean).join(', ');
  const line2 = [c.city, c.state, c.zip_code].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ');
}

/**
 * Heuristic for "this column was populated by a CSV import that crammed list
 * names / tag values into a structured field." Common cases we've seen in the
 * wild: city/state/address_1 holding strings like
 *   "Imported 2/8/18;All Contacts;Imported on 3/23;* myContacts"
 * Detect those so we can suppress the line on display without modifying the
 * underlying data (cleanup is a Database-level task).
 */
function looksLikeImportJunk(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (!t) return false;
  if (/^imported\b/i.test(t)) return true;
  if (t.split(';').length > 2) return true;
  if (/\bmyContacts\b/i.test(t)) return true;
  return false;
}

function cleanLocation(c: ContactRecord | null | undefined): string | null {
  if (!c) return null;
  const city = looksLikeImportJunk(c.city) ? null : c.city;
  const state = looksLikeImportJunk(c.state) ? null : c.state;
  const zip = looksLikeImportJunk(c.zip_code) ? null : c.zip_code;
  const out = [city, state].filter(Boolean).join(', ');
  return [out, zip].filter(Boolean).join(' ').trim() || null;
}

// Days until next annual occurrence of a date (ignores year). Null if no date.
function daysUntilAnnual(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

function formatBirthday(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function yearsSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (365.25 * 86_400_000));
}

function socialUrl(handle: string, platform: 'instagram' | 'linkedin' | 'facebook'): string {
  const trimmed = handle.trim().replace(/^@/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  switch (platform) {
    case 'instagram': return `https://instagram.com/${trimmed}`;
    case 'linkedin':  return `https://linkedin.com/in/${trimmed}`;
    case 'facebook':  return `https://facebook.com/${trimmed}`;
  }
}

function socialDisplay(handle: string): string {
  const trimmed = handle.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return trimmed.length > 28 ? trimmed.slice(0, 26) + '…' : trimmed;
}

const trendStyles: Record<string, { tone: 'success' | 'muted' | 'warn' | 'danger'; icon: typeof TrendingUp; label: string }> = {
  warming: { tone: 'success', icon: TrendingUp,   label: 'Warming up' },
  stable:  { tone: 'muted',   icon: Minus,        label: 'Stable' },
  cooling: { tone: 'warn',    icon: TrendingDown, label: 'Cooling' },
  dormant: { tone: 'danger',  icon: Moon,         label: 'Dormant' },
};

function commPrefHasData(c: ContactRecord): boolean {
  return !!(c.preferred_contact_method || c.best_contact_time || c.last_call_at || c.last_text_at || c.last_email_at);
}

function connectionsHasData(c: ContactRecord): boolean {
  return !!(c.met_through || c.met_through_contact_id || c.social_instagram || c.social_linkedin || c.social_facebook || c.engagement_trend);
}

function buyerHasData(c: ContactRecord): boolean {
  return !!(
    c.buyer_price_min || c.buyer_price_max || c.buyer_bedrooms_min || c.buyer_bathrooms_min ||
    c.buyer_property_type || (c.buyer_target_cities?.length ?? 0) > 0 ||
    (c.buyer_target_zip_codes?.length ?? 0) > 0 || c.buyer_must_haves || c.buyer_deal_breakers ||
    c.buyer_pre_approval_status && c.buyer_pre_approval_status !== 'unknown' ||
    c.buyer_pre_approval_amount || c.buyer_lender_name || c.buyer_loan_type
  );
}

function sellerHasData(c: ContactRecord): boolean {
  return !!(
    c.seller_property_address || c.seller_property_type || c.seller_estimated_value ||
    c.seller_mortgage_balance || c.seller_equity_estimate || c.seller_home_condition ||
    c.seller_listing_timeline || c.seller_motivation_reason || c.seller_has_agent != null ||
    c.seller_interview_date
  );
}

// ─── shared subcomponents ────────────────────────────────────────────────────

function Pill({
  tone = 'muted',
  children,
  className,
}: {
  tone?: 'primary' | 'accent' | 'muted' | 'warn' | 'danger' | 'success' | 'dark';
  children: React.ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    primary: 'bg-reop-teal-soft text-primary',
    accent: 'bg-[hsl(74_50%_92%)] text-[hsl(74_61%_28%)]',
    muted: 'bg-[hsl(210_20%_94%)] text-muted-foreground',
    warn: 'bg-[hsl(45_93%_93%)] text-[hsl(35_80%_32%)]',
    danger: 'bg-[hsl(0_84%_95%)] text-[hsl(0_84%_40%)]',
    success: 'bg-[hsl(142_71%_94%)] text-[hsl(142_71%_28%)]',
    dark: 'bg-reop-dark-blue text-white',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] font-semibold leading-[1.3]',
      tones[tone],
      className,
    )}>
      {children}
    </span>
  );
}

// DNC notice — informational only. Sphere outreach is permitted under the
// existing-business-relationship exemption; we never block calls/texts.
// Mirrors the styling of ConversationStarterModal's DncBanner so the agent
// sees one consistent treatment everywhere DNC is surfaced.
function DncBanner({ name }: { name: string }) {
  return (
    <div className="flex gap-2.5 items-start px-3.5 py-2.5 rounded-[10px] border bg-[hsl(35_100%_96%)] border-[hsl(35_80%_82%)]">
      <AlertTriangle className="w-4 h-4 mt-px text-[hsl(35_80%_38%)] shrink-0" />
      <div className="text-[12.5px] leading-[1.45] text-[hsl(35_80%_28%)]">
        <b className="font-semibold block">{name} is on the Do Not Call list.</b>
        Sphere outreach is generally permitted under the existing-business-relationship exemption — proceed with judgment.
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof User;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-[hsl(210_20%_98%)]">
        <h3 className="m-0 text-[13px] font-semibold inline-flex items-center gap-2 text-reop-dark-blue">
          <Icon className="w-3.5 h-3.5 text-primary" />
          {title}
        </h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  children,
  emphasis,
}: {
  label: string;
  children: React.ReactNode;
  emphasis?: 'primary' | 'success' | 'warn';
}) {
  const valueColor =
    emphasis === 'primary' ? 'text-primary font-semibold' :
    emphasis === 'success' ? 'text-[hsl(142_55%_28%)] font-semibold' :
    emphasis === 'warn' ? 'text-[hsl(35_80%_32%)] font-semibold' :
    'text-reop-dark-blue';
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3 py-2 border-b border-border last:border-b-0 text-[13px]">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium break-words', valueColor)}>{children}</dd>
    </div>
  );
}

// ─── Inline-editable section scaffolding ────────────────────────────────────
//
// Pattern: every editable section calls EditableSection. The helper owns
// drag-state for the form (which fields are dirty) and renders the appropriate
// "Edit" / "Save+Cancel" affordances in the Section header. Mutations hit
// useUpdateContact, which optimistically writes to the ['contact', id] cache
// so the read view updates the moment Save is clicked.

type DraftValue = string | number | boolean | string[] | null;
type Draft = Record<string, DraftValue>;

// Cheap deep-equality for the shapes we actually put in a draft.
function draftValueEqual(a: DraftValue, b: DraftValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  return false;
}

function EditableSection({
  icon,
  title,
  c,
  mutation,
  fields,
  viewBody,
  editBody,
}: {
  icon: typeof User;
  title: string;
  c: ContactRecord;
  mutation: ReturnType<typeof useUpdateContact>;
  fields: string[];
  viewBody: () => React.ReactNode;
  editBody: (api: { draft: Draft; setField: (k: string, v: DraftValue) => void }) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const formRef = useRef<HTMLFormElement>(null);

  const start = () => {
    const initial: Draft = {};
    for (const f of fields) {
      initial[f] = (c as unknown as Record<string, DraftValue>)[f] ?? null;
    }
    setDraft(initial);
    setEditing(true);
  };

  const cancel = () => {
    setDraft({});
    setEditing(false);
  };

  const setField = (k: string, v: DraftValue) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Auto-focus the first focusable field when entering edit mode.
  useEffect(() => {
    if (editing && formRef.current) {
      const target = formRef.current.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)',
      );
      target?.focus();
    }
  }, [editing]);

  const handleSave = async () => {
    // Send only the fields that actually changed.
    const updates: Record<string, unknown> = {};
    for (const k of Object.keys(draft)) {
      const next = draft[k];
      const prev = (c as unknown as Record<string, DraftValue>)[k] ?? null;
      // Treat empty strings + empty arrays as null so we don't write blanks
      // for optional columns.
      const normalized: DraftValue =
        typeof next === 'string' && next.trim() === ''
          ? null
          : Array.isArray(next) && next.length === 0
            ? null
            : next;
      if (!draftValueEqual(normalized, prev)) {
        updates[k] = normalized;
      }
    }
    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }
    try {
      await mutation.mutateAsync({ id: c.id, updates });
      setEditing(false);
    } catch {
      // useUpdateContact already toasts on error and rolls back the cache.
    }
  };

  const action = editing ? (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={cancel}
        disabled={mutation.isPending}
        className="h-8 px-3 rounded-md text-[12px] font-semibold text-muted-foreground hover:text-reop-dark-blue hover:bg-[hsl(210_20%_94%)] transition disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={mutation.isPending}
        className="h-8 px-3.5 rounded-md text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-reop-teal-hover transition disabled:opacity-60"
      >
        {mutation.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={start}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold text-muted-foreground hover:text-primary hover:bg-reop-teal-soft transition"
    >
      <Pencil className="w-3 h-3" />
      Edit
    </button>
  );

  return (
    <Section icon={icon} title={title} action={action}>
      {editing ? (
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          onKeyDown={(e) => {
            // Escape cancels. Cmd/Ctrl+Enter saves (works inside textareas too,
            // where plain Enter inserts a newline as expected).
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleSave();
            }
          }}
        >
          {editBody({ draft, setField })}
          <div className="text-[10.5px] text-muted-foreground mt-3 pt-2 border-t border-border">
            ⌘↵ to save · Esc to cancel
          </div>
        </form>
      ) : (
        viewBody()
      )}
    </Section>
  );
}

// ─── Field-input primitives for inline edit forms ────────────────────────────

const inputBaseCls =
  'h-9 px-2.5 text-[13px] text-reop-dark-blue bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-muted-foreground w-full';

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2 border-b border-border last:border-b-0">
      <label className="text-[12px] text-muted-foreground pt-2">{label}</label>
      <div className="flex flex-col gap-1">
        {children}
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: DraftValue;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'tel' | 'email' | 'date' | 'number';
}) {
  return (
    <input
      type={type}
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputBaseCls}
    />
  );
}

function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: DraftValue;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(inputBaseCls, 'h-auto min-h-[64px] py-2 leading-[1.5] resize-y')}
    />
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: DraftValue;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      className={inputBaseCls}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function TagsField({
  value,
  onChange,
  placeholder,
}: {
  value: DraftValue;
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const arr = Array.isArray(value) ? value : [];
  const [text, setText] = useState(arr.join(', '));
  // Keep local text in sync if the parent draft swaps in a different array
  // (e.g., when Edit is toggled and the form re-initializes).
  useEffect(() => {
    setText(arr.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(value) ? value.join('|') : '']);
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
      placeholder={placeholder}
      className={inputBaseCls}
    />
  );
}

function ToggleField({
  value,
  onChange,
  label,
}: {
  value: DraftValue;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const on = !!value;
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex items-center gap-2 self-start h-9 px-3 rounded-md border text-[12.5px] font-semibold transition',
        on
          ? 'bg-[hsl(0_84%_95%)] border-[hsl(0_60%_85%)] text-[hsl(0_72%_40%)]'
          : 'bg-card border-border text-muted-foreground hover:text-reop-dark-blue',
      )}
    >
      <span
        className={cn(
          'inline-block w-3 h-3 rounded-full',
          on ? 'bg-[hsl(0_72%_45%)]' : 'bg-[hsl(210_20%_85%)]',
        )}
      />
      {on ? `${label} · on` : label}
    </button>
  );
}

function TierStrip({ items }: { items: { label: string; value: React.ReactNode; tone?: 'warn' | 'success' | 'primary' }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-5 mt-4 pt-4 border-t border-border">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-bold">{it.label}</span>
          <span className={cn(
            'text-[13px] font-semibold truncate',
            it.tone === 'warn' ? 'text-[hsl(35_80%_38%)]' :
            it.tone === 'success' ? 'text-[hsl(142_55%_28%)]' :
            it.tone === 'primary' ? 'text-primary' :
            'text-reop-dark-blue',
          )}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

const activityTypeStyles: Record<string, { dot: string; icon: typeof Phone }> = {
  call:    { dot: 'bg-[hsl(184_60%_92%)] text-[hsl(184_100%_28%)]', icon: Phone },
  text:    { dot: 'bg-[hsl(74_50%_92%)] text-[hsl(74_61%_28%)]',    icon: MessageSquare },
  email:   { dot: 'bg-[hsl(210_60%_93%)] text-[hsl(210_80%_40%)]',  icon: Mail },
  meeting: { dot: 'bg-[hsl(35_93%_92%)] text-[hsl(35_80%_32%)]',    icon: Clock },
  note:    { dot: 'bg-[hsl(45_93%_92%)] text-[hsl(35_80%_32%)]',    icon: Pencil },
  task:    { dot: 'bg-[hsl(45_93%_92%)] text-[hsl(35_80%_32%)]',    icon: ClipboardList },
};

function ActivityRow({
  a,
  onDelete,
  onEdit,
}: {
  a: ContactActivity;
  onDelete?: (a: ContactActivity) => void;
  onEdit?: (a: ContactActivity, updates: { activity_type: ComposeType; notes: string; activity_date: string }) => Promise<void>;
}) {
  const { dot, icon: Icon } = activityTypeStyles[a.activity_type] ?? activityTypeStyles.note;
  // Auto-generated rows (system inserts from cron / webhooks) are read-only —
  // editing or deleting them would only have them re-created on the next sync.
  const canMutate = !a.is_system_generated;
  const canDelete = canMutate && !!onDelete;
  const canEdit = canMutate && !!onEdit;

  const [editing, setEditing] = useState(false);
  const [draftType, setDraftType] = useState<ComposeType>(
    (['call', 'text', 'email', 'meeting', 'note', 'gift'] as ComposeType[]).includes(a.activity_type as ComposeType)
      ? (a.activity_type as ComposeType)
      : 'note',
  );
  const [draftBody, setDraftBody] = useState(a.notes ?? '');
  const [draftDate, setDraftDate] = useState(a.activity_date.slice(0, 10));
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraftType(
      (['call', 'text', 'email', 'meeting', 'note', 'gift'] as ComposeType[]).includes(a.activity_type as ComposeType)
        ? (a.activity_type as ComposeType)
        : 'note',
    );
    setDraftBody(a.notes ?? '');
    setDraftDate(a.activity_date.slice(0, 10));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!onEdit || saving) return;
    const trimmed = draftBody.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      // Preserve time-of-day when only the date changed; otherwise stamp noon
      // so the row sorts correctly for that day.
      const originalDate = a.activity_date.slice(0, 10);
      const isoDate = draftDate === originalDate
        ? a.activity_date
        : new Date(`${draftDate}T12:00:00`).toISOString();
      await onEdit(a, { activity_type: draftType, notes: trimmed, activity_date: isoDate });
      setEditing(false);
    } catch {
      // toast is surfaced from the parent
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    const types: { value: ComposeType; label: string; Icon: typeof Phone }[] = [
      { value: 'note',    label: 'Note',    Icon: Pencil },
      { value: 'call',    label: 'Call',    Icon: Phone },
      { value: 'text',    label: 'Text',    Icon: MessageSquare },
      { value: 'email',   label: 'Email',   Icon: Mail },
      { value: 'meeting', label: 'Meeting', Icon: Clock },
      { value: 'gift',    label: 'Gift',    Icon: Gift },
    ];
    return (
      <li className="grid grid-cols-[34px_1fr] items-start gap-3 py-3 border-b border-border last:border-b-0">
        <div className={cn('w-[34px] h-[34px] rounded-full flex items-center justify-center', dot)}>
          <Icon className="w-[15px] h-[15px]" />
        </div>
        <div className="min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1">
            {types.map((t) => {
              const active = draftType === t.value;
              const TIcon = t.Icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setDraftType(t.value)}
                  className={cn(
                    'inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11.5px] font-semibold transition border',
                    active
                      ? 'bg-reop-teal-soft text-primary border-primary'
                      : 'bg-card text-muted-foreground border-border hover:text-reop-dark-blue hover:border-[hsl(184_50%_75%)]',
                  )}
                >
                  <TIcon className="w-3 h-3" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleSave();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
            }}
            rows={3}
            className="w-full min-h-[72px] px-3 py-2 border border-border rounded-md bg-card text-[13px] leading-[1.5] text-reop-dark-blue placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>When</span>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="h-7 px-1.5 rounded border border-border bg-card text-[11.5px] text-reop-dark-blue focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="h-8 px-3 rounded-md text-[11.5px] font-semibold text-muted-foreground hover:text-reop-dark-blue hover:bg-[hsl(210_20%_94%)] transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || draftBody.trim().length === 0}
                className="h-8 px-3 rounded-md text-[11.5px] font-semibold bg-primary text-primary-foreground hover:bg-reop-teal-hover transition disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-[34px_1fr_auto] items-start gap-3 py-3 border-b border-border last:border-b-0 group">
      <div className={cn('w-[34px] h-[34px] rounded-full flex items-center justify-center', dot)}>
        <Icon className="w-[15px] h-[15px]" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <b className="text-[13px] font-semibold capitalize text-reop-dark-blue">{a.activity_type}</b>
          {a.duration_minutes ? (
            <span className="text-[11.5px] text-muted-foreground">— {a.duration_minutes} min</span>
          ) : null}
          {a.is_system_generated && (
            <Pill tone="muted" className="!px-1.5 !py-0 !text-[10px]">auto</Pill>
          )}
        </div>
        {a.outcome && (
          <p className="m-0 mt-0.5 text-[12.5px] text-reop-dark-blue leading-[1.5]">{a.outcome}</p>
        )}
        {a.notes && (
          <div className="mt-2 p-2.5 rounded-lg bg-[hsl(210_20%_97%)] border-l-[3px] border-[hsl(210_20%_85%)] text-[12.5px] text-reop-dark-blue leading-[1.5]">
            {a.notes}
          </div>
        )}
      </div>
      <div className="flex items-start gap-2 shrink-0">
        <span className="text-[11.5px] text-muted-foreground whitespace-nowrap mt-1">
          {formatRelative(a.activity_date)}
        </span>
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
            {canEdit && (
              <button
                type="button"
                onClick={startEdit}
                aria-label={`Edit ${a.activity_type} touchpoint`}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-reop-teal-soft hover:text-primary transition"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete?.(a)}
                aria-label={`Delete ${a.activity_type} touchpoint`}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[hsl(0_84%_95%)] hover:text-[hsl(0_72%_45%)] transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// Channel-aware touchpoint composer. Replaces the standalone Notes composer —
// notes are just one of six activity types here. The composer is the single
// place to log a touchpoint manually (the Log button in the header opens
// this tab).
type ComposeType = 'note' | 'call' | 'text' | 'email' | 'meeting' | 'gift';

function TouchpointComposer({
  onAdd,
}: {
  onAdd: (input: { activity_type: ComposeType; notes: string; activity_date?: string }) => Promise<void>;
}) {
  const [type, setType] = useState<ComposeType>('note');
  const [body, setBody] = useState('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      // Send a full ISO timestamp so the timeline orders correctly. If the
      // agent leaves the date at today, append the current time.
      const today = new Date().toISOString().slice(0, 10);
      const isoDate = date === today
        ? new Date().toISOString()
        : new Date(`${date}T12:00:00`).toISOString();
      await onAdd({ activity_type: type, notes: trimmed, activity_date: isoDate });
      setBody('');
      setDate(today);
    } catch {
      // toast surfaces from the parent
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const types: { value: ComposeType; label: string; Icon: typeof Phone }[] = [
    { value: 'note',    label: 'Note',    Icon: Pencil },
    { value: 'call',    label: 'Call',    Icon: Phone },
    { value: 'text',    label: 'Text',    Icon: MessageSquare },
    { value: 'email',   label: 'Email',   Icon: Mail },
    { value: 'meeting', label: 'Meeting', Icon: Clock },
    { value: 'gift',    label: 'Gift',    Icon: Gift },
  ];

  const placeholder: Record<ComposeType, string> = {
    note:    'A quick note for next time you reach out.',
    call:    'What did you talk about? Outcome, next step…',
    text:    'What did you message about?',
    email:   'Subject + outcome.',
    meeting: 'Agenda, decisions, follow-ups.',
    gift:    'What did you send and why?',
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1">
        {types.map((t) => {
          const active = type === t.value;
          const Icon = t.Icon;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] font-semibold transition border',
                active
                  ? 'bg-reop-teal-soft text-primary border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-reop-dark-blue hover:border-[hsl(184_50%_75%)]',
              )}
            >
              <Icon className="w-3 h-3" />
              {t.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder[type]}
        rows={3}
        className="min-h-[88px] w-full px-3 py-2.5 border border-border rounded-lg bg-card text-[13.5px] leading-[1.5] text-reop-dark-blue placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="inline-flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <span>When</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 px-2 rounded border border-border bg-card text-[12px] text-reop-dark-blue focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            max={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">⌘↵ to save</span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || body.trim().length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-reop-teal-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <ClipboardList className="w-3.5 h-3.5" />
            )}
            {saving ? 'Saving…' : 'Add touchpoint'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TouchpointsPane({
  activities,
  loading,
  onAdd,
  onDelete,
  onEdit,
  legacyNote,
}: {
  activities: ContactActivity[];
  loading: boolean;
  onAdd: (input: { activity_type: ComposeType; notes: string; activity_date?: string }) => Promise<void>;
  onDelete: (a: ContactActivity) => Promise<void>;
  onEdit: (a: ContactActivity, updates: { activity_type: ComposeType; notes: string; activity_date: string }) => Promise<void>;
  legacyNote: string | null;
}) {
  return (
    <div className="space-y-4">
      <Section icon={ClipboardList} title="Log a touchpoint">
        <TouchpointComposer onAdd={onAdd} />
      </Section>

      <Section icon={Activity} title={`Timeline · ${activities.length}`}>
        {loading ? (
          <div className="text-[13px] text-muted-foreground py-3">Loading…</div>
        ) : activities.length === 0 && !legacyNote ? (
          <div className="text-[13px] text-muted-foreground py-3">
            No touchpoints logged yet. Use the composer above the next time you talk to them.
          </div>
        ) : (
          <ol className="m-0 p-0 list-none">
            {activities.map((a) => (
              <ActivityRow key={a.id} a={a} onDelete={onDelete} onEdit={onEdit} />
            ))}
            {legacyNote && (
              <li className="grid grid-cols-[34px_1fr_auto] items-start gap-3 py-3 border-t border-border">
                <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center bg-[hsl(45_93%_92%)] text-[hsl(35_80%_32%)]">
                  <Pin className="w-[15px] h-[15px]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <b className="text-[13px] font-semibold text-reop-dark-blue">Earlier note</b>
                    <Pill tone="muted" className="!px-1.5 !py-0 !text-[10px]">pre-timeline</Pill>
                  </div>
                  <div className="mt-2 p-2.5 rounded-lg bg-[hsl(45_93%_96%)] border-l-[3px] border-[hsl(45_70%_68%)] text-[12.5px] text-reop-dark-blue leading-[1.5] whitespace-pre-wrap">
                    {legacyNote}
                  </div>
                </div>
                <span className="text-[11.5px] text-muted-foreground whitespace-nowrap shrink-0 mt-1" />
              </li>
            )}
          </ol>
        )}
      </Section>
    </div>
  );
}

// ─── tab panes ───────────────────────────────────────────────────────────────

function OverviewPane({
  c,
  mutation,
}: {
  c: ContactRecord;
  mutation: ReturnType<typeof useUpdateContact>;
}) {
  const addr = fullAddress(c);
  const buyer = buyerHasData(c);
  const seller = sellerHasData(c);
  const range =
    (c.buyer_price_min || c.buyer_price_max)
      ? `${formatMoney(c.buyer_price_min, { compact: true })} – ${formatMoney(c.buyer_price_max, { compact: true })}`
      : '—';
  const beds =
    c.buyer_bedrooms_min || c.buyer_bathrooms_min
      ? `${c.buyer_bedrooms_min ?? '?'} bed · ${c.buyer_bathrooms_min ?? '?'} bath`
      : '—';
  const preApproval = c.buyer_pre_approval_status && c.buyer_pre_approval_status !== 'unknown'
    ? c.buyer_pre_approval_status
    : null;

  return (
    <div className="space-y-4">
      <EditableSection
        icon={User}
        title="Contact details"
        c={c}
        mutation={mutation}
        fields={['first_name', 'last_name', 'phone', 'email', 'contact_type', 'dnc']}
        viewBody={() => (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <InfoRow label="Full name">{fullName(c)}</InfoRow>
            <InfoRow label="Last name initial">
              <span
                className="inline-flex items-center px-1.5 py-px rounded-full bg-[hsl(210_20%_94%)] text-muted-foreground text-[11px] font-semibold"
                title="Drives the SphereSync rotation slot — not a priority rank"
              >
                {c.category || '·'}
              </span>
            </InfoRow>
            <InfoRow label="Phone">
              {c.phone ? (
                <a href={`tel:${c.phone}`} className="text-primary hover:underline">{c.phone}</a>
              ) : '—'}
            </InfoRow>
            <InfoRow label="Email">
              {c.email ? (
                <a href={`mailto:${c.email}`} className="text-primary hover:underline break-all">{c.email}</a>
              ) : '—'}
            </InfoRow>
            <InfoRow label="DNC">
              {c.dnc ? <Pill tone="danger">DNC</Pill> : <span className="text-muted-foreground">No</span>}
            </InfoRow>
            <InfoRow label="Type">{c.contact_type || '—'}</InfoRow>
          </dl>
        )}
        editBody={({ draft, setField }) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <FieldRow label="First name">
              <TextField value={draft.first_name} onChange={(v) => setField('first_name', v)} />
            </FieldRow>
            <FieldRow label="Last name">
              <TextField value={draft.last_name} onChange={(v) => setField('last_name', v)} />
            </FieldRow>
            <FieldRow label="Phone">
              <TextField type="tel" value={draft.phone} onChange={(v) => setField('phone', v)} placeholder="(555) 555-5555" />
            </FieldRow>
            <FieldRow label="Email">
              <TextField type="email" value={draft.email} onChange={(v) => setField('email', v)} placeholder="name@example.com" />
            </FieldRow>
            <FieldRow label="Type">
              <SelectField
                value={draft.contact_type ?? ''}
                onChange={(v) => setField('contact_type', v || null)}
                options={[
                  { value: '', label: 'Contact (default)' },
                  { value: 'lead', label: 'Lead' },
                  { value: 'client', label: 'Client' },
                  { value: 'past_client', label: 'Past client' },
                  { value: 'sphere', label: 'Sphere' },
                  { value: 'vendor', label: 'Vendor' },
                  { value: 'agent', label: 'Agent' },
                ]}
              />
            </FieldRow>
            <FieldRow label="DNC" hint="Sphere outreach is OK under EBR — flag is informational.">
              <ToggleField
                value={draft.dnc}
                onChange={(v) => setField('dnc', v)}
                label="On Do Not Call list"
              />
            </FieldRow>
          </div>
        )}
      />

      {/* Family & Life Events — always shown, even if empty (so agents can
          tell at a glance "I haven't captured this yet"). The fields drive
          gift cadence, anniversary touches, and birthday outreach. */}
      <EditableSection
        icon={Cake}
        title="Family & Life Events"
        c={c}
        mutation={mutation}
        fields={[
          'birthday', 'home_anniversary', 'spouse_name', 'spouse_birthday',
          'kids_count', 'family_notes', 'life_event', 'life_event_date',
        ]}
        viewBody={() => (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <InfoRow label="Birthday">
                {c.birthday ? (
                  <span>
                    {formatBirthday(c.birthday)}
                    {(() => {
                      const days = daysUntilAnnual(c.birthday);
                      if (days == null) return null;
                      const tone = days <= 14 ? 'primary' : days <= 30 ? 'accent' : 'muted';
                      return (
                        <Pill tone={tone} className="ml-2 !py-0 !text-[10px]">
                          {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`}
                        </Pill>
                      );
                    })()}
                  </span>
                ) : <span className="text-muted-foreground">—</span>}
              </InfoRow>
              <InfoRow label="Home anniversary">
                {c.home_anniversary ? (
                  <span>
                    {formatDate(c.home_anniversary)}
                    {(() => {
                      const yrs = yearsSince(c.home_anniversary);
                      const days = daysUntilAnnual(c.home_anniversary);
                      return (
                        <>
                          {yrs != null && yrs > 0 && (
                            <span className="text-muted-foreground font-normal"> · {yrs} yr{yrs === 1 ? '' : 's'}</span>
                          )}
                          {days != null && days <= 30 && (
                            <Pill tone="primary" className="ml-2 !py-0 !text-[10px]">
                              <Gift className="w-2.5 h-2.5" />
                              {days === 0 ? 'today' : `in ${days}d`}
                            </Pill>
                          )}
                        </>
                      );
                    })()}
                  </span>
                ) : <span className="text-muted-foreground">—</span>}
              </InfoRow>
              <InfoRow label="Spouse">
                {c.spouse_name || <span className="text-muted-foreground">—</span>}
              </InfoRow>
              <InfoRow label="Spouse birthday">
                {c.spouse_birthday ? (
                  <span>
                    {formatBirthday(c.spouse_birthday)}
                    {(() => {
                      const days = daysUntilAnnual(c.spouse_birthday);
                      if (days == null) return null;
                      const tone = days <= 14 ? 'primary' : days <= 30 ? 'accent' : 'muted';
                      return (
                        <Pill tone={tone} className="ml-2 !py-0 !text-[10px]">
                          {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`}
                        </Pill>
                      );
                    })()}
                  </span>
                ) : <span className="text-muted-foreground">—</span>}
              </InfoRow>
              <InfoRow label="Kids">
                {c.kids_count != null ? c.kids_count : <span className="text-muted-foreground">—</span>}
              </InfoRow>
              <InfoRow label="Life event">
                {c.life_event ? (
                  <span>
                    {c.life_event}
                    {c.life_event_date && (
                      <span className="text-muted-foreground"> · {formatDate(c.life_event_date)}</span>
                    )}
                  </span>
                ) : <span className="text-muted-foreground">—</span>}
              </InfoRow>
            </dl>
            {c.family_notes && (
              <div className="mt-3 p-3 rounded-lg bg-[hsl(74_50%_96%)] border-l-[3px] border-[hsl(74_61%_52%)] text-[12.5px] text-reop-dark-blue leading-[1.5]">
                <b className="font-semibold text-[hsl(74_61%_28%)]">Family notes:</b> {c.family_notes}
              </div>
            )}
          </>
        )}
        editBody={({ draft, setField }) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <FieldRow label="Birthday">
              <TextField type="date" value={draft.birthday} onChange={(v) => setField('birthday', v)} />
            </FieldRow>
            <FieldRow label="Home anniversary">
              <TextField type="date" value={draft.home_anniversary} onChange={(v) => setField('home_anniversary', v)} />
            </FieldRow>
            <FieldRow label="Spouse name">
              <TextField value={draft.spouse_name} onChange={(v) => setField('spouse_name', v)} />
            </FieldRow>
            <FieldRow label="Spouse birthday">
              <TextField type="date" value={draft.spouse_birthday} onChange={(v) => setField('spouse_birthday', v)} />
            </FieldRow>
            <FieldRow label="Kids">
              <TextField
                type="number"
                value={draft.kids_count}
                onChange={(v) => setField('kids_count', v === '' ? null : Number(v))}
                placeholder="0"
              />
            </FieldRow>
            <FieldRow label="Life event" hint="Engagement, baby, kid college, retirement, etc.">
              <TextField
                value={draft.life_event}
                onChange={(v) => setField('life_event', v)}
                placeholder="e.g., expecting baby"
              />
            </FieldRow>
            <FieldRow label="Event date">
              <TextField type="date" value={draft.life_event_date} onChange={(v) => setField('life_event_date', v)} />
            </FieldRow>
            <FieldRow label="Family notes" hint="Anything you want to remember on the next call.">
              <TextAreaField
                value={draft.family_notes}
                onChange={(v) => setField('family_notes', v)}
                placeholder="Two kids: Emma 7 and Sam 4. Loves hiking the PCT."
                rows={3}
              />
            </FieldRow>
          </div>
        )}
      />

      <EditableSection
        icon={MapPin}
        title="Address"
        c={c}
        mutation={mutation}
        fields={['address_1', 'address_2', 'city', 'state', 'zip_code']}
        viewBody={() => (
          <dl>
            <InfoRow label="Address">
              {addr && !looksLikeImportJunk(addr)
                ? addr
                : <span className="text-muted-foreground">—</span>}
            </InfoRow>
          </dl>
        )}
        editBody={({ draft, setField }) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <FieldRow label="Street">
              <TextField value={draft.address_1} onChange={(v) => setField('address_1', v)} placeholder="123 Main St" />
            </FieldRow>
            <FieldRow label="Apt / unit">
              <TextField value={draft.address_2} onChange={(v) => setField('address_2', v)} placeholder="#4B" />
            </FieldRow>
            <FieldRow label="City">
              <TextField value={draft.city} onChange={(v) => setField('city', v)} placeholder="Bethesda" />
            </FieldRow>
            <FieldRow label="State">
              <TextField value={draft.state} onChange={(v) => setField('state', v)} placeholder="MD" />
            </FieldRow>
            <FieldRow label="ZIP">
              <TextField value={draft.zip_code} onChange={(v) => setField('zip_code', v)} placeholder="20814" />
            </FieldRow>
          </div>
        )}
      />

      {/* Tags — view only for now; editor will land in Phase 6 follow-up. */}
      {c.tags && c.tags.length > 0 && (
        <Section icon={TagIcon} title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {c.tags.map((t) => (
              <Pill key={t} tone="muted">
                <TagIcon className="w-2.5 h-2.5" />
                {t}
              </Pill>
            ))}
          </div>
        </Section>
      )}

      <EditableSection
        icon={Heart}
        title="Sphere & relationship"
        c={c}
        mutation={mutation}
        fields={[
          'relationship_strength', 'sphere_influence_score', 'referral_source',
          'move_timeline', 'motivation_score', 'motivation_notes',
        ]}
        viewBody={() => (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <InfoRow label="Strength">
                {c.relationship_strength != null ? `${c.relationship_strength} / 10` : '—'}
              </InfoRow>
              <InfoRow label="Influence">
                {c.sphere_influence_score != null ? `${c.sphere_influence_score} / 10` : '—'}
              </InfoRow>
              <InfoRow label="Source">{c.referral_source || '—'}</InfoRow>
              <InfoRow label="Referrals sent">{c.referred_contacts_count ?? 0}</InfoRow>
              <InfoRow label="Move timeline">{c.move_timeline || '—'}</InfoRow>
              <InfoRow label="Motivation">
                {c.motivation_score != null ? `${c.motivation_score} / 10` : '—'}
              </InfoRow>
              <InfoRow label="Last touch">{formatRelative(c.last_activity_date)}</InfoRow>
            </dl>
            {c.motivation_notes && (
              <div className="mt-3 p-3 rounded-lg bg-[hsl(210_20%_97%)] text-[12.5px] text-reop-dark-blue leading-[1.5] border-l-[3px] border-[hsl(210_20%_85%)]">
                <b className="font-semibold">Motivation:</b> {c.motivation_notes}
              </div>
            )}
          </>
        )}
        editBody={({ draft, setField }) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <FieldRow label="Strength" hint="1 = barely know them, 10 = closest sphere.">
              <TextField
                type="number"
                value={draft.relationship_strength}
                onChange={(v) => setField('relationship_strength', v === '' ? null : Math.max(1, Math.min(10, Number(v))))}
                placeholder="1–10"
              />
            </FieldRow>
            <FieldRow label="Influence" hint="How many people they could refer if asked. 1–10.">
              <TextField
                type="number"
                value={draft.sphere_influence_score}
                onChange={(v) => setField('sphere_influence_score', v === '' ? null : Math.max(1, Math.min(10, Number(v))))}
                placeholder="1–10"
              />
            </FieldRow>
            <FieldRow label="Source" hint="How you originally met / who referred them.">
              <TextField value={draft.referral_source} onChange={(v) => setField('referral_source', v)} placeholder="e.g., friend of Sarah" />
            </FieldRow>
            <FieldRow label="Move timeline">
              <SelectField
                value={draft.move_timeline ?? ''}
                onChange={(v) => setField('move_timeline', v || null)}
                options={[
                  { value: '', label: '—' },
                  { value: '0-3 months', label: '0–3 months' },
                  { value: '3-6 months', label: '3–6 months' },
                  { value: '6-12 months', label: '6–12 months' },
                  { value: '1-2 years', label: '1–2 years' },
                  { value: '2+ years', label: '2+ years' },
                  { value: 'no plans', label: 'No plans' },
                ]}
              />
            </FieldRow>
            <FieldRow label="Motivation" hint="How motivated they are to transact. 1–10.">
              <TextField
                type="number"
                value={draft.motivation_score}
                onChange={(v) => setField('motivation_score', v === '' ? null : Math.max(1, Math.min(10, Number(v))))}
                placeholder="1–10"
              />
            </FieldRow>
            <FieldRow label="Motivation notes">
              <TextAreaField
                value={draft.motivation_notes}
                onChange={(v) => setField('motivation_notes', v)}
                placeholder="What's driving them — promotion, growing family, downsizing, etc."
                rows={2}
              />
            </FieldRow>
          </div>
        )}
      />

      {commPrefHasData(c) && (
        <Section icon={MessageSquare} title="Communication preferences">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <InfoRow label="Preferred">
              {c.preferred_contact_method ? (
                <span className="capitalize">{c.preferred_contact_method}</span>
              ) : '—'}
            </InfoRow>
            <InfoRow label="Best time">
              {c.best_contact_time ? (
                <span className="capitalize">{c.best_contact_time}</span>
              ) : '—'}
            </InfoRow>
            <InfoRow label="Last call">{formatRelative(c.last_call_at)}</InfoRow>
            <InfoRow label="Last text">{formatRelative(c.last_text_at)}</InfoRow>
            <InfoRow label="Last email">{formatRelative(c.last_email_at)}</InfoRow>
          </dl>
        </Section>
      )}

      {connectionsHasData(c) && (
        <Section icon={LinkIcon} title="Connections">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {c.engagement_trend && trendStyles[c.engagement_trend] && (
              <InfoRow label="Trend">
                {(() => {
                  const t = trendStyles[c.engagement_trend!];
                  const Icon = t.icon;
                  return (
                    <Pill tone={t.tone}>
                      <Icon className="w-3 h-3" />
                      {t.label}
                    </Pill>
                  );
                })()}
              </InfoRow>
            )}
            <InfoRow label="Met through">
              {c.met_through ? c.met_through : c.met_through_contact_id ? (
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" />
                  Linked contact
                </span>
              ) : '—'}
            </InfoRow>
            {c.social_instagram && (
              <InfoRow label="Instagram">
                <a
                  href={socialUrl(c.social_instagram, 'instagram')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Instagram className="w-3 h-3" />
                  {socialDisplay(c.social_instagram)}
                </a>
              </InfoRow>
            )}
            {c.social_linkedin && (
              <InfoRow label="LinkedIn">
                <a
                  href={socialUrl(c.social_linkedin, 'linkedin')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Linkedin className="w-3 h-3" />
                  {socialDisplay(c.social_linkedin)}
                </a>
              </InfoRow>
            )}
            {c.social_facebook && (
              <InfoRow label="Facebook">
                <a
                  href={socialUrl(c.social_facebook, 'facebook')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Facebook className="w-3 h-3" />
                  {socialDisplay(c.social_facebook)}
                </a>
              </InfoRow>
            )}
          </dl>
        </Section>
      )}

      <EditableSection
        icon={Compass}
        title="Buyer profile"
        c={c}
        mutation={mutation}
        fields={[
          'buyer_price_min', 'buyer_price_max', 'buyer_bedrooms_min', 'buyer_bathrooms_min',
          'buyer_property_type', 'buyer_target_cities', 'buyer_target_zip_codes',
          'buyer_lender_name', 'buyer_loan_type', 'buyer_pre_approval_status',
          'buyer_pre_approval_amount', 'buyer_pre_approval_expiry',
          'buyer_must_haves', 'buyer_deal_breakers',
        ]}
        viewBody={() => (
          <>
            {!buyer ? (
              <p className="text-[12.5px] text-muted-foreground m-0">
                No buyer details captured yet. Hit <b>Edit</b> if this contact is looking to buy.
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow label="Price range" emphasis="primary">{range}</InfoRow>
                  <InfoRow label="Beds / baths">{beds}</InfoRow>
                  <InfoRow label="Property type">{c.buyer_property_type || '—'}</InfoRow>
                  <InfoRow label="Target cities">
                    {c.buyer_target_cities?.length ? c.buyer_target_cities.join(', ') : '—'}
                  </InfoRow>
                  <InfoRow label="Target ZIPs">
                    {c.buyer_target_zip_codes?.length ? c.buyer_target_zip_codes.join(', ') : '—'}
                  </InfoRow>
                  <InfoRow label="Lender">{c.buyer_lender_name || '—'}</InfoRow>
                  <InfoRow label="Loan type">{c.buyer_loan_type || '—'}</InfoRow>
                  <InfoRow label="Pre-approval" emphasis={preApproval === 'approved' ? 'success' : preApproval ? 'warn' : undefined}>
                    {preApproval ? (
                      <span className="capitalize">
                        {preApproval}
                        {c.buyer_pre_approval_amount && (
                          <span className="text-muted-foreground font-normal"> · up to {formatMoney(c.buyer_pre_approval_amount, { compact: true })}</span>
                        )}
                        {c.buyer_pre_approval_expiry && (
                          <span className="text-muted-foreground font-normal"> · exp {formatDate(c.buyer_pre_approval_expiry)}</span>
                        )}
                      </span>
                    ) : '—'}
                  </InfoRow>
                </dl>
                {c.buyer_must_haves && (
                  <div className="mt-3 p-3 rounded-lg bg-[hsl(184_100%_97%)] border border-[hsl(184_50%_85%)] text-[12.5px] text-reop-dark-blue leading-[1.5]">
                    <b className="font-semibold text-primary">Must-haves:</b> {c.buyer_must_haves}
                  </div>
                )}
                {c.buyer_deal_breakers && (
                  <div className="mt-2 p-3 rounded-lg bg-[hsl(0_84%_97%)] border border-[hsl(0_60%_88%)] text-[12.5px] text-reop-dark-blue leading-[1.5]">
                    <b className="font-semibold text-[hsl(0_84%_40%)]">Deal-breakers:</b> {c.buyer_deal_breakers}
                  </div>
                )}
              </>
            )}
          </>
        )}
        editBody={({ draft, setField }) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <FieldRow label="Min price">
              <TextField
                type="number"
                value={draft.buyer_price_min}
                onChange={(v) => setField('buyer_price_min', v === '' ? null : Number(v))}
                placeholder="500000"
              />
            </FieldRow>
            <FieldRow label="Max price">
              <TextField
                type="number"
                value={draft.buyer_price_max}
                onChange={(v) => setField('buyer_price_max', v === '' ? null : Number(v))}
                placeholder="800000"
              />
            </FieldRow>
            <FieldRow label="Min beds">
              <TextField
                type="number"
                value={draft.buyer_bedrooms_min}
                onChange={(v) => setField('buyer_bedrooms_min', v === '' ? null : Number(v))}
                placeholder="3"
              />
            </FieldRow>
            <FieldRow label="Min baths">
              <TextField
                type="number"
                value={draft.buyer_bathrooms_min}
                onChange={(v) => setField('buyer_bathrooms_min', v === '' ? null : Number(v))}
                placeholder="2"
              />
            </FieldRow>
            <FieldRow label="Property type">
              <SelectField
                value={draft.buyer_property_type ?? ''}
                onChange={(v) => setField('buyer_property_type', v || null)}
                options={[
                  { value: '', label: '—' },
                  { value: 'single_family', label: 'Single family' },
                  { value: 'townhouse', label: 'Townhouse' },
                  { value: 'condo', label: 'Condo' },
                  { value: 'multi_family', label: 'Multi-family' },
                  { value: 'land', label: 'Land' },
                  { value: 'investment', label: 'Investment' },
                ]}
              />
            </FieldRow>
            <FieldRow label="Target cities" hint="Comma-separated">
              <TagsField
                value={draft.buyer_target_cities}
                onChange={(v) => setField('buyer_target_cities', v)}
                placeholder="Bethesda, Chevy Chase"
              />
            </FieldRow>
            <FieldRow label="Target ZIPs" hint="Comma-separated">
              <TagsField
                value={draft.buyer_target_zip_codes}
                onChange={(v) => setField('buyer_target_zip_codes', v)}
                placeholder="20814, 20815"
              />
            </FieldRow>
            <FieldRow label="Lender">
              <TextField value={draft.buyer_lender_name} onChange={(v) => setField('buyer_lender_name', v)} />
            </FieldRow>
            <FieldRow label="Loan type">
              <SelectField
                value={draft.buyer_loan_type ?? ''}
                onChange={(v) => setField('buyer_loan_type', v || null)}
                options={[
                  { value: '', label: '—' },
                  { value: 'conventional', label: 'Conventional' },
                  { value: 'fha', label: 'FHA' },
                  { value: 'va', label: 'VA' },
                  { value: 'jumbo', label: 'Jumbo' },
                  { value: 'cash', label: 'Cash' },
                ]}
              />
            </FieldRow>
            <FieldRow label="Pre-approval">
              <SelectField
                value={draft.buyer_pre_approval_status ?? ''}
                onChange={(v) => setField('buyer_pre_approval_status', v || null)}
                options={[
                  { value: '', label: 'Unknown' },
                  { value: 'pre_qualified', label: 'Pre-qualified' },
                  { value: 'in_progress', label: 'In progress' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'expired', label: 'Expired' },
                ]}
              />
            </FieldRow>
            <FieldRow label="Approval amount">
              <TextField
                type="number"
                value={draft.buyer_pre_approval_amount}
                onChange={(v) => setField('buyer_pre_approval_amount', v === '' ? null : Number(v))}
                placeholder="800000"
              />
            </FieldRow>
            <FieldRow label="Expires">
              <TextField type="date" value={draft.buyer_pre_approval_expiry} onChange={(v) => setField('buyer_pre_approval_expiry', v)} />
            </FieldRow>
            <FieldRow label="Must-haves">
              <TextAreaField value={draft.buyer_must_haves} onChange={(v) => setField('buyer_must_haves', v)} placeholder="3+ bed, fenced yard, walking distance to metro" rows={2} />
            </FieldRow>
            <FieldRow label="Deal-breakers">
              <TextAreaField value={draft.buyer_deal_breakers} onChange={(v) => setField('buyer_deal_breakers', v)} placeholder="HOA, busy street, north-facing" rows={2} />
            </FieldRow>
          </div>
        )}
      />

      <EditableSection
        icon={Home}
        title="Seller profile"
        c={c}
        mutation={mutation}
        fields={[
          'seller_property_address', 'seller_property_city', 'seller_property_state', 'seller_property_zip',
          'seller_property_type', 'seller_estimated_value', 'seller_mortgage_balance', 'seller_equity_estimate',
          'seller_home_condition', 'seller_listing_timeline', 'seller_motivation_reason',
          'seller_has_agent', 'seller_interview_date',
        ]}
        viewBody={() => (
          <>
            {!seller ? (
              <p className="text-[12.5px] text-muted-foreground m-0">
                No seller details captured yet. Hit <b>Edit</b> if this contact is looking to sell.
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow label="Property">
                    {c.seller_property_address ? (
                      <span>
                        {c.seller_property_address}
                        {(c.seller_property_city || c.seller_property_state) && (
                          <span className="text-muted-foreground font-normal">
                            {' '}· {[c.seller_property_city, c.seller_property_state, c.seller_property_zip].filter(Boolean).join(' ')}
                          </span>
                        )}
                      </span>
                    ) : '—'}
                  </InfoRow>
                  <InfoRow label="Property type">{c.seller_property_type || '—'}</InfoRow>
                  <InfoRow label="Est. value" emphasis="primary">
                    {formatMoney(c.seller_estimated_value, { compact: true })}
                  </InfoRow>
                  <InfoRow label="Mortgage" emphasis="warn">
                    {formatMoney(c.seller_mortgage_balance, { compact: true })}
                  </InfoRow>
                  <InfoRow label="Equity" emphasis="success">
                    {formatMoney(c.seller_equity_estimate, { compact: true })}
                  </InfoRow>
                  <InfoRow label="Condition">{c.seller_home_condition || '—'}</InfoRow>
                  <InfoRow label="Listing timeline">{c.seller_listing_timeline || '—'}</InfoRow>
                  <InfoRow label="Has agent">
                    {c.seller_has_agent == null ? '—' : c.seller_has_agent ? <Pill tone="warn">Yes</Pill> : <Pill tone="success">No</Pill>}
                  </InfoRow>
                  <InfoRow label="Interview date">{formatDate(c.seller_interview_date)}</InfoRow>
                </dl>
                {c.seller_motivation_reason && (
                  <div className="mt-3 p-3 rounded-lg bg-[hsl(210_20%_97%)] text-[12.5px] text-reop-dark-blue leading-[1.5] border-l-[3px] border-[hsl(210_20%_85%)]">
                    <b className="font-semibold">Why selling:</b> {c.seller_motivation_reason}
                  </div>
                )}
              </>
            )}
          </>
        )}
        editBody={({ draft, setField }) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <FieldRow label="Street">
              <TextField value={draft.seller_property_address} onChange={(v) => setField('seller_property_address', v)} placeholder="123 Main St" />
            </FieldRow>
            <FieldRow label="City">
              <TextField value={draft.seller_property_city} onChange={(v) => setField('seller_property_city', v)} />
            </FieldRow>
            <FieldRow label="State">
              <TextField value={draft.seller_property_state} onChange={(v) => setField('seller_property_state', v)} />
            </FieldRow>
            <FieldRow label="ZIP">
              <TextField value={draft.seller_property_zip} onChange={(v) => setField('seller_property_zip', v)} />
            </FieldRow>
            <FieldRow label="Property type">
              <SelectField
                value={draft.seller_property_type ?? ''}
                onChange={(v) => setField('seller_property_type', v || null)}
                options={[
                  { value: '', label: '—' },
                  { value: 'single_family', label: 'Single family' },
                  { value: 'townhouse', label: 'Townhouse' },
                  { value: 'condo', label: 'Condo' },
                  { value: 'multi_family', label: 'Multi-family' },
                  { value: 'land', label: 'Land' },
                  { value: 'investment', label: 'Investment' },
                ]}
              />
            </FieldRow>
            <FieldRow label="Est. value">
              <TextField
                type="number"
                value={draft.seller_estimated_value}
                onChange={(v) => setField('seller_estimated_value', v === '' ? null : Number(v))}
                placeholder="850000"
              />
            </FieldRow>
            <FieldRow label="Mortgage">
              <TextField
                type="number"
                value={draft.seller_mortgage_balance}
                onChange={(v) => setField('seller_mortgage_balance', v === '' ? null : Number(v))}
                placeholder="450000"
              />
            </FieldRow>
            <FieldRow label="Equity">
              <TextField
                type="number"
                value={draft.seller_equity_estimate}
                onChange={(v) => setField('seller_equity_estimate', v === '' ? null : Number(v))}
                placeholder="400000"
              />
            </FieldRow>
            <FieldRow label="Condition">
              <SelectField
                value={draft.seller_home_condition ?? ''}
                onChange={(v) => setField('seller_home_condition', v || null)}
                options={[
                  { value: '', label: '—' },
                  { value: 'turnkey', label: 'Turnkey' },
                  { value: 'minor_updates', label: 'Minor updates' },
                  { value: 'major_updates', label: 'Major updates needed' },
                  { value: 'fixer', label: 'Fixer' },
                ]}
              />
            </FieldRow>
            <FieldRow label="Listing timeline">
              <SelectField
                value={draft.seller_listing_timeline ?? ''}
                onChange={(v) => setField('seller_listing_timeline', v || null)}
                options={[
                  { value: '', label: '—' },
                  { value: '0-3 months', label: '0–3 months' },
                  { value: '3-6 months', label: '3–6 months' },
                  { value: '6-12 months', label: '6–12 months' },
                  { value: '1-2 years', label: '1–2 years' },
                  { value: 'undecided', label: 'Undecided' },
                ]}
              />
            </FieldRow>
            <FieldRow label="Has agent">
              <SelectField
                value={
                  draft.seller_has_agent === true
                    ? 'true'
                    : draft.seller_has_agent === false
                      ? 'false'
                      : ''
                }
                onChange={(v) =>
                  setField('seller_has_agent', v === 'true' ? true : v === 'false' ? false : null)
                }
                options={[
                  { value: '', label: 'Unknown' },
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
              />
            </FieldRow>
            <FieldRow label="Interview date">
              <TextField type="date" value={draft.seller_interview_date} onChange={(v) => setField('seller_interview_date', v)} />
            </FieldRow>
            <FieldRow label="Why selling">
              <TextAreaField
                value={draft.seller_motivation_reason}
                onChange={(v) => setField('seller_motivation_reason', v)}
                placeholder="Promotion, growing family, downsizing, divorce, etc."
                rows={2}
              />
            </FieldRow>
          </div>
        )}
      />

      {c.pipeline_active && (
        <Section icon={Briefcase} title="Pipeline" action={
          <Link to="/spheresync-tasks?tab=pipeline" className="text-[12px] font-semibold text-primary hover:text-reop-teal-hover transition inline-flex items-center gap-1">
            Open pipeline <ExternalLink className="w-3 h-3" />
          </Link>
        }>
          <dl>
            <InfoRow label="Stage">{c.pipeline_stage_summary || 'Active'}</InfoRow>
            <InfoRow label="Last activity">{formatRelative(c.last_pipeline_activity)}</InfoRow>
          </dl>
        </Section>
      )}
    </div>
  );
}

// Friendly labels for known signal keys (everything else falls back to titlecasing the key).
const signalLabels: Record<string, string> = {
  life_event: 'Life event',
  market_zip: 'Market ZIP',
  activity_30d: 'Activity (30d)',
  activity_90d: 'Activity (90d)',
  days_in_stage: 'Days in stage',
  days_since_last_activity: 'Days since last touch',
  active_opportunity_stage: 'Open opportunity',
  ai_key_signals: 'AI key signals',
};

function isMeaningful(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// Translate an opaque signal key/string into a single plain-English line +
// a tone bucket. Negative ("zero / no / missing") = warn. Positive = good.
// Anything we don't recognize falls back to a humanized version of the raw
// key so the agent never sees `last_30d` or `zero_*` jargon.
type SignalTone = 'warn' | 'good' | 'info';

function humanizeSignalString(raw: string): { tone: SignalTone; text: string } {
  const lower = raw.toLowerCase().trim();
  // Negative signals — most common ai_key_signals values
  if (/zero[\s_-]*last[_\s]?30d|no[\s_-]*recent[\s_-]*engage|no[\s_-]*30/.test(lower) || lower === 'no_recent_engagement') {
    return { tone: 'warn', text: 'No conversations logged in the last 30 days' };
  }
  if (/zero[\s_-]*last[_\s]?90d|no[\s_-]*90/.test(lower)) {
    return { tone: 'warn', text: 'No conversations logged in the last 90 days' };
  }
  if (/no[\s_-]*life[\s_-]*event/.test(lower)) {
    return { tone: 'info', text: 'No life event captured' };
  }
  if (/no[\s_-]*active[\s_-]*opportunity|no[\s_-]*pipeline/.test(lower)) {
    return { tone: 'info', text: 'No active opportunity in pipeline' };
  }
  if (/stale[\s_-]*deal|stuck[\s_-]*deal/.test(lower)) {
    return { tone: 'warn', text: 'Opportunity has gone stale' };
  }
  // Positive signals
  if (/active[\s_-]*opportunity|in[\s_-]*pipeline|pipeline[\s_-]*active/.test(lower)) {
    return { tone: 'good', text: 'Active opportunity in pipeline' };
  }
  if (/pre[\s_-]?approved|approval[\s_-]*approved/.test(lower)) {
    return { tone: 'good', text: 'Pre-approved' };
  }
  if (/recent[\s_-]*engagement|fresh[\s_-]*touch/.test(lower)) {
    return { tone: 'good', text: 'Recent activity logged' };
  }
  // Fallback — humanize the raw text without exposing snake_case
  const cleaned = raw.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const text = cleaned.length === 0
    ? raw
    : cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  return { tone: 'info', text };
}

// Build a deduplicated, plain-English list of signals from:
//   1. ai_key_signals (already user-facing, just needs translation)
//   2. structured fields on priority_signals (life_event, active_opportunity_stage)
//   3. positive contact-level flags (pre-approved, watch flag)
// Everything else (raw activity counts, ZIPs, day counts) is intentionally
// dropped — those numbers belong in the score breakdown bars, not as
// separate technical labels.
function buildHumanSignals(
  signals: Record<string, unknown>,
  contact: ContactRecord,
): { tone: SignalTone; text: string }[] {
  const items: { tone: SignalTone; text: string }[] = [];

  const keySignals = Array.isArray(signals.ai_key_signals)
    ? (signals.ai_key_signals as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    : [];
  for (const raw of keySignals) {
    const humanized = humanizeSignalString(raw);
    if (!items.some((i) => i.text === humanized.text)) items.push(humanized);
  }

  const lifeEvent = typeof signals.life_event === 'string' ? signals.life_event.trim() : '';
  if (lifeEvent && !items.some((i) => /life event/i.test(i.text))) {
    items.push({ tone: 'good', text: `Life event: ${lifeEvent}` });
  }

  const stage = typeof signals.active_opportunity_stage === 'string' ? signals.active_opportunity_stage.trim() : '';
  if (stage && !items.some((i) => /pipeline|opportunity/i.test(i.text))) {
    const pretty = stage.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    items.push({ tone: 'good', text: `Active opportunity · ${pretty}` });
  }

  // VIP / pre-approval flags surfaced from contact (so the agent sees the
  // high-value positives even if Grok didn't echo them in ai_key_signals).
  if (contact.buyer_pre_approval_status === 'approved' && !items.some((i) => /pre[\s-]?approved/i.test(i.text))) {
    items.push({ tone: 'good', text: 'Pre-approved' });
  }
  if (contact.priority_watch_flag && !items.some((i) => /watch|attention/i.test(i.text))) {
    items.push({ tone: 'good', text: 'Flagged for personal attention' });
  }

  return items;
}

function SignalsView({ items }: { items: { tone: SignalTone; text: string }[] }) {
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
      {items.map((it, i) => {
        const styles =
          it.tone === 'warn'
            ? { wrap: 'bg-[hsl(45_93%_96%)] border-[hsl(45_70%_88%)]', icon: 'text-[hsl(35_80%_38%)]', Icon: AlertTriangle }
            : it.tone === 'good'
              ? { wrap: 'bg-[hsl(140_50%_96%)] border-[hsl(140_40%_82%)]', icon: 'text-[hsl(142_55%_28%)]', Icon: TrendingUp }
              : { wrap: 'bg-[hsl(210_20%_97%)] border-border', icon: 'text-muted-foreground', Icon: Activity };
        const Icon = styles.Icon;
        return (
          <li
            key={i}
            className={cn('flex items-start gap-2 text-[13px] text-reop-dark-blue leading-[1.45] px-3 py-2 rounded-md border', styles.wrap)}
          >
            <Icon className={cn('w-3.5 h-3.5 mt-[2px] shrink-0', styles.icon)} />
            <span>{it.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Order + display config for the score bars. Weights match compute-priority-
// scores (2026-05-18 rebuild): with an active opportunity the blend is
// 0.40 / 0.35 / 0.10 / 0.10 / 0.05 (pipeline / cadence / engagement /
// relationship / flags). Without one, the 0.40 pipeline weight redistributes
// proportionally across the others (cadence stays dominant).
const COMPONENT_ORDER: Array<{
  key: 'pipeline' | 'cadence' | 'engagement' | 'relationship' | 'flags';
  label: string;
  description: string;
}> = [
  { key: 'pipeline',     label: 'Pipeline',     description: 'Active opportunity stage — early stages weighted higher.' },
  { key: 'cadence',      label: 'Cadence',      description: 'This week’s SphereSync rotation letter + task completion.' },
  { key: 'engagement',   label: 'Engagement',   description: 'Recent gifts, event RSVPs, logged activity.' },
  { key: 'relationship', label: 'Relationship', description: 'Freshness of the last logged touch.' },
  { key: 'flags',        label: 'Flags',        description: 'VIP, pre-approval, watch flag, motivation.' },
];

function ComponentBar({
  label,
  description,
  value,
  capForBar,
  weightPct,
  tone,
}: {
  label: string;
  description: string;
  value: number;
  capForBar: number;
  weightPct: number;
  tone: 'primary' | 'muted';
}) {
  const pct = capForBar > 0 ? Math.min(100, Math.round((value / capForBar) * 100)) : 0;
  const fill = tone === 'primary' ? 'hsl(184 100% 34%)' : 'hsl(210 14% 70%)';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12.5px] font-semibold text-reop-dark-blue truncate" title={description}>
            {label}
          </span>
          <span className="text-[10.5px] text-muted-foreground bg-[hsl(210_20%_94%)] px-1.5 rounded-full whitespace-nowrap">
            {weightPct}% weight
          </span>
        </div>
        <span className="text-[12.5px] font-bold text-reop-dark-blue tabular-nums whitespace-nowrap">
          {Math.round(value)} <span className="text-[11px] text-muted-foreground">/ {capForBar}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[hsl(210_20%_94%)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
    </div>
  );
}

/**
 * CoachPane — set-based priority view (Phase 4, 2026-05-18 evening).
 *
 * No score. No weight bars. No /100 number. Just: is this contact a priority,
 * and why. Matches the contract: PRIORITY = pipeline OR cadence; otherwise
 * the section is hidden entirely (the contact isn't on the list).
 *
 * Signals read directly from priority_signals.{in_pipeline, in_cadence,
 * pipeline_stage, rotation_letter, rotation_kind, rotation_week} written by
 * the `set-based-v6` classifier in compute-priority-scores.
 */
function CoachPane({
  c,
  task,
  onRefreshScore,
  refreshing,
}: {
  c: ContactRecord;
  task?: SphereSyncTask | null;
  onRefreshScore: () => void;
  refreshing: boolean;
}) {
  const signals = (c.priority_signals ?? {}) as Record<string, unknown>;
  const tps = task?.ai_talking_points ?? [];

  const inPipeline = !!signals.in_pipeline;
  const inCadence = !!signals.in_cadence;
  const isPriority = inPipeline || inCadence;

  const pipelineStage = typeof signals.pipeline_stage === 'string' ? signals.pipeline_stage : null;
  const rotationLetter = typeof signals.rotation_letter === 'string' ? signals.rotation_letter : null;
  const rotationKind = signals.rotation_kind === 'text' ? 'text' : signals.rotation_kind === 'call' ? 'call' : null;
  const rotationWeek = typeof signals.rotation_week === 'number' ? signals.rotation_week : null;

  // Friendly stage labels for the bullet.
  const stageLabels: Record<string, string> = {
    conversation_active:    'Conversation active',
    opportunity_identified: 'Opportunity identified',
    consultation_completed: 'Consultation completed',
    client_secured:         'Client secured',
    active_opportunity:     'Active opportunity',
    under_contract:         'Under contract',
  };
  const stageLabel = pipelineStage ? (stageLabels[pipelineStage] ?? pipelineStage.replace(/_/g, ' ')) : null;

  return (
    <div className="space-y-4">
      <Section icon={Sparkles} title="Priority status">
        {isPriority ? (
          <>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Pill tone={inPipeline ? 'accent' : 'primary'}>
                <Sparkles className="w-3 h-3" />
                On your Priorities list
              </Pill>
              {c.priority_watch_flag && (
                <Pill tone="warn">
                  <AlertTriangle className="w-3 h-3" />
                  Watch
                </Pill>
              )}
              {c.priority_computed_at && (
                <span className="text-[11.5px] text-muted-foreground">
                  Updated {formatRelative(c.priority_computed_at)}
                </span>
              )}
            </div>

            <div className="text-[10.5px] uppercase tracking-[0.07em] font-bold text-muted-foreground mb-2">
              Why now
            </div>
            <ul className="m-0 p-0 list-none space-y-2">
              {inPipeline && stageLabel && (
                <li className="flex items-start gap-2 text-[13.5px] text-reop-dark-blue leading-[1.5]">
                  <TrendingUp className="w-3.5 h-3.5 mt-[3px] shrink-0 text-primary" />
                  <span>
                    <b className="font-semibold">Active opportunity</b> · {stageLabel}
                  </span>
                </li>
              )}
              {inCadence && rotationLetter && rotationWeek != null && (
                <li className="flex items-start gap-2 text-[13.5px] text-reop-dark-blue leading-[1.5]">
                  <Activity className="w-3.5 h-3.5 mt-[3px] shrink-0 text-primary" />
                  <span>
                    <b className="font-semibold">
                      Week {rotationWeek} {rotationKind === 'text' ? 'text' : 'call'} rotation
                    </b>{' '}
                    · letter {rotationLetter}
                  </span>
                </li>
              )}
            </ul>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground m-0 leading-[1.5]">
            Not on the Priorities list right now. They&apos;ll surface when an opportunity
            is added or when their letter ({c.category?.toUpperCase() || '—'}) comes up
            in the rotation.
          </p>
        )}

        <div className="mt-3 flex justify-end">
          <button
            onClick={onRefreshScore}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card text-[12px] font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {refreshing ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Refreshing…
              </span>
            ) : (
              <>
                <Activity className="w-3 h-3" />
                Re-classify
              </>
            )}
          </button>
        </div>
      </Section>

      {tps.length > 0 && (
        <Section icon={MessageSquare} title="Talking points for this week">
          <ul className="space-y-2 m-0 p-0 list-none">
            {tps.map((tp, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-reop-dark-blue leading-[1.5]">
                <span className="text-primary mt-[3px]">•</span>
                <span>{tp}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function ContactQuickSheet({
  contactId,
  task,
  open,
  onOpenChange,
  onEditContact,
}: ContactQuickSheetProps) {
  const { user } = useAuth();
  const { openStarter } = useConversationStarter();
  const agentId = user?.id ?? '';
  const { activities, loading: activitiesLoading, fetchActivities, addActivity, deleteActivity, updateActivity } =
    useContactActivities(contactId ?? '');
  const [tab, setTab] = useState<TabKey>('overview');
  const [refreshingScore, setRefreshingScore] = useState(false);
  const qc = useQueryClient();
  const updateMutation = useUpdateContact();

  const handleRefreshScore = async () => {
    if (!contactId || !user?.id) return;
    setRefreshingScore(true);
    try {
      const { error } = await supabase.functions.invoke('compute-priority-scores', {
        body: { agent_id: user.id, contact_ids: [contactId] },
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['contact', contactId] });
      toast.success('Score refreshed');
    } catch (err) {
      toast.error('Could not refresh score', {
        description: err instanceof Error ? err.message : 'Try again in a minute.',
      });
    } finally {
      setRefreshingScore(false);
    }
  };

  // Cached contact fetch — keyed by ['contact', id] so useUpdateContact's
  // optimistic writes flow into this view without a refetch round-trip.
  const contactQuery = useQuery({
    queryKey: ['contact', contactId],
    enabled: !!contactId && open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ContactRecord | null;
    },
  });
  const contact = contactQuery.data ?? null;
  const contactLoading = contactQuery.isLoading;

  // Reset tab + refresh activities when the sheet opens for a new contact.
  useEffect(() => {
    if (!open || !contactId) return;
    setTab('overview');
    fetchActivities();
  }, [open, contactId, fetchActivities]);

  const recentActivities = useMemo(() => activities.slice(0, 20), [activities]);
  const lastTouchTone =
    !contact?.last_activity_date ? undefined :
    Date.now() - new Date(contact.last_activity_date).getTime() > 1000 * 60 * 60 * 24 * 60 ? 'warn' :
    Date.now() - new Date(contact.last_activity_date).getTime() < 1000 * 60 * 60 * 24 * 14 ? 'success' :
    undefined;

  // Build a CommContact from whichever source has the data right now.
  // Prefer freshly loaded `contact`, fall back to `task.lead` while loading.
  const commContact = contact
    ? {
        id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone: contact.phone,
        email: contact.email,
        dnc: contact.dnc,
      }
    : task?.lead && task.lead_id
    ? {
        id: task.lead_id,
        first_name: task.lead.first_name,
        last_name: task.lead.last_name,
        phone: task.lead.phone,
        email: null,
        dnc: task.lead.dnc,
      }
    : null;

  const phone = contact?.phone ?? task?.lead.phone ?? null;
  const email = contact?.email ?? null;
  const dnc = contact?.dnc ?? task?.lead.dnc ?? false;

  // Header CTAs route through the conversation-starter modal so the agent
  // sees curated talk tracks + opener templates before the call/text/email
  // gets sent. The modal handles activity logging on its own.
  const handleCall = () => commContact && openStarter('call', commContact);
  const handleText = () => commContact && openStarter('text', commContact);
  const handleEmail = () => commContact && openStarter('email', commContact);
  const handleEdit = () => contactId && onEditContact?.(contactId);

  if (!contactId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 overflow-y-auto bg-[hsl(210_17%_98%)]"
      >
        {/* HERO */}
        <SheetHeader className="relative px-5 sm:px-6 pt-7 pb-7 bg-card border-b border-border space-y-6">
          <div
            aria-hidden
            className="absolute right-0 top-0 w-[320px] h-[320px] pointer-events-none"
            style={{ background: 'radial-gradient(circle at top right, hsl(184 100% 34% / 0.10), transparent 65%)' }}
          />

          {/* identity row + Edit button */}
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                title={
                  contact?.category
                    ? `Last name ${contact.category} — SphereSync rotation slot (not a priority rank)`
                    : undefined
                }
                className="w-[56px] h-[56px] rounded-full bg-reop-dark-blue text-white flex items-center justify-center font-semibold text-[19px] shrink-0 ring-2 ring-reop-teal-soft border-[3px] border-white shadow-sm"
              >
                {getInitials(contact ?? task?.lead ?? {})}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-[clamp(1.15rem,1.4vw+0.6rem,1.45rem)] font-semibold tracking-tighter leading-[1.15] text-reop-dark-blue truncate">
                  {fullName(contact ?? task?.lead ?? {})}
                </SheetTitle>
                <SheetDescription className="sr-only">Contact detail panel</SheetDescription>

                {/* phone · email inline (tap-to-call links, no heavy cards) */}
                {(phone || email) && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground min-w-0">
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="text-reop-dark-blue hover:text-primary truncate"
                      >
                        {formatPhone(phone)}
                      </a>
                    )}
                    {phone && email && <span className="opacity-50">·</span>}
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className="text-reop-dark-blue hover:text-primary truncate min-w-0"
                      >
                        {email}
                      </a>
                    )}
                  </div>
                )}

                {/* location — suppressed when columns hold CSV-import junk */}
                {(() => {
                  const loc = cleanLocation(contact);
                  if (!loc) return null;
                  return (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {loc}
                    </div>
                  );
                })()}
              </div>
            </div>

            {onEditContact && (
              <button
                onClick={handleEdit}
                aria-label="Edit contact"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-[12.5px] font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
          </div>

          {/* status chips — only the calls-to-attention. Tags + the rotation
              letter live elsewhere; this row stays tight. */}
          {(() => {
            const birthdayDays = daysUntilAnnual(contact?.birthday);
            const annivDays = daysUntilAnnual(contact?.home_anniversary);
            const trend = contact?.engagement_trend && trendStyles[contact.engagement_trend]
              ? trendStyles[contact.engagement_trend]
              : null;
            const hasAny =
              contact?.pipeline_active ||
              contact?.priority_watch_flag ||
              trend ||
              (birthdayDays != null && birthdayDays <= 14) ||
              (annivDays != null && annivDays <= 14);
            if (!hasAny) return null;
            return (
              <div className="relative flex items-center gap-1.5 flex-wrap">
                {contact?.pipeline_active && (
                  <Pill tone="dark">
                    <Briefcase className="w-2.5 h-2.5" />
                    In pipeline
                  </Pill>
                )}
                {contact?.priority_watch_flag && (
                  <Pill tone="warn">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    Watch
                  </Pill>
                )}
                {trend && (() => {
                  const Icon = trend.icon;
                  return (
                    <Pill tone={trend.tone}>
                      <Icon className="w-2.5 h-2.5" />
                      {trend.label}
                    </Pill>
                  );
                })()}
                {birthdayDays != null && birthdayDays <= 14 && (
                  <Pill tone="primary">
                    <Cake className="w-2.5 h-2.5" />
                    {birthdayDays === 0 ? 'Birthday today' : birthdayDays === 1 ? 'Birthday tomorrow' : `Birthday in ${birthdayDays}d`}
                  </Pill>
                )}
                {annivDays != null && annivDays <= 14 && (
                  <Pill tone="accent">
                    <Gift className="w-2.5 h-2.5" />
                    {annivDays === 0 ? 'Home anniversary today' : `Home anniv in ${annivDays}d`}
                  </Pill>
                )}
              </div>
            );
          })()}

          {/* DNC banner — informational, never a block */}
          {dnc && <DncBanner name={fullName(contact ?? task?.lead ?? {})} />}

          {/* Primary actions — Call / Text / Email. Each routes through the
              conversation-starter modal so the agent gets channel-appropriate
              talk tracks. Logging is one tab away in Touchpoints; the
              standalone Log button was redundant with that tab + the modal's
              own activity logging, so it's been removed. */}
          <div className="relative flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCall}
              disabled={!commContact || !agentId || !phone}
              title={dnc ? 'Call (DNC — sphere outreach OK under the EBR exemption)' : 'Call'}
              className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-lg bg-primary text-primary-foreground text-[13.5px] font-semibold hover:bg-reop-teal-hover transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Phone className="w-4 h-4" />
              Call
            </button>
            <button
              type="button"
              onClick={handleText}
              disabled={!commContact || !agentId || !phone}
              className="inline-flex items-center gap-1.5 h-11 px-3.5 rounded-lg border border-border bg-card text-[13px] font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Text
            </button>
            <button
              type="button"
              onClick={handleEmail}
              disabled={!commContact || !agentId || !email}
              className="inline-flex items-center gap-1.5 h-11 px-3.5 rounded-lg border border-border bg-card text-[13px] font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </button>
          </div>

          {/* compact 3-cell stat strip — Sphere strength was confusing as
              "—" when unset; relationship_strength remains editable in the
              Sphere & relationship section below where the agent has context. */}
          <div className="relative pt-5 border-t border-border grid grid-cols-3 gap-y-4 gap-x-4">
            {[
              {
                label: 'Last touch',
                value: formatRelative(contact?.last_activity_date),
                tone: lastTouchTone,
              },
              { label: 'Touchpoints', value: contact?.activity_count ?? 0 },
              { label: 'Added', value: formatDate(contact?.created_at) },
            ].map((it) => (
              <div key={it.label} className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] uppercase tracking-[0.07em] text-muted-foreground font-bold">
                  {it.label}
                </span>
                <span className={cn(
                  'text-[13.5px] font-semibold truncate',
                  it.tone === 'warn' ? 'text-[hsl(35_80%_38%)]' :
                  it.tone === 'success' ? 'text-[hsl(142_55%_28%)]' :
                  it.tone === 'primary' ? 'text-primary' :
                  'text-reop-dark-blue',
                )}>
                  {it.value}
                </span>
              </div>
            ))}
          </div>
        </SheetHeader>

        {/* TAB BAR */}
        <div className="sticky top-0 z-10 bg-[hsl(210_17%_98%)] border-b border-border px-4 flex gap-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {([
            { key: 'overview',    label: 'Overview',    icon: User },
            { key: 'touchpoints', label: 'Touchpoints', icon: Activity, count: activities.length || undefined },
            { key: 'coach',       label: 'Coach',       icon: Sparkles },
          ] as { key: TabKey; label: string; icon: typeof User; count?: number }[]).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2.5 -mb-px text-[13px] whitespace-nowrap transition border-b-2',
                  active
                    ? 'text-primary border-primary font-semibold'
                    : 'text-muted-foreground border-transparent hover:text-reop-dark-blue font-medium',
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.count != null && (
                  <span className={cn(
                    'inline-flex items-center px-1.5 rounded-full text-[10px] font-semibold',
                    active ? 'bg-reop-teal-soft text-primary' : 'bg-[hsl(210_20%_93%)] text-muted-foreground',
                  )}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB CONTENT */}
        <div className="px-4 sm:px-5 py-5">
          {contactLoading && !contact ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading contact…</div>
          ) : !contact ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Contact record unavailable.
            </div>
          ) : (
            <>
              {tab === 'overview' && <OverviewPane c={contact} mutation={updateMutation} />}
              {tab === 'coach' && (
                <CoachPane
                  c={contact}
                  task={task}
                  onRefreshScore={handleRefreshScore}
                  refreshing={refreshingScore}
                />
              )}
              {tab === 'touchpoints' && (
                <TouchpointsPane
                  activities={recentActivities}
                  loading={activitiesLoading}
                  legacyNote={contact.notes?.trim() || null}
                  onAdd={async (input) => {
                    try {
                      await addActivity({
                        activity_type: input.activity_type,
                        notes: input.notes,
                        activity_date: input.activity_date,
                      });
                      toast.success('Touchpoint logged');
                    } catch (err) {
                      toast.error('Could not save touchpoint', {
                        description: err instanceof Error ? err.message : undefined,
                      });
                      throw err;
                    }
                  }}
                  onDelete={async (a) => {
                    try {
                      await deleteActivity(a.id);
                      toast.success('Touchpoint removed');
                    } catch (err) {
                      toast.error('Could not delete', {
                        description: err instanceof Error ? err.message : undefined,
                      });
                      throw err;
                    }
                  }}
                  onEdit={async (a, updates) => {
                    try {
                      await updateActivity(a.id, {
                        activity_type: updates.activity_type,
                        notes: updates.notes,
                        activity_date: updates.activity_date,
                      });
                      toast.success('Touchpoint updated');
                    } catch (err) {
                      toast.error('Could not update', {
                        description: err instanceof Error ? err.message : undefined,
                      });
                      throw err;
                    }
                  }}
                />
              )}

              {tab === 'overview' && (
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-[12px] text-muted-foreground">
                  <span>
                    Updated {formatRelative(contact.updated_at)}
                    {contact.dnc_last_checked && ` · DNC checked ${formatRelative(contact.dnc_last_checked)}`}
                  </span>
                  <Link
                    to={`/spheresync-tasks?tab=database&contact=${contact.id}`}
                    onClick={() => onOpenChange(false)}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:text-reop-teal-hover transition"
                  >
                    Full record <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

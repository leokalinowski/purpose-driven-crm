/**
 * EventRSVPsPanel — replaces RSVPManagement for the agent-facing
 * EventDetail page.
 *
 * Why a new component:
 *
 *   - The previous version wrapped everything in a giant Card with an
 *     "RSVP Management" title and a redundant 4-stat tile strip (the
 *     EventDetail page already shows RSVP totals at the top).
 *   - 5 tabs (All / Confirmed / Waitlist / Checked In / Not Checked In)
 *     duplicated information ("Not Checked In" = All − Checked In).
 *   - Status logic conflated `rsvp.status` with `check_in_status`,
 *     making the badge colors arbitrary.
 *   - Walk-in dialog used default Card chrome that didn't match the new
 *     aesthetic.
 *
 * The new design:
 *   - Top action bar: search, filter chips (3 mutually-exclusive buckets:
 *     Going / Waitlist / Cancelled), then check-in chip (a *separate*
 *     toggle, not a bucket) + Walk-in / Public link / Export CSV.
 *   - One-line compact rows with avatar initials, name + contact, status
 *     pills (RSVP status + check-in status as two distinct chips), and
 *     a single inline "Check in" CTA.
 *   - Custom answers expand inline.
 *   - Walk-in dialog rebuilt with token chrome.
 *
 * Phase 5 of the Events comprehensive sweep, third iteration.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2, Search, Download, ExternalLink, ChevronDown, UserPlus,
  Users, Clock, X, Save, Mail, Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useRSVP, type RSVP } from '@/hooks/useRSVP';
import { useRSVPQuestions, type RSVPAnswer, type RSVPQuestion } from '@/hooks/useRSVPQuestions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EventRSVPsPanelProps {
  eventId: string;
  publicSlug?: string;
  maxCapacity?: number;
}

type StatusFilter = 'all' | 'confirmed' | 'waitlist' | 'cancelled';

export function EventRSVPsPanel({ eventId, publicSlug, maxCapacity }: EventRSVPsPanelProps) {
  const { getEventRSVPs, checkInRSVP, addWalkInAttendee } = useRSVP();
  const { getEventAnswers, getEventQuestions } = useRSVPQuestions();

  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [answers, setAnswers] = useState<RSVPAnswer[]>([]);
  const [questions, setQuestions] = useState<RSVPQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  /** Independent toggle layered on top of the status filter — agents
   *  often want "show me only people who haven't checked in yet" while
   *  still seeing waitlisters too. */
  const [pendingOnly, setPendingOnly] = useState(false);
  const [expandedRsvps, setExpandedRsvps] = useState<Set<string>>(new Set());

  const [showWalkInDialog, setShowWalkInDialog] = useState(false);
  const [walkInForm, setWalkInForm] = useState({ name: '', email: '', phone: '', guest_count: 1 });
  const [walkInCheckedIn, setWalkInCheckedIn] = useState(true);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);

  // useRSVP / useRSVPQuestions return fresh function references on every
  // render (no useCallback inside the hooks). If we put those refs in the
  // dep array of `loadAll`, `loadAll` changes every render, `useEffect`
  // re-runs every render, setState fires, parent re-renders, and we loop —
  // which is what caused the flashing. Hold the latest refs in a ref and
  // depend ONLY on `eventId`. Same pattern the original RSVPManagement used.
  const fetchersRef = useRef({ getEventRSVPs, getEventAnswers, getEventQuestions });
  fetchersRef.current = { getEventRSVPs, getEventAnswers, getEventQuestions };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const f = fetchersRef.current;
      const [rsvpData, answerData, questionData] = await Promise.all([
        f.getEventRSVPs(eventId),
        f.getEventAnswers(eventId).catch(() => []),
        f.getEventQuestions(eventId).catch(() => []),
      ]);
      setRsvps(rsvpData);
      setAnswers(answerData);
      setQuestions(questionData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load RSVPs';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Derived data ──────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all: rsvps.length,
    confirmed: rsvps.filter(r => r.status === 'confirmed').length,
    waitlist: rsvps.filter(r => r.status === 'waitlist').length,
    cancelled: rsvps.filter(r => r.status === 'cancelled').length,
    checkedIn: rsvps.filter(r => r.check_in_status === 'checked_in').length,
    pending: rsvps.filter(r => r.status === 'confirmed' && r.check_in_status !== 'checked_in').length,
  }), [rsvps]);

  const answersByRsvp = useMemo(() => {
    const map = new Map<string, RSVPAnswer[]>();
    for (const a of answers) {
      const list = map.get(a.rsvp_id) ?? [];
      list.push(a);
      map.set(a.rsvp_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [answers]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rsvps.filter((rsvp) => {
      // Search
      if (q) {
        const hay = `${rsvp.name} ${rsvp.email} ${rsvp.phone ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Status filter
      if (statusFilter !== 'all' && rsvp.status !== statusFilter) return false;
      // Pending check-in toggle (only meaningful for confirmed)
      if (pendingOnly && (rsvp.status !== 'confirmed' || rsvp.check_in_status === 'checked_in')) return false;
      return true;
    }).sort((a, b) => {
      // Recent RSVPs first.
      return new Date(b.rsvp_date).getTime() - new Date(a.rsvp_date).getTime();
    });
  }, [rsvps, searchQuery, statusFilter, pendingOnly]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleCheckIn = async (rsvpId: string) => {
    try {
      await checkInRSVP(rsvpId);
      toast.success('Checked in');
      loadAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check in';
      toast.error(message);
    }
  };

  const handleAddWalkIn = async () => {
    if (!walkInForm.name || !walkInForm.email) {
      toast.error('Name and email are required');
      return;
    }
    setWalkInSubmitting(true);
    try {
      await addWalkInAttendee(eventId, {
        name: walkInForm.name,
        email: walkInForm.email,
        phone: walkInForm.phone || undefined,
        guest_count: walkInForm.guest_count,
      }, walkInCheckedIn);
      toast.success('Walk-in added');
      setShowWalkInDialog(false);
      setWalkInForm({ name: '', email: '', phone: '', guest_count: 1 });
      setWalkInCheckedIn(true);
      loadAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add walk-in';
      toast.error(message);
    } finally {
      setWalkInSubmitting(false);
    }
  };

  const toggleExpanded = (rsvpId: string) => {
    setExpandedRsvps((prev) => {
      const next = new Set(prev);
      if (next.has(rsvpId)) next.delete(rsvpId);
      else next.add(rsvpId);
      return next;
    });
  };

  const exportToCSV = () => {
    const questionColumns = questions.map(q => q.question_text);
    const headers = ['Name', 'Email', 'Phone', 'Guest Count', 'Status', 'RSVP Date', 'Check-In Status', ...questionColumns];
    const rows = filtered.map((rsvp) => {
      const answerMap = new Map((answersByRsvp.get(rsvp.id) ?? []).map(a => [a.question_id, a.answer_text]));
      return [
        rsvp.name,
        rsvp.email,
        rsvp.phone ?? '',
        rsvp.guest_count.toString(),
        rsvp.status,
        format(new Date(rsvp.rsvp_date), 'MM/dd/yyyy HH:mm'),
        rsvp.check_in_status,
        ...questions.map(q => answerMap.get(q.id) ?? ''),
      ];
    });
    const csvContent = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rsvps-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const publicUrl = publicSlug ? `${window.location.origin}/event/${publicSlug}` : null;

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // ── Empty state — no RSVPs at all ─────────────────────────────────────
  if (rsvps.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-8 sm:p-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-reop-teal-soft text-primary mb-4">
          <Users className="w-5 h-5" />
        </div>
        <h3 className="text-base sm:text-lg font-semibold mb-2">No RSVPs yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5 leading-relaxed">
          {publicUrl
            ? 'Share the public RSVP link or send the invitation email to start collecting responses.'
            : 'Publish this event first to generate the public RSVP link.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={() => setShowWalkInDialog(true)} className="gap-1.5">
            <UserPlus className="w-4 h-4" />
            Add walk-in
          </Button>
          {publicUrl && (
            <Button variant="outline" asChild className="gap-1.5">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
                Open public page
              </a>
            </Button>
          )}
        </div>
        {showWalkInDialog && (
          <WalkInDialog
            open={showWalkInDialog}
            onOpenChange={setShowWalkInDialog}
            form={walkInForm}
            setForm={setWalkInForm}
            checkedIn={walkInCheckedIn}
            setCheckedIn={setWalkInCheckedIn}
            submitting={walkInSubmitting}
            onSubmit={handleAddWalkIn}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar — search + actions */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setShowWalkInDialog(true)} className="gap-1.5 h-9">
            <UserPlus className="w-3.5 h-3.5" />
            Walk-in
          </Button>
          {publicUrl && (
            <Button variant="outline" size="sm" asChild className="gap-1.5 h-9">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
                Public page
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-1.5 h-9">
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Filter chip row + pending toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex flex-wrap gap-1.5">
          <FilterChip label="All"        count={counts.all}       active={statusFilter === 'all'}       onClick={() => setStatusFilter('all')} />
          <FilterChip label="Going"      count={counts.confirmed} active={statusFilter === 'confirmed'} onClick={() => setStatusFilter('confirmed')} tone="green" />
          <FilterChip label="Waitlist"   count={counts.waitlist}  active={statusFilter === 'waitlist'}  onClick={() => setStatusFilter('waitlist')}  tone="amber" />
          {counts.cancelled > 0 && (
            <FilterChip label="Cancelled" count={counts.cancelled} active={statusFilter === 'cancelled'} onClick={() => setStatusFilter('cancelled')} tone="muted" />
          )}
        </div>
        <button
          type="button"
          onClick={() => setPendingOnly((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[12px] font-medium transition',
            pendingOnly
              ? 'border-primary bg-reop-teal-soft text-primary'
              : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
          )}
          aria-pressed={pendingOnly}
        >
          <Clock className="w-3.5 h-3.5" />
          Not yet checked in
          <span className={cn(
            'inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-semibold',
            pendingOnly ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}>{counts.pending}</span>
        </button>
      </div>

      {/* Capacity bar — shows up only when capacity is set */}
      {maxCapacity != null && maxCapacity > 0 && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground font-medium">Capacity</span>
              <span className={cn('font-semibold', counts.confirmed >= maxCapacity ? 'text-amber-700' : 'text-foreground')}>
                {counts.confirmed} / {maxCapacity}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full transition-all', counts.confirmed >= maxCapacity ? 'bg-amber-500' : 'bg-primary')}
                style={{ width: `${Math.min(100, (counts.confirmed / maxCapacity) * 100)}%` }}
              />
            </div>
          </div>
          {counts.checkedIn > 0 && (
            <div className="text-xs text-right shrink-0">
              <div className="text-muted-foreground">Checked in</div>
              <div className="font-semibold text-reop-green">{counts.checkedIn}</div>
            </div>
          )}
        </div>
      )}

      {/* RSVP list */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No RSVPs match the current filters.</p>
          {(searchQuery || statusFilter !== 'all' || pendingOnly) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPendingOnly(false); }}
              className="mt-3 text-xs text-primary"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {filtered.map((rsvp) => (
            <RSVPRow
              key={rsvp.id}
              rsvp={rsvp}
              answers={answersByRsvp.get(rsvp.id) ?? []}
              expanded={expandedRsvps.has(rsvp.id)}
              onToggleExpand={() => toggleExpanded(rsvp.id)}
              onCheckIn={() => handleCheckIn(rsvp.id)}
            />
          ))}
        </div>
      )}

      {/* Walk-in dialog */}
      {showWalkInDialog && (
        <WalkInDialog
          open={showWalkInDialog}
          onOpenChange={setShowWalkInDialog}
          form={walkInForm}
          setForm={setWalkInForm}
          checkedIn={walkInCheckedIn}
          setCheckedIn={setWalkInCheckedIn}
          submitting={walkInSubmitting}
          onSubmit={handleAddWalkIn}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function FilterChip({
  label, count, active, onClick, tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: 'green' | 'amber' | 'muted';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] font-medium transition',
        active
          ? 'border-primary bg-reop-teal-soft text-primary'
          : 'border-border bg-card text-foreground hover:bg-muted/40',
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-semibold',
          active
            ? 'bg-primary/15 text-primary'
            : tone === 'green'
              ? 'bg-green-100 text-green-700'
              : tone === 'amber'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function RSVPRow({
  rsvp, answers, expanded, onToggleExpand, onCheckIn,
}: {
  rsvp: RSVP;
  answers: RSVPAnswer[];
  expanded: boolean;
  onToggleExpand: () => void;
  onCheckIn: () => void;
}) {
  const isCheckedIn = rsvp.check_in_status === 'checked_in';
  const isCancelled = rsvp.status === 'cancelled';
  const isWaitlist = rsvp.status === 'waitlist';
  const showCheckInBtn = rsvp.status === 'confirmed' && !isCheckedIn;

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition">
        {/* Avatar */}
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold text-reop-dark-blue flex-shrink-0"
          style={{ background: 'hsl(184 50% 88%)' }}
          aria-hidden
        >
          {initialsFor(rsvp.name)}
        </span>

        {/* Identity + secondary line */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('text-sm font-semibold truncate', isCancelled && 'line-through text-muted-foreground')}>
              {rsvp.name}
            </span>
            {/* Status pill — only render when not the default "confirmed" */}
            {isCancelled && <StatusChip kind="cancelled" />}
            {isWaitlist && <StatusChip kind="waitlist" />}
            {isCheckedIn && <StatusChip kind="checked_in" />}
            {answers.length > 0 && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/70"
                aria-expanded={expanded}
              >
                +{answers.length} {answers.length === 1 ? 'answer' : 'answers'}
                <ChevronDown className={cn('w-2.5 h-2.5 transition', expanded && 'rotate-180')} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
            <span className="inline-flex items-center gap-1">
              <Mail className="w-3 h-3" />
              <a href={`mailto:${rsvp.email}`} className="hover:text-foreground hover:underline truncate">
                {rsvp.email}
              </a>
            </span>
            {rsvp.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <a href={`tel:${rsvp.phone}`} className="hover:text-foreground hover:underline">
                  {rsvp.phone}
                </a>
              </span>
            )}
            <span>
              {rsvp.guest_count}{' '}
              {rsvp.guest_count === 1 ? 'guest' : 'guests'} · {format(new Date(rsvp.rsvp_date), 'MMM d')}
            </span>
            {rsvp.checked_in_at && (
              <span className="text-reop-green">
                Checked in {format(new Date(rsvp.checked_in_at), 'MMM d, h:mm a')}
              </span>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center gap-1 shrink-0">
          {showCheckInBtn && (
            <Button size="sm" variant="outline" onClick={onCheckIn} className="gap-1.5 h-8">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Check in
            </Button>
          )}
        </div>
      </div>

      {/* Expanded custom answers */}
      {expanded && answers.length > 0 && (
        <div className="px-4 pb-4 pt-0 -mt-1 bg-muted/20 border-t border-border/40">
          <div className="grid gap-2 mt-3 sm:grid-cols-2">
            {answers.map((a) => (
              <div key={a.id} className="text-xs">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">
                  {a.question_text}
                </div>
                <div className="text-foreground">{a.answer_text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ kind }: { kind: 'confirmed' | 'waitlist' | 'cancelled' | 'checked_in' }) {
  const cfg: Record<typeof kind, { label: string; cls: string }> = {
    confirmed:   { label: 'Going',      cls: 'bg-[hsl(140_50%_94%)] text-[hsl(140_50%_30%)] border border-[hsl(140_40%_85%)]' },
    waitlist:    { label: 'Waitlist',   cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
    cancelled:   { label: 'Cancelled',  cls: 'bg-muted text-muted-foreground border border-border' },
    checked_in:  { label: 'Checked in', cls: 'bg-reop-teal-soft text-primary border border-primary/30' },
  };
  const c = cfg[kind];
  return (
    <span className={cn('inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded', c.cls)}>
      {c.label}
    </span>
  );
}

function WalkInDialog({
  open, onOpenChange, form, setForm, checkedIn, setCheckedIn, submitting, onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { name: string; email: string; phone: string; guest_count: number };
  setForm: (
    next:
      | { name: string; email: string; phone: string; guest_count: number }
      | ((prev: { name: string; email: string; phone: string; guest_count: number }) => { name: string; email: string; phone: string; guest_count: number })
  ) => void;
  checkedIn: boolean;
  setCheckedIn: (v: boolean) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add walk-in attendee</DialogTitle>
          <DialogDescription>
            Add a guest manually — from a paper signup, Eventbrite import, or a day-of walk-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 bg-card border border-border rounded-lg p-3">
            <div className="min-w-0">
              <Label htmlFor="walkin-checkin-toggle" className="text-sm font-medium">Mark as checked in</Label>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">
                {checkedIn
                  ? 'Receives the thank-you email after the event.'
                  : 'Receives the no-show email after the event.'}
              </p>
            </div>
            <Switch id="walkin-checkin-toggle" checked={checkedIn} onCheckedChange={setCheckedIn} />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label htmlFor="walkin-name" className="text-xs text-muted-foreground mb-1.5 block">
                Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="walkin-name"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="walkin-email" className="text-xs text-muted-foreground mb-1.5 block">
                Email <span className="text-red-600">*</span>
              </Label>
              <Input
                id="walkin-email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="walkin-phone" className="text-xs text-muted-foreground mb-1.5 block">Phone</Label>
                <Input
                  id="walkin-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="walkin-guests" className="text-xs text-muted-foreground mb-1.5 block">Guests</Label>
                <Input
                  id="walkin-guests"
                  type="number"
                  min={1}
                  value={form.guest_count}
                  onChange={(e) => setForm((prev) => ({ ...prev, guest_count: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-3.5 h-3.5 mr-1.5" />
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting} className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {submitting ? 'Adding…' : 'Add attendee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

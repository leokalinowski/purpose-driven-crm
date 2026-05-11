/**
 * BulkCaptureSheet — fast keyboard-driven editor for adding birthdays,
 * spouse birthdays, home anniversaries, and gift preferences to contacts.
 *
 * Two flows in one sheet:
 *   1. **Search → pick a specific contact**. The bar at the top of the
 *      sheet searches every contact the agent has. Selecting one loads
 *      whatever data is already on file so the agent can fill in just
 *      what's missing.
 *   2. **Power through the alphabetical backlog** (default). When no
 *      contact is selected via search, we iterate `useDelightMissingData`
 *      — contacts with all three date fields NULL — one at a time. The
 *      keyboard shortcuts (⌘+Enter save & next, ⌘+→ skip, Esc close)
 *      stay active.
 *
 * Saves through `useUpdateContactDelight`. Only fields the agent typed
 * are sent in the patch; existing values stay intact. Saving a manually
 * picked contact returns the agent to the queue at their current
 * position so they can keep going if they want.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, ChevronRight, SkipForward, Check, Loader2, Cake, Heart, Home, Sparkles,
  Search, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  useDelightMissingData,
  useUpdateContactDelight,
  type ContactMissingData,
} from '@/hooks/useDelight';
import { useContacts } from '@/hooks/useContacts';
import { cn } from '@/lib/utils';

interface BulkCaptureSheetProps {
  open: boolean;
  onClose: () => void;
}

interface DraftFields {
  birthday: string;
  spouse_name: string;
  spouse_birthday: string;
  home_anniversary: string;
  gift_preferences: string;
}

/**
 * Mirror of the fields we care about, drawn from the loose Contact row
 * (`useContacts` returns `select('*')` so all DB columns are present even
 * when the TS interface doesn't declare them).
 */
interface ContactDelightFieldsView {
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

const EMPTY_DRAFT: DraftFields = {
  birthday: '',
  spouse_name: '',
  spouse_birthday: '',
  home_anniversary: '',
  gift_preferences: '',
};

function fullName(c: { first_name: string | null; last_name: string | null }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown contact';
}

function initialsOf(c: { first_name: string | null; last_name: string | null }): string {
  return ((c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')).toUpperCase() || '·';
}

function asDelightView(raw: Record<string, unknown>): ContactDelightFieldsView {
  return {
    id: String(raw.id ?? ''),
    first_name: (raw.first_name as string | null) ?? null,
    last_name: (raw.last_name as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    category: (raw.category as string | null) ?? null,
    birthday: (raw.birthday as string | null) ?? null,
    spouse_name: (raw.spouse_name as string | null) ?? null,
    spouse_birthday: (raw.spouse_birthday as string | null) ?? null,
    home_anniversary: (raw.home_anniversary as string | null) ?? null,
    gift_preferences: (raw.gift_preferences as string | null) ?? null,
  };
}

function buildDraftFrom(c: ContactDelightFieldsView): DraftFields {
  return {
    birthday: c.birthday ?? '',
    spouse_name: c.spouse_name ?? '',
    spouse_birthday: c.spouse_birthday ?? '',
    home_anniversary: c.home_anniversary ?? '',
    gift_preferences: c.gift_preferences ?? '',
  };
}

export function BulkCaptureSheet({ open, onClose }: BulkCaptureSheetProps) {
  const { toast } = useToast();
  const { data: missing = [], isLoading: missingLoading } = useDelightMissingData(250);
  const { allContacts } = useContacts();
  const updateContact = useUpdateContactDelight();

  // ── Queue state (alphabetical backlog) ────────────────────────────────
  const [queue, setQueue] = useState<ContactMissingData[]>([]);
  const [position, setPosition] = useState(0);
  const [saved, setSaved] = useState(0);
  const [skipped, setSkipped] = useState(0);

  // ── Manual selection (search → pick) ──────────────────────────────────
  // When set, this contact overrides the queue's current contact. After
  // saving / dismissing, we clear it and return to the queue.
  const [manual, setManual] = useState<ContactDelightFieldsView | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Form draft ────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT);

  // Reset every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setQueue(missing);
    setPosition(0);
    setSaved(0);
    setSkipped(0);
    setManual(null);
    setSearchQuery('');
    setSearchOpen(false);
    setDraft(EMPTY_DRAFT);
  }, [open, missing]);

  // ── Active contact: manual override OR queue[position] ────────────────
  const queueCurrent = queue[position] ?? null;
  const activeContact: ContactDelightFieldsView | null = manual ?? queueCurrent
    ? manual ?? (queueCurrent ? {
      id: queueCurrent!.id,
      first_name: queueCurrent!.first_name,
      last_name: queueCurrent!.last_name,
      email: queueCurrent!.email,
      category: queueCurrent!.category,
      birthday: queueCurrent!.birthday,
      spouse_name: queueCurrent!.spouse_name,
      spouse_birthday: queueCurrent!.spouse_birthday,
      home_anniversary: queueCurrent!.home_anniversary,
      gift_preferences: queueCurrent!.gift_preferences,
    } : null)
    : null;

  // Re-build draft each time the active contact changes.
  useEffect(() => {
    if (!activeContact) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    setDraft(buildDraftFrom(activeContact));
  }, [activeContact?.id, manual?.id]);

  // Auto-focus the first date input on each contact transition.
  const firstInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open || searchOpen) return;
    const t = setTimeout(() => firstInputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [open, activeContact?.id, searchOpen]);

  // ── Search results ────────────────────────────────────────────────────
  const searchResults = useMemo<ContactDelightFieldsView[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const list = (allContacts ?? []) as unknown as Array<Record<string, unknown>>;
    return list
      .filter((c) => {
        const name = fullName({
          first_name: (c.first_name as string | null) ?? null,
          last_name: (c.last_name as string | null) ?? null,
        }).toLowerCase();
        const email = (c.email as string | null)?.toLowerCase() ?? '';
        const phone = (c.phone as string | null)?.toLowerCase() ?? '';
        return name.includes(q) || email.includes(q) || phone.includes(q);
      })
      .slice(0, 10)
      .map(asDelightView);
  }, [searchQuery, allContacts]);

  // Whenever the agent is typing, keep the dropdown open.
  useEffect(() => {
    if (searchQuery.trim().length > 0) setSearchOpen(true);
  }, [searchQuery]);

  // ── Actions ───────────────────────────────────────────────────────────

  const finish = () => {
    if (saved > 0 || skipped > 0) {
      const remaining = Math.max(queue.length - position, 0);
      toast({
        title: 'Backlog reduced',
        description: `${saved} captured · ${skipped} skipped${remaining > 0 ? ` · ${remaining} left in queue` : ''}.`,
      });
    }
    onClose();
  };

  const advance = () => {
    if (manual) {
      // Saving a manually-picked contact returns to the queue, doesn't advance position.
      setManual(null);
      setSearchQuery('');
      return;
    }
    if (position + 1 >= queue.length) {
      finish();
    } else {
      setPosition((p) => p + 1);
    }
  };

  const handleSave = async () => {
    if (!activeContact) return;
    const patch: Record<string, string> = {};
    let touched = 0;
    // Only include fields the agent actually filled / changed.
    if (draft.birthday) { patch.birthday = draft.birthday; touched++; }
    if (draft.spouse_name) { patch.spouse_name = draft.spouse_name; touched++; }
    if (draft.spouse_birthday) { patch.spouse_birthday = draft.spouse_birthday; touched++; }
    if (draft.home_anniversary) { patch.home_anniversary = draft.home_anniversary; touched++; }
    if (draft.gift_preferences) { patch.gift_preferences = draft.gift_preferences; touched++; }

    if (touched === 0) {
      // Treat as a skip so the position still advances.
      handleSkip();
      return;
    }

    try {
      await updateContact.mutateAsync({ contact_id: activeContact.id, patch });
      setSaved((n) => n + 1);
      advance();
    } catch (err) {
      toast({
        title: 'Couldn\'t save',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      });
    }
  };

  const handleSkip = () => {
    if (manual) {
      setManual(null);
      setSearchQuery('');
      return;
    }
    setSkipped((n) => n + 1);
    advance();
  };

  const handlePickContact = (c: ContactDelightFieldsView) => {
    setManual(c);
    setSearchQuery('');
    setSearchOpen(false);
  };

  const handleReturnToQueue = () => {
    setManual(null);
    setSearchQuery('');
    setSearchOpen(false);
  };

  // Keyboard shortcuts (⌘+Enter save, ⌘+→ skip, Esc close).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
        return;
      }
      // Don't trigger save/skip while the search popover is open.
      if (searchOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkip();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, activeContact, position, manual, searchOpen]);

  // ── Render ────────────────────────────────────────────────────────────

  if (!open) return null;

  const total = queue.length;
  const percent = total === 0 ? 0 : Math.round(((saved + skipped) / total) * 100);
  const positionLabel = manual
    ? `Searching · pick saved as #${saved + 1}`
    : total > 0
      ? `${position + 1} of ${total} in queue`
      : 'No backlog — search above';

  // Empty-state for missing-data + no manual: celebrate.
  const showCelebrateEmpty =
    !missingLoading && queue.length === 0 && !manual && searchQuery.trim().length === 0;

  return (
    <SheetShell onClose={finish} progress={total === 0 ? null : percent} positionLabel={positionLabel}>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* ── Search bar (always available) ── */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          open={searchOpen}
          onOpen={() => setSearchOpen(true)}
          onClose={() => setSearchOpen(false)}
          results={searchResults}
          onPick={handlePickContact}
        />

        {/* Manual-mode banner */}
        {manual && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-reop-teal-soft border border-primary/30 px-3 py-2 text-[12px] text-reop-dark-blue">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Editing this contact directly. Save or cancel to return to the queue
              {total > 0 ? ` (${position + 1}/${total})` : ''}.
            </span>
            <button
              onClick={handleReturnToQueue}
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to queue
            </button>
          </div>
        )}

        {/* Loading / celebrate-empty / contact form */}
        {missingLoading && !manual ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading contacts…
          </div>
        ) : showCelebrateEmpty ? (
          <CelebrateEmpty onClose={finish} />
        ) : activeContact ? (
          <ContactEditor
            contact={activeContact}
            draft={draft}
            setDraft={setDraft}
            firstInputRef={firstInputRef}
            isManual={!!manual}
          />
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Search a contact above to start.
          </div>
        )}

        {!showCelebrateEmpty && (
          <div className="text-[11.5px] text-muted-foreground border-t border-border pt-3 leading-relaxed">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘ + Enter</kbd> save
            <span className="mx-2">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘ + →</kbd>{manual ? ' cancel' : ' skip'}
            <span className="mx-2">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Esc</kbd> close
          </div>
        )}
      </div>

      {/* Footer */}
      {!showCelebrateEmpty && (
        <div className="px-6 py-4 border-t border-border bg-card flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={!activeContact || updateContact.isPending}
            className="gap-1.5"
          >
            {manual ? (
              <>
                <ArrowLeft className="w-3.5 h-3.5" />
                Cancel
              </>
            ) : (
              <>
                <SkipForward className="w-3.5 h-3.5" />
                Skip
              </>
            )}
          </Button>
          <div className="flex-1" />
          <Button
            onClick={handleSave}
            disabled={!activeContact || updateContact.isPending}
            className="gap-1.5"
          >
            {updateContact.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </>
            ) : manual ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Save
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Save & next
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      )}
    </SheetShell>
  );
}

// ── ContactEditor ──────────────────────────────────────────────────────

function ContactEditor({
  contact, draft, setDraft, firstInputRef, isManual,
}: {
  contact: ContactDelightFieldsView;
  draft: DraftFields;
  setDraft: React.Dispatch<React.SetStateAction<DraftFields>>;
  firstInputRef: React.RefObject<HTMLInputElement>;
  isManual: boolean;
}) {
  const hasExisting = !!(contact.birthday || contact.spouse_birthday || contact.home_anniversary || contact.gift_preferences);
  return (
    <div className="space-y-5">
      {/* Contact header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-reop-teal-soft text-primary text-base font-semibold flex items-center justify-center flex-shrink-0">
          {initialsOf(contact)}
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-reop-dark-blue truncate">{fullName(contact)}</div>
          <div className="text-[12px] text-muted-foreground truncate">
            {contact.email || 'no email on file'}
            {contact.category && ` · ${contact.category}`}
          </div>
        </div>
      </div>

      {hasExisting && (
        <p className="text-[11.5px] text-muted-foreground -mt-1 leading-snug">
          {isManual
            ? 'Existing values are pre-filled. Edit any field, blank fields stay as they are.'
            : 'Some fields already have values — they\'re shown below. Update or leave them.'}
        </p>
      )}

      {/* Birthday */}
      <FieldGroup
        label="Birthday"
        icon={<Cake className="w-3.5 h-3.5" />}
        hint="Year doesn't matter much — month + day is what surfaces them in the queue."
        existing={contact.birthday}
      >
        <Input
          ref={firstInputRef}
          type="date"
          value={draft.birthday}
          onChange={(e) => setDraft((d) => ({ ...d, birthday: e.target.value }))}
        />
      </FieldGroup>

      {/* Spouse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldGroup label="Spouse / partner name" icon={<Heart className="w-3.5 h-3.5" />} existing={contact.spouse_name}>
          <Input
            value={draft.spouse_name}
            onChange={(e) => setDraft((d) => ({ ...d, spouse_name: e.target.value }))}
            placeholder="Optional"
          />
        </FieldGroup>
        <FieldGroup label="Spouse birthday" icon={<Heart className="w-3.5 h-3.5" />} existing={contact.spouse_birthday}>
          <Input
            type="date"
            value={draft.spouse_birthday}
            onChange={(e) => setDraft((d) => ({ ...d, spouse_birthday: e.target.value }))}
          />
        </FieldGroup>
      </div>

      {/* Home anniversary */}
      <FieldGroup
        label="Home anniversary"
        icon={<Home className="w-3.5 h-3.5" />}
        hint="The closing date. Auto-fills next time you log a closing in REOP."
        existing={contact.home_anniversary}
      >
        <Input
          type="date"
          value={draft.home_anniversary}
          onChange={(e) => setDraft((d) => ({ ...d, home_anniversary: e.target.value }))}
        />
      </FieldGroup>

      {/* Gift preferences */}
      <FieldGroup
        label="Gift preferences"
        icon={<Sparkles className="w-3.5 h-3.5" />}
        hint="Anything that helps you pick a thoughtful gift later. Free text."
        existing={contact.gift_preferences}
      >
        <Input
          value={draft.gift_preferences}
          onChange={(e) => setDraft((d) => ({ ...d, gift_preferences: e.target.value }))}
          placeholder="Wine, dog person, no alcohol, sweets…"
        />
      </FieldGroup>
    </div>
  );
}

// ── SearchBar ──────────────────────────────────────────────────────────

function SearchBar({
  value, onChange, open, onOpen, onClose, results, onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  results: ContactDelightFieldsView[];
  onPick: (c: ContactDelightFieldsView) => void;
}) {
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onOpen}
          placeholder="Search any contact by name, email, or phone…"
          className="pl-9 h-10"
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        {value && (
          <button
            onClick={() => { onChange(''); onClose(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && value.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-card border border-border rounded-md shadow-lg max-h-[260px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[12.5px] text-muted-foreground">No matching contacts.</div>
          ) : (
            <ul className="py-1">
              {results.map((c) => {
                const datesFilledCount =
                  Number(!!c.birthday) + Number(!!c.spouse_birthday) + Number(!!c.home_anniversary);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => onPick(c)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-reop-teal-soft text-primary text-[10.5px] font-semibold flex items-center justify-center flex-shrink-0">
                        {initialsOf(c)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-reop-dark-blue truncate">{fullName(c)}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {c.email || c.category || '—'}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
                          datesFilledCount === 0
                            ? 'bg-amber-100 text-amber-800'
                            : datesFilledCount === 3
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {datesFilledCount}/3
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── CelebrateEmpty ─────────────────────────────────────────────────────

function CelebrateEmpty({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8">
      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
        <Sparkles className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-semibold text-reop-dark-blue mb-1">All caught up.</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Every contact has at least one date on file. Use search above to update a specific person, or close this panel.
      </p>
      <Button onClick={onClose} className="mt-4">Close</Button>
    </div>
  );
}

// ── SheetShell ─────────────────────────────────────────────────────────

function SheetShell({
  onClose, children, progress, positionLabel,
}: {
  onClose: () => void;
  children: React.ReactNode;
  progress?: number | null;
  positionLabel?: string;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[100]" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[520px] max-w-[96vw] bg-background z-[101] flex flex-col shadow-[-4px_0_32px_rgba(0,0,0,0.18)]">
        <div className="px-6 pt-5 pb-3 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-[10px] bg-reop-teal-soft text-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-[18px] h-[18px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold text-primary">Bulk capture</div>
            <div className="text-[16px] font-semibold tracking-[-0.01em] text-reop-dark-blue truncate">
              Add birthdays & anniversaries
            </div>
            {positionLabel && (
              <div className="text-[11.5px] text-muted-foreground mt-0.5">
                {positionLabel}{progress != null ? ` · ${progress}% through` : ''}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-[7px] border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-reop-dark-blue"
            aria-label="Close"
          >
            <X className="w-[15px] h-[15px]" />
          </button>
        </div>
        {/* Progress bar */}
        {progress != null && (
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
            />
          </div>
        )}
        {children}
      </div>
    </>
  );
}

// ── FieldGroup ─────────────────────────────────────────────────────────

function FieldGroup({
  label, icon, hint, existing, children,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  /** Show a small badge if there's already a value on file. */
  existing?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs font-semibold text-reop-dark-blue flex items-center gap-1.5">
          {icon}
          {label}
        </Label>
        {existing && (
          <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
            on file
          </span>
        )}
      </div>
      {children}
      {hint && <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

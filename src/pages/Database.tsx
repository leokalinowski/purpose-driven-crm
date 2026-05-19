import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import {
  Upload,
  Download,
  UserPlus,
  Search,
  Phone,
  Mail,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldOff,
  Filter as FilterIcon,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useContacts, type Contact, type ContactInput } from '@/hooks/useContacts';
import { usePrioritizedQueue } from '@/hooks/usePrioritizedQueue';
import { useCompletedSphereTouchesThisWeek } from '@/hooks/useCompletedSphereTouchesThisWeek';
import { getCurrentWeekTasks } from '@/utils/sphereSyncLogic';
import { useDatabaseStats } from '@/hooks/useDatabaseStats';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useContactSheet } from '@/components/spheresync/ContactSheetProvider';
import { ContactForm } from '@/components/database/ContactForm';
import { ImprovedCSVUpload } from '@/components/database/ImprovedCSVUpload';
import { placeCall, sendEmail, type CommContact } from '@/lib/comm';
import { trackBulkDNCProgress } from '@/lib/dncProgress';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

// SphereSync membership chips. These are the only Priority/Cadence concepts
// surfaced on the Database — the prior `Temp` tier ladder (urgent/hot/warm/
// cool/cold/unscored) is gone; it was a UI bucketing of `priority_score`
// that confused agents. Now we surface only the two SphereSync concepts:
//   - Priorities: the contact appears on the SphereSync Priorities tab
//     (priority_band IS NOT NULL — pipeline OR cadence; see
//     usePrioritizedQueue / compute-priority-scores set-based-v7)
//   - Cadence:   the contact's category letter is in this week's
//     SphereSync call rotation or text rotation
//   - Touched:   the contact has at least one completed spheresync_task
//     this week (so the agent doesn't double-touch)

type LastTouchRange = 'all' | '7d' | '30d' | '30-90d' | '90d+' | 'never';

const LAST_TOUCH_OPTIONS: { value: LastTouchRange; label: string }[] = [
  { value: 'all',     label: 'Any time' },
  { value: '7d',      label: 'Past 7 days' },
  { value: '30d',     label: 'Past 30 days' },
  { value: '30-90d',  label: '30–90 days' },
  // The "Never touched" cohort is split out so it has a clear filter of its
  // own. Previously NULL last_activity_date was silently lumped under "90+
  // days" only, while being filtered OUT of the other ranges — confusing
  // when paired with the "No touch 90d+" stat tile.
  { value: '90d+',    label: '90+ days (touched but stale)' },
  { value: 'never',   label: 'Never touched' },
];

type CallingStatus = 'callable' | 'dnc' | 'email_only' | 'text_only' | 'no_contact_info';

// ─── SphereSync cell — Cadence + Priority chips per contact row ─────────
// Renders 0–3 small chips:
//   - "Call this week" or "Text this week" when the contact's letter
//     matches this week's SphereSync rotation
//   - "Priority" when the contact is on the Priorities list (score >= 60)
// Returns an em-dash when nothing applies, so the column never looks broken.

interface SphereSyncCellProps {
  inCallCadence: boolean;
  inTextCadence: boolean;
  isPriority: boolean;
}

function SphereSyncCell({ inCallCadence, inTextCadence, isPriority }: SphereSyncCellProps) {
  if (!inCallCadence && !inTextCadence && !isPriority) {
    return <span className="text-muted-foreground text-[12px]">—</span>;
  }
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      {inCallCadence && (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide bg-reop-teal-soft text-primary px-2 py-0.5 rounded-full">
          Call this week
        </span>
      )}
      {inTextCadence && (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide bg-[hsl(210_80%_94%)] text-[hsl(210_80%_40%)] px-2 py-0.5 rounded-full">
          Text this week
        </span>
      )}
      {isPriority && (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide bg-[hsl(0_84%_95%)] text-[hsl(0_72%_45%)] px-2 py-0.5 rounded-full">
          Priority
        </span>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  delta,
  positive,
  danger,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-[10px] p-4 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground font-semibold">
        {label}
      </span>
      <span
        className="text-[28px] font-semibold leading-none -tracking-[0.02em]"
        style={{ color: danger ? 'hsl(0 70% 55%)' : undefined }}
      >
        {value}
      </span>
      <span
        className="text-[11.5px]"
        style={{ color: positive ? 'hsl(142 50% 40%)' : 'var(--muted-foreground)' }}
      >
        {delta}
      </span>
    </div>
  );
}

function formatRelativeTouch(date: string | null): string {
  if (!date) return 'Never';
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 0) return 'Just now';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function initialsFor(c: Pick<Contact, 'first_name' | 'last_name'>): string {
  const f = (c.first_name ?? '').trim();
  const l = (c.last_name ?? '').trim();
  return ((f[0] ?? '') + (l[0] ?? '')).toUpperCase() || '?';
}

function fullNameFor(c: Pick<Contact, 'first_name' | 'last_name'>): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Unnamed contact';
}

function metaFor(c: Pick<Contact, 'email' | 'phone'>): string {
  return c.email || c.phone || '—';
}

function callingStatusFor(c: Contact): CallingStatus {
  if (c.dnc) return 'dnc';
  // Order matters: check no-contact-method BEFORE the channel-specific cases
  // so a contact with neither phone nor email never gets miscounted as
  // "callable." Previously the trailing `return 'callable'` swallowed those.
  if (!c.phone && !c.email) return 'no_contact_info';
  if (c.phone && !c.email) return 'text_only';
  if (c.email && !c.phone) return 'email_only';
  return 'callable';
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function Database() {
  const { user, loading: authLoading } = useAuth();
  const { getContactLimit } = useFeatureAccess();
  const { openContact } = useContactSheet();

  const {
    contacts,
    allContacts,
    totalContacts,
    loading,
    currentPage,
    totalPages,
    searchTerm,
    addContact,
    updateContact,
    deleteContact,
    uploadCSV,
    handleSearch,
    goToPage,
    fetchContacts,
  } = useContacts();

  // System B is the single source of truth for "Priorities" — same queue
  // that powers the SphereSync Priorities tab, so the Database filter
  // and KPI tile always agree with what the user sees there.
  const priorityQueue = usePrioritizedQueue();
  const { stats: dbStats } = useDatabaseStats();
  const { touchedContactIds } = useCompletedSphereTouchesThisWeek();

  // This week's SphereSync rotation — deterministic from the ISO week.
  // Drives the "Calling this week" / "Texting this week" cadence filters
  // and the SphereSync column badges. Memoized so it doesn't recompute on
  // every render.
  const currentWeekRotation = useMemo(() => getCurrentWeekTasks(), []);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedRelationships, setSelectedRelationships] = useState<Set<string>>(new Set());
  // Single-toggle SphereSync filters — replace the prior 6-tier Temp set.
  const [filterPriorityOnly, setFilterPriorityOnly] = useState(false);
  const [filterCallCadence, setFilterCallCadence] = useState(false);
  const [filterTextCadence, setFilterTextCadence] = useState(false);
  const [filterTouchedThisWeek, setFilterTouchedThisWeek] = useState(false);
  const [lastTouchRange, setLastTouchRange] = useState<LastTouchRange>('all');
  const [selectedCallingStatuses, setSelectedCallingStatuses] = useState<Set<CallingStatus>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Per-contact SphereSync membership lookup.
  //   - `isPriority` mirrors the SphereSync Priorities tab exactly: it's true
  //     iff the contact is in the queue's pipeline or cadence band.
  //     The legacy `priority_score >= 60` filter is no longer consulted
  //     anywhere in the UI — that column is NULL for every row.
  //   - `inCallCadence` / `inTextCadence` come from the deterministic
  //     letter rotation — independent of the capped queue so the chips
  //     surface EVERY contact whose letter is up this week, not just
  //     the top-12 the queue surfaces.
  const sphereSyncFor = (c: Contact): SphereSyncCellProps => {
    const letter = (c.category ?? '').toUpperCase();
    return {
      isPriority: priorityQueue.contactIds.has(c.id),
      inCallCadence: !!letter && currentWeekRotation.callCategories.includes(letter),
      inTextCadence: !!letter && letter === currentWeekRotation.textCategory,
    };
  };

  // Counts for the filter rail are computed off allContacts (full-set, not just current page)
  const relationshipCounts = useMemo(() => {
    const m = new Map<string, number>();
    allContacts.forEach((c) => {
      const key = c.contact_type?.trim() || 'Unspecified';
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [allContacts]);

  // Chip counts for the SphereSync section of the filter rail.
  //   - Priority: the actual queue size (matches the Priorities tab).
  //   - Call/Text/Touched: counted over `allContacts` so the numbers
  //     reflect everyone in the agent's database, not just the queue's
  //     capped top-25.
  const sphereSyncCounts = useMemo(() => {
    const callLetters = new Set(currentWeekRotation.callCategories.map((l) => l.toUpperCase()));
    const textLetter = currentWeekRotation.textCategory.toUpperCase();
    let call = 0;
    let text = 0;
    let touched = 0;
    for (const c of allContacts) {
      const letter = (c.category ?? '').toUpperCase();
      if (letter && callLetters.has(letter)) call++;
      if (letter && letter === textLetter) text++;
      if (touchedContactIds.has(c.id)) touched++;
    }
    return {
      priority: priorityQueue.counts.total,
      call,
      text,
      touched,
    };
  }, [allContacts, touchedContactIds, currentWeekRotation, priorityQueue.counts.total]);

  const callingStatusCounts = useMemo(() => {
    let callable = 0;
    let dnc = 0;
    let emailOnly = 0;
    let textOnly = 0;
    let noContactInfo = 0;
    allContacts.forEach((c) => {
      if (c.dnc) dnc++;
      else if (!c.phone && !c.email) noContactInfo++;
      else if (c.phone && !c.email) textOnly++;
      else if (c.email && !c.phone) emailOnly++;
      else callable++;
    });
    return {
      callable,
      dnc,
      email_only: emailOnly,
      text_only: textOnly,
      no_contact_info: noContactInfo,
    };
  }, [allContacts]);

  // Stat tiles — sourced from server-side COUNT queries (`useDatabaseStats`)
  // so they always reflect the agent's full contact set, not the search-
  // filtered or page-capped client array. Fall back to `totalContacts` from
  // useContacts only while dbStats is still loading.
  //
  // "Priorities" comes from the SphereSync queue (System B) — same source
  // as the Priorities tab, so the tile count always equals what the user
  // sees when they click into it.
  const stats = useMemo(() => {
    const total = dbStats?.totalContacts ?? totalContacts;
    const recentNew = dbStats?.recentNew ?? 0;
    const pastClients = dbStats?.pastClients ?? 0;
    const noTouch90d = dbStats?.noTouch90d ?? 0;
    const { pipeline: pP, cadence: pC, total: pT } = priorityQueue.counts;

    return [
      {
        label: 'Total contacts',
        value: total.toLocaleString(),
        delta: recentNew > 0 ? `+${recentNew} this month` : 'No new this month',
        positive: recentNew > 0,
      },
      {
        label: 'Past clients',
        value: pastClients.toLocaleString(),
        delta: total > 0
          ? `${Math.round((pastClients / total) * 100)}% of sphere`
          : '—',
      },
      {
        label: 'Priorities',
        value: pT.toLocaleString(),
        delta: pT > 0
          ? `${pP} pipeline · ${pC} cadence`
          : 'Nothing on the queue this week',
        positive: pT > 0,
      },
      {
        label: 'No touch 90d+',
        value: noTouch90d.toLocaleString(),
        delta: noTouch90d > 0 ? 'Needs attention' : 'All in cadence',
        danger: noTouch90d > 0,
      },
    ];
  }, [dbStats, totalContacts, priorityQueue.counts]);

  // True when any filter chip is active. When ON, we page through the full
  // `allContacts` set client-side so the visible rows and the chip counts
  // agree (previous bug: chip said "Hot=12" but page 1 showed 0 because all
  // 12 hot contacts lived on page 5 of the server-paged set).
  const hasActiveFilters =
    selectedRelationships.size > 0 ||
    filterPriorityOnly ||
    filterCallCadence ||
    filterTextCadence ||
    filterTouchedThisWeek ||
    selectedCallingStatuses.size > 0 ||
    lastTouchRange !== 'all';

  // Reset to page 1 whenever the filter set changes — otherwise the agent can
  // land on an empty page (e.g. they're on page 4 of unfiltered, then filter
  // to "Priorities" with only 8 matches = 1 page, and see nothing).
  useEffect(() => {
    if (currentPage !== 1) goToPage(1);
    // We intentionally only depend on the filter values, not currentPage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRelationships, filterPriorityOnly, filterCallCadence, filterTextCadence, filterTouchedThisWeek, selectedCallingStatuses, lastTouchRange]);

  // Predicate that combines every active filter. Used both for the visible
  // page and the filtered-total count below.
  const matchesAllFilters = useMemo(() => {
    const callLetters = new Set(currentWeekRotation.callCategories.map((l) => l.toUpperCase()));
    const textLetter = currentWeekRotation.textCategory.toUpperCase();
    return (c: Contact): boolean => {
      if (selectedRelationships.size > 0) {
        const key = c.contact_type?.trim() || 'Unspecified';
        if (!selectedRelationships.has(key)) return false;
      }
      const ss = sphereSyncFor(c);
      if (filterPriorityOnly && !ss.isPriority) return false;
      if (filterCallCadence) {
        const letter = (c.category ?? '').toUpperCase();
        if (!letter || !callLetters.has(letter)) return false;
      }
      if (filterTextCadence) {
        const letter = (c.category ?? '').toUpperCase();
        if (!letter || letter !== textLetter) return false;
      }
      if (filterTouchedThisWeek && !touchedContactIds.has(c.id)) return false;
      if (selectedCallingStatuses.size > 0) {
        if (!selectedCallingStatuses.has(callingStatusFor(c))) return false;
      }
      if (lastTouchRange !== 'all') {
        // Split NULL last_activity_date into its own "never" bucket so the
        // four time-window filters (7d / 30d / 30-90d / 90d+) only count
        // contacts who HAVE been touched. Prevents NULL contacts from
        // double-counting between "90+ days" and "Never touched."
        const hasTouch = !!c.last_activity_date;
        if (lastTouchRange === 'never') {
          if (hasTouch) return false;
        } else {
          if (!hasTouch) return false;
          const last = new Date(c.last_activity_date!).getTime();
          const ageDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
          if (lastTouchRange === '7d'     && ageDays > 7) return false;
          if (lastTouchRange === '30d'    && ageDays > 30) return false;
          if (lastTouchRange === '30-90d' && (ageDays < 30 || ageDays > 90)) return false;
          if (lastTouchRange === '90d+'   && ageDays < 90) return false;
        }
      }
      return true;
    };
    // priorityQueue.contactIds + touchedContactIds + currentWeekRotation
    // are the deps for the SphereSync filters; sphereSyncFor closes over
    // priorityQueue.contactIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRelationships, filterPriorityOnly, filterCallCadence, filterTextCadence, filterTouchedThisWeek, lastTouchRange, selectedCallingStatuses, priorityQueue.contactIds, touchedContactIds, currentWeekRotation]);

  // Filtered full set when any chip is active, otherwise empty (we use the
  // server-paged `contacts` instead).
  const filteredAllContacts = useMemo(() => {
    if (!hasActiveFilters) return [] as Contact[];
    return allContacts.filter(matchesAllFilters);
  }, [hasActiveFilters, allContacts, matchesAllFilters]);

  const ITEMS_PER_PAGE = 25;

  // Visible rows: server-paged when no filters are active, client-paged from
  // the filtered full set when filters are on.
  const visibleContacts = useMemo(() => {
    if (!hasActiveFilters) {
      // No client-side filter mode — server-side pagination handles the slice.
      return contacts;
    }
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAllContacts.slice(start, start + ITEMS_PER_PAGE);
  }, [hasActiveFilters, contacts, filteredAllContacts, currentPage]);

  // Effective totals for the footer + pagination — switch source when filters
  // are active so "X of N" reflects the filtered cohort, not the full DB.
  const effectiveTotal = hasActiveFilters ? filteredAllContacts.length : totalContacts;
  const effectiveTotalPages = Math.max(
    1,
    Math.ceil(effectiveTotal / ITEMS_PER_PAGE),
  );

  const handleAddContact = async (data: ContactInput) => {
    try {
      await addContact(data, getContactLimit());
      toast.success('Contact added');
      setAddOpen(false);
    } catch (err) {
      toast.error('Failed to add contact', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      throw err;
    }
  };

  const handleEditContact = async (data: ContactInput) => {
    if (!editingContact) return;
    try {
      await updateContact(editingContact.id, data);
      toast.success('Contact updated');
      setEditingContact(null);
      fetchContacts();
    } catch (err) {
      toast.error('Failed to update contact', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      throw err;
    }
  };

  const handleDeleteContact = async () => {
    if (!editingContact) return;
    if (!confirm(`Delete ${fullNameFor(editingContact)}? This cannot be undone.`)) return;
    try {
      await deleteContact(editingContact.id);
      toast.success('Contact deleted');
      setEditingContact(null);
      fetchContacts();
    } catch (err) {
      toast.error('Failed to delete contact', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleCSVUpload = async (csvData: ContactInput[]) => {
    if (!user) return;
    const limit = getContactLimit();
    const startedAt = new Date().toISOString();
    const inserted = await uploadCSV(csvData, limit);
    toast.success(`Imported ${csvData.length} contacts`);
    fetchContacts();

    // useContacts.uploadCSV already kicks off the bulk DNC sweep edge
    // function. Mount a live-progress toast that polls the DB until each
    // imported contact has a fresh `dnc_last_checked`. Auto-resolves on
    // completion; user can keep working in the background.
    if (inserted && inserted.length > 0) {
      trackBulkDNCProgress({
        contactIds: inserted.map((c) => c.id),
        agentId: user.id,
        startedAt,
      });
    }
  };

  const handleExportCSV = () => {
    if (allContacts.length === 0) {
      toast.error('No contacts to export');
      return;
    }
    const headers = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'address_1',
      'address_2',
      'city',
      'state',
      'zip_code',
      'tags',
      'dnc',
      'notes',
      'category',
      'contact_type',
      'last_activity_date',
    ];
    const rows = allContacts.map((c) =>
      headers.map((h) => csvEscape((c as unknown as Record<string, unknown>)[h])).join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${allContacts.length} contacts`);
  };

  const toggleSetItem = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  // Helper for action click on a contact row
  const handleCallContact = (c: Contact) => {
    if (!user) return;
    const cc: CommContact = {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      email: c.email,
      dnc: c.dnc,
    };
    placeCall(user.id, cc);
  };

  const handleEmailContact = (c: Contact) => {
    if (!user) return;
    const cc: CommContact = {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      email: c.email,
      dnc: c.dnc,
    };
    sendEmail(user.id, cc);
  };

  // RELATIONSHIP filter only matters when contacts have varied types
  // (past_client, agent, vendor, etc.). When every contact is the same type
  // (e.g., all 'contact'), the filter has nothing useful to do — toggling it
  // selects everyone or no one. Hide the whole section in that case.
  const hasRelationshipDiversity = relationshipCounts.length > 1;

  const filterRail = (
    <>
      {hasRelationshipDiversity && (
      <div className="py-4 pt-0 border-b border-border">
        <h4 className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-bold mb-2.5">
          Relationship
        </h4>
        {relationshipCounts.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No relationships yet.</p>
        ) : (
          relationshipCounts.map(([label, count]) => (
            <label
              key={label}
              className="flex items-center gap-2.5 py-2.5 text-sm cursor-pointer text-reop-dark-blue hover:text-primary transition"
            >
              <input
                type="checkbox"
                checked={selectedRelationships.has(label)}
                onChange={() => setSelectedRelationships((s) => toggleSetItem(s, label))}
                className="w-[15px] h-[15px] accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
              />
              <span className="flex-1">{label}</span>
              <span className="text-[11px] px-1.5 rounded-full bg-[hsl(210_20%_96%)] text-muted-foreground">
                {count}
              </span>
            </label>
          ))
        )}
      </div>
      )}

      <div className="py-4 border-b border-border">
        <h4 className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-bold mb-2.5">
          SphereSync
        </h4>

        {/* Priorities — single toggle. Matches the SphereSync Priorities tab
            exactly (contacts with priority_band='pipeline' OR 'cadence').
            Replaces the prior 6-tier temperature ladder, which surfaced
            low-signal noise. */}
        <label className="flex items-center gap-2.5 py-2.5 text-sm cursor-pointer text-reop-dark-blue hover:text-primary transition">
          <input
            type="checkbox"
            checked={filterPriorityOnly}
            onChange={() => setFilterPriorityOnly((v) => !v)}
            className="w-[15px] h-[15px] accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
          />
          <span className="flex-1">On the Priorities list</span>
          <span className="text-[11px] px-1.5 rounded-full bg-[hsl(210_20%_96%)] text-muted-foreground">
            {sphereSyncCounts.priority}
          </span>
        </label>

        {/* Weekly cadence — drives off this week's SphereSync rotation letters.
            Letters shown inline so the chip self-explains. */}
        <label className="flex items-center gap-2.5 py-2.5 text-sm cursor-pointer text-reop-dark-blue hover:text-primary transition">
          <input
            type="checkbox"
            checked={filterCallCadence}
            onChange={() => setFilterCallCadence((v) => !v)}
            className="w-[15px] h-[15px] accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
          />
          <span className="flex-1">
            Calling this week
            {currentWeekRotation.callCategories.length > 0 && (
              <span className="ml-1.5 text-[11px] text-muted-foreground font-medium">
                · {currentWeekRotation.callCategories.join(', ')}
              </span>
            )}
          </span>
          <span className="text-[11px] px-1.5 rounded-full bg-[hsl(210_20%_96%)] text-muted-foreground">
            {sphereSyncCounts.call}
          </span>
        </label>

        <label className="flex items-center gap-2.5 py-2.5 text-sm cursor-pointer text-reop-dark-blue hover:text-primary transition">
          <input
            type="checkbox"
            checked={filterTextCadence}
            onChange={() => setFilterTextCadence((v) => !v)}
            className="w-[15px] h-[15px] accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
          />
          <span className="flex-1">
            Texting this week
            {currentWeekRotation.textCategory && (
              <span className="ml-1.5 text-[11px] text-muted-foreground font-medium">
                · {currentWeekRotation.textCategory}
              </span>
            )}
          </span>
          <span className="text-[11px] px-1.5 rounded-full bg-[hsl(210_20%_96%)] text-muted-foreground">
            {sphereSyncCounts.text}
          </span>
        </label>

        {/* Touched this week — contacts the agent already called or texted
            via SphereSync this week. Lets agents avoid double-touching. */}
        <label className="flex items-center gap-2.5 py-2.5 text-sm cursor-pointer text-reop-dark-blue hover:text-primary transition">
          <input
            type="checkbox"
            checked={filterTouchedThisWeek}
            onChange={() => setFilterTouchedThisWeek((v) => !v)}
            className="w-[15px] h-[15px] accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
          />
          <span className="flex-1">Touched this week</span>
          <span className="text-[11px] px-1.5 rounded-full bg-[hsl(210_20%_96%)] text-muted-foreground">
            {sphereSyncCounts.touched}
          </span>
        </label>
      </div>

      <div className="py-4 border-b border-border">
        <h4 className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-bold mb-2.5">
          Last touch
        </h4>
        {LAST_TOUCH_OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer text-reop-dark-blue hover:text-primary transition"
          >
            <input
              type="radio"
              name="last-touch"
              checked={lastTouchRange === o.value}
              onChange={() => setLastTouchRange(o.value)}
              className="w-[15px] h-[15px] accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
            />
            <span className="flex-1">{o.label}</span>
          </label>
        ))}
      </div>

      <div className="py-4">
        <h4 className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-bold mb-2.5">
          <span className="inline-flex items-center gap-1.5">
            <ShieldOff className="w-[13px] h-[13px] text-[hsl(0_72%_45%)]" />
            Calling status
          </span>
        </h4>
        {([
          { v: 'callable' as const, label: 'Callable', count: callingStatusCounts.callable, danger: false },
          { v: 'dnc' as const, label: 'DNC registered', count: callingStatusCounts.dnc, danger: true },
          { v: 'email_only' as const, label: 'Email only', count: callingStatusCounts.email_only, danger: false },
          { v: 'text_only' as const, label: 'Text only', count: callingStatusCounts.text_only, danger: false },
          { v: 'no_contact_info' as const, label: 'No phone or email', count: callingStatusCounts.no_contact_info, danger: false },
        ]).map((row) => (
          <label
            key={row.v}
            className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer text-reop-dark-blue hover:text-primary transition"
          >
            <input
              type="checkbox"
              checked={selectedCallingStatuses.has(row.v)}
              onChange={() => setSelectedCallingStatuses((s) => toggleSetItem(s, row.v))}
              className="w-[15px] h-[15px] accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
            />
            <span
              className={cn(
                'flex-1',
                row.danger && 'text-[hsl(0_72%_45%)] font-semibold',
              )}
            >
              {row.label}
            </span>
            <span
              className={cn(
                'text-[11px] px-1.5 rounded-full',
                row.danger
                  ? 'bg-[hsl(0_84%_95%)] text-[hsl(0_72%_45%)]'
                  : 'bg-[hsl(210_20%_96%)] text-muted-foreground',
              )}
            >
              {row.count}
            </span>
          </label>
        ))}
      </div>

      {(selectedRelationships.size > 0 ||
        filterPriorityOnly ||
        filterCallCadence ||
        filterTextCadence ||
        filterTouchedThisWeek ||
        lastTouchRange !== 'all' ||
        selectedCallingStatuses.size > 0) && (
        <button
          onClick={() => {
            setSelectedRelationships(new Set());
            setFilterPriorityOnly(false);
            setFilterCallCadence(false);
            setFilterTextCadence(false);
            setFilterTouchedThisWeek(false);
            setLastTouchRange('all');
            setSelectedCallingStatuses(new Set());
          }}
          className="mt-3 w-full text-xs text-primary font-semibold hover:underline"
        >
          Clear filters
        </button>
      )}
    </>
  );

  // Wait for auth to resolve before deciding to render the not-signed-in
  // fallback — without this, the page flashes "Please sign in" on hard refresh
  // because `user` is briefly null while `useAuth().loading` is true.
  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          Loading database…
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm">Please sign in to view your database.</p>
        </div>
      </Layout>
    );
  }

  // Footer + pagination work off the EFFECTIVE total — the filtered set
  // size when any chip is active, otherwise the full DB count.
  const showStart = effectiveTotal === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const showEnd = Math.min(currentPage * ITEMS_PER_PAGE, effectiveTotal);

  return (
    <>
      <Helmet><title>Database — Real Estate on Purpose</title></Helmet>
      <Layout>
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-start md:justify-between gap-4 mb-6 md:mb-7">
          <div>
            <span className="eye-label block mb-1.5">Database</span>
            <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-medium tracking-tighter leading-[1.15] mb-1.5">
              {totalContacts.toLocaleString()} {totalContacts === 1 ? 'relationship' : 'relationships'}, one source of truth.
            </h1>
            <p className="text-sm text-muted-foreground max-w-[640px] leading-[1.55]">
              Everyone in your world — tagged, dated, and searchable. Click any row to open the full file.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-2.5">
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 h-[38px] px-3 md:px-3.5 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition"
            >
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 h-[38px] px-3 md:px-3.5 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 h-[38px] px-3 md:px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition flex-1 sm:flex-initial justify-center"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add contact
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-3.5 mb-6">
          {stats.map((s) => (
            <StatTile
              key={s.label}
              label={s.label}
              value={s.value}
              delta={s.delta}
              positive={s.positive}
              danger={s.danger}
            />
          ))}
        </div>

        <div className="grid gap-5 lg:[grid-template-columns:minmax(0,260px)_minmax(0,1fr)]">
          <aside className="hidden lg:block bg-card border border-border rounded-xl p-[18px] sticky top-5 self-start">
            {filterRail}
          </aside>

          {/* Mobile filter drawer */}
          {mobileFiltersOpen && (
            <>
              <div
                className="lg:hidden fixed inset-0 bg-black/40 z-[100]"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <aside className="lg:hidden fixed top-0 bottom-0 left-0 w-[85%] max-w-[340px] bg-card z-[101] overflow-y-auto p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-card -mx-5 px-5 -mt-5 pt-5 pb-3 border-b border-border">
                  <h3 className="text-base font-semibold inline-flex items-center gap-2">
                    <FilterIcon className="w-4 h-4 text-primary" />
                    Filters
                  </h3>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-8 h-8 rounded-md border border-border bg-card text-reop-dark-blue inline-flex items-center justify-center hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {filterRail}
              </aside>
            </>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search contacts…"
                  className="w-full h-[42px] pl-10 pr-3.5 rounded-[10px] border border-border bg-card text-sm text-reop-dark-blue focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden inline-flex items-center gap-1.5 h-[42px] px-3 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition"
              >
                <FilterIcon className="w-3.5 h-3.5" />
                Filters
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 mb-3 text-[12.5px] text-muted-foreground">
              <span>
                {effectiveTotal > 0 ? (
                  <>
                    Showing <b className="text-reop-dark-blue font-semibold">{showStart}–{showEnd}</b> of{' '}
                    <b className="text-reop-dark-blue font-semibold">{effectiveTotal.toLocaleString()}</b>{' '}
                    {hasActiveFilters ? 'matching ' : ''}contacts · sorted by{' '}
                    <b className="text-reop-dark-blue font-semibold">Last name</b>
                  </>
                ) : loading ? (
                  'Loading contacts…'
                ) : hasActiveFilters ? (
                  'No contacts match your filters.'
                ) : (
                  'No contacts yet — import a CSV or add one to begin.'
                )}
              </span>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(210_20%_97%)] border-b border-border">
                      {[
                        { label: 'Name' },
                        { label: 'Relationship' },
                        { label: 'SphereSync' },
                        { label: 'Last touch' },
                        { label: 'Tags' },
                        { label: '', srOnly: 'Actions' },
                      ].map((h, hi) => (
                        <th
                          key={hi}
                          className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-bold py-3.5 px-4 whitespace-nowrap"
                        >
                          {h.srOnly ? <span className="sr-only">{h.srOnly}</span> : h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleContacts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 px-4 text-center text-sm text-muted-foreground">
                          {loading ? 'Loading…' : 'No contacts match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      visibleContacts.map((c) => {
                        const ss = sphereSyncFor(c);
                        const tags = (c.tags ?? []).slice(0, 3);
                        const callable = !c.dnc && !!c.phone;
                        return (
                          <tr
                            key={c.id}
                            className="border-b border-border last:border-b-0 hover:bg-[hsl(210_20%_98.5%)] transition cursor-pointer"
                            style={c.dnc ? { background: 'hsl(0 84% 98%)' } : undefined}
                            onClick={() => openContact(c.id)}
                          >
                            <td className="py-3 px-4 align-middle">
                              <div className="flex items-center gap-3 min-w-[220px]">
                                <div
                                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                                  style={{
                                    background: c.dnc ? 'hsl(0 60% 90%)' : 'hsl(184 30% 90%)',
                                    color: c.dnc ? 'hsl(0 72% 40%)' : 'var(--reop-dark-blue)',
                                  }}
                                >
                                  {initialsFor(c)}
                                </div>
                                <div>
                                  <b className="font-semibold block">{fullNameFor(c)}</b>
                                  <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5">
                                    {metaFor(c)}
                                    {c.dnc && (
                                      <span className="inline-flex items-center gap-1 bg-[hsl(0_84%_95%)] text-[hsl(0_72%_45%)] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        <ShieldOff className="w-2.5 h-2.5" />
                                        DNC
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 align-middle">
                              {c.contact_type || <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-3 px-4 align-middle">
                              <SphereSyncCell {...ss} />
                            </td>
                            <td className="py-3 px-4 align-middle whitespace-nowrap text-muted-foreground text-[12.5px]">
                              {formatRelativeTouch(c.last_activity_date)}
                            </td>
                            <td className="py-3 px-4 align-middle">
                              <div className="flex gap-1 flex-wrap">
                                {tags.map((t, ti) => (
                                  <span
                                    key={ti}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-[hsl(210_20%_94%)] text-reop-dark-blue text-[11px] font-medium"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 justify-end">
                                {callable ? (
                                  <button
                                    onClick={() => handleCallContact(c)}
                                    title="Call"
                                    className="w-[44px] h-[44px] md:w-[30px] md:h-[30px] rounded-md border border-border bg-card text-reop-dark-blue flex items-center justify-center hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </button>
                                ) : c.dnc ? (
                                  <button
                                    title="DNC — cannot call"
                                    disabled
                                    className="w-[44px] h-[44px] md:w-[30px] md:h-[30px] rounded-md border border-[hsl(0_60%_85%)] bg-[hsl(0_84%_95%)] text-[hsl(0_72%_45%)] flex items-center justify-center cursor-not-allowed"
                                  >
                                    <ShieldOff className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    title="No phone on file"
                                    disabled
                                    className="w-[44px] h-[44px] md:w-[30px] md:h-[30px] rounded-md border border-border bg-card text-muted-foreground flex items-center justify-center cursor-not-allowed opacity-50"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleEmailContact(c)}
                                  disabled={!c.email}
                                  title={c.email ? 'Email' : 'No email on file'}
                                  className={cn(
                                    'w-[44px] h-[44px] md:w-[30px] md:h-[30px] rounded-md border border-border bg-card text-reop-dark-blue flex items-center justify-center transition',
                                    c.email
                                      ? 'hover:bg-reop-teal-soft hover:text-primary hover:border-primary'
                                      : 'opacity-50 cursor-not-allowed',
                                  )}
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="w-[44px] h-[44px] md:w-[30px] md:h-[30px] rounded-md border border-border bg-card text-reop-dark-blue flex items-center justify-center hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openContact(c.id)}>
                                      <Search className="w-3.5 h-3.5 mr-2" />
                                      Open file
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setEditingContact(c)}>
                                      <Pencil className="w-3.5 h-3.5 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingContact(c);
                                        setTimeout(() => handleDeleteContact(), 0);
                                      }}
                                      className="text-[hsl(0_72%_45%)] focus:text-[hsl(0_72%_45%)]"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {visibleContacts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {loading ? 'Loading…' : 'No contacts match your filters.'}
                  </div>
                ) : (
                  visibleContacts.map((c) => {
                    const ss = sphereSyncFor(c);
                    const tags = (c.tags ?? []).slice(0, 4);
                    const callable = !c.dnc && !!c.phone;
                    return (
                      <div
                        key={c.id}
                        className="p-4"
                        style={c.dnc ? { background: 'hsl(0 84% 98%)' } : undefined}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => openContact(c.id)}
                            className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                            style={{
                              background: c.dnc ? 'hsl(0 60% 90%)' : 'hsl(184 30% 90%)',
                              color: c.dnc ? 'hsl(0 72% 40%)' : 'var(--reop-dark-blue)',
                            }}
                          >
                            {initialsFor(c)}
                          </button>
                          <div className="min-w-0 flex-1">
                            <button onClick={() => openContact(c.id)} className="text-left w-full">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <b className="font-semibold block text-sm truncate">{fullNameFor(c)}</b>
                                  <span className="text-[12px] text-muted-foreground line-clamp-1">{metaFor(c)}</span>
                                </div>
                                <div className="shrink-0">
                                  <SphereSyncCell {...ss} />
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                                <span>{c.contact_type || 'Unspecified'}</span>
                                <span>·</span>
                                <span>{formatRelativeTouch(c.last_activity_date)}</span>
                                {c.dnc && (
                                  <span className="inline-flex items-center gap-1 bg-[hsl(0_84%_95%)] text-[hsl(0_72%_45%)] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    <ShieldOff className="w-2.5 h-2.5" />
                                    DNC
                                  </span>
                                )}
                              </div>
                              {tags.length > 0 && (
                                <div className="mt-2 flex gap-1 flex-wrap">
                                  {tags.map((tag, ti) => (
                                    <span
                                      key={ti}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-[hsl(210_20%_94%)] text-reop-dark-blue text-[11px] font-medium"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                            <div className="mt-3 flex gap-1.5">
                              {callable ? (
                                <button
                                  onClick={() => handleCallContact(c)}
                                  className="flex-1 h-11 rounded-md border border-border bg-card text-reop-dark-blue flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  Call
                                </button>
                              ) : c.dnc ? (
                                <button
                                  disabled
                                  title="DNC — cannot call"
                                  className="flex-1 h-11 rounded-md border border-[hsl(0_60%_85%)] bg-[hsl(0_84%_95%)] text-[hsl(0_72%_45%)] flex items-center justify-center gap-1.5 text-xs font-semibold cursor-not-allowed"
                                >
                                  <ShieldOff className="w-3.5 h-3.5" />
                                  DNC
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="flex-1 h-11 rounded-md border border-border bg-card text-muted-foreground flex items-center justify-center gap-1.5 text-xs font-semibold opacity-50 cursor-not-allowed"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  Call
                                </button>
                              )}
                              <button
                                onClick={() => handleEmailContact(c)}
                                disabled={!c.email}
                                className={cn(
                                  'flex-1 h-11 rounded-md border border-border bg-card text-reop-dark-blue flex items-center justify-center gap-1.5 text-xs font-semibold transition',
                                  c.email
                                    ? 'hover:bg-reop-teal-soft hover:text-primary hover:border-primary'
                                    : 'opacity-50 cursor-not-allowed',
                                )}
                              >
                                <Mail className="w-3.5 h-3.5" />
                                Email
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="w-11 h-11 rounded-md border border-border bg-card text-reop-dark-blue flex items-center justify-center hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition flex-shrink-0">
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openContact(c.id)}>
                                    <Search className="w-3.5 h-3.5 mr-2" />
                                    Open file
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditingContact(c)}>
                                    <Pencil className="w-3.5 h-3.5 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingContact(c);
                                      setTimeout(() => handleDeleteContact(), 0);
                                    }}
                                    className="text-[hsl(0_72%_45%)] focus:text-[hsl(0_72%_45%)]"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sticky on mobile so page nav is reachable without scrolling
                  past every row in the page. Static on lg+ where the table
                  fits without scrolling. */}
              <div className="md:relative sticky bottom-0 z-10 bg-card flex justify-between items-center px-4 py-3.5 border-t border-border">
                <span className="text-[12.5px] text-muted-foreground">
                  {effectiveTotal > 0
                    ? `${showStart}–${showEnd} of ${effectiveTotal.toLocaleString()}`
                    : '0 contacts'}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => goToPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="w-[44px] h-[44px] md:w-[30px] md:h-[30px] rounded-md border border-border bg-card text-reop-dark-blue flex items-center justify-center hover:bg-reop-teal-soft transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <PaginationDots
                    currentPage={currentPage}
                    totalPages={effectiveTotalPages}
                    onPageChange={goToPage}
                  />
                  <button
                    onClick={() => goToPage(Math.min(effectiveTotalPages, currentPage + 1))}
                    disabled={currentPage >= effectiveTotalPages}
                    className="w-[44px] h-[44px] md:w-[30px] md:h-[30px] rounded-md border border-border bg-card text-reop-dark-blue flex items-center justify-center hover:bg-reop-teal-soft transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>

      <ContactForm
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleAddContact}
        title="Add contact"
      />

      <ContactForm
        open={!!editingContact}
        onOpenChange={(open) => !open && setEditingContact(null)}
        contact={editingContact}
        onSubmit={handleEditContact}
        title="Edit contact"
      />

      <ImprovedCSVUpload
        open={importOpen}
        onOpenChange={setImportOpen}
        onUpload={handleCSVUpload}
      />
    </>
  );
}

function PaginationDots({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (n: number) => void;
}) {
  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 4) pages.push('…');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 3) pages.push('…');
    pages.push(totalPages);
  }
  return (
    <>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="w-[44px] h-[44px] md:w-[30px] md:h-[30px] flex items-center justify-center text-muted-foreground text-xs">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'w-[44px] h-[44px] md:w-[30px] md:h-[30px] rounded-md border border-border text-xs font-medium transition',
              p === currentPage
                ? 'bg-reop-dark-blue text-white border-reop-dark-blue'
                : 'bg-card text-reop-dark-blue hover:bg-reop-teal-soft',
            )}
          >
            {p}
          </button>
        ),
      )}
    </>
  );
}

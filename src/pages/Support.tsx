/**
 * Support Hub — rebuilt against `design/support.html`.
 *
 * Layout (top → bottom):
 *   1. Page head
 *   2. Gradient HERO with prominent search bar + popular query chips.
 *      Live search hits the support-search edge fn (debounced 220ms),
 *      results overlay below the input with snippets.
 *   3. Category grid — 8 cards from support_categories with live article
 *      counts. Click → /support#category-<slug> jumps + shows the
 *      category's articles inline.
 *   4. 2-col split: tickets (left, 1.3fr) + Top FAQs (right, 1fr).
 *   5. Contact row — 3 cards (chat / phone / training).
 *
 * Tickets section keeps the existing TicketForm + list + dialog wiring.
 * The ClickUp internal task-id leak was removed from ticket subtitles.
 *
 * Self-serve discovery now precedes ticket filing — agents see the search
 * bar first, then categories, then FAQs, then tickets, then humans. The
 * design's intended posture: "answers fast, ticket only if needed."
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Inbox, Clock, Check, Loader2, AlertCircle,
  PlayCircle, Users, Mail, Briefcase, BarChart3, CreditCard, Plug, Shield,
  HelpCircle, ChevronRight, Sparkles, Star, X,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { TicketForm } from '@/components/support/TicketForm';
import { TicketDetailDialog } from '@/components/support/TicketDetailDialog';
import { useSupportTickets, type SupportTicket, type TicketStatus } from '@/hooks/useSupportTickets';
import {
  useSupportCategories,
  useSupportArticles,
  useArticleSearch,
  type SupportArticle,
  type SupportCategory,
} from '@/hooks/useSupportKb';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';

// Icon registry — maps category.icon_token to a lucide component.
const ICON_BY_TOKEN: Record<string, LucideIcon> = {
  'play-circle': PlayCircle,
  'users': Users,
  'mail': Mail,
  'briefcase': Briefcase,
  'bar-chart-3': BarChart3,
  'credit-card': CreditCard,
  'plug': Plug,
  'shield': Shield,
  'help-circle': HelpCircle,
};

// Five concrete queries — each one matches a real published article so the
// search dropdown actually shows hits when an agent clicks them. Update
// alongside the KB if you add/remove articles.
const POPULAR_QUERIES = [
  'submit weekly check-in',
  'import contacts from CSV',
  'use the AI newsletter generator',
  'set my annual goals',
  'change my password',
];

const statusMeta: Record<TicketStatus, { label: string; pillCls: string; iconCls: string; Icon: typeof Inbox }> = {
  open: { label: 'Open', pillCls: 'bg-[hsl(184_100%_93%)] text-primary', iconCls: 'bg-[hsl(184_100%_93%)] text-primary', Icon: AlertCircle },
  in_progress: { label: 'In progress', pillCls: 'bg-[hsl(35_100%_94%)] text-[hsl(35_80%_45%)]', iconCls: 'bg-[hsl(35_100%_94%)] text-[hsl(35_80%_45%)]', Icon: Loader2 },
  resolved: { label: 'Resolved', pillCls: 'bg-[hsl(140_40%_92%)] text-reop-green', iconCls: 'bg-[hsl(140_40%_92%)] text-reop-green', Icon: Check },
  closed: { label: 'Closed', pillCls: 'bg-[hsl(210_20%_93%)] text-muted-foreground', iconCls: 'bg-[hsl(210_20%_93%)] text-muted-foreground', Icon: Check },
};

const categoryLabels: Record<string, string> = {
  database: 'Database', spheresync: 'SphereSync', newsletter: 'Newsletter',
  coaching: 'Coaching', technical: 'Technical', general: 'General',
  subscription: 'Subscription', events: 'Events', social: 'Social',
};

export default function Support() {
  const navigate = useNavigate();

  // ── KB hooks ──
  const { categories, isLoading: catsLoading } = useSupportCategories({ withCounts: true });
  const { articles: featuredArticles } = useSupportArticles({ featuredOnly: true, limit: 6 });
  const { query, setQuery, hits, searching } = useArticleSearch();

  // ── Tickets hooks (existing wiring) ──
  const { tickets, isLoading: ticketsLoading, createTicket, isCreating } = useSupportTickets();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Category modal state ──
  // Clicking a category card opens a dialog listing its articles, instead
  // of jump-scrolling to an inline section that pushed the rest of the
  // page (tickets, contact cards) below the fold.
  const [openCategory, setOpenCategory] = useState<SupportCategory | null>(null);

  // ── Ticket counts/filter (existing logic + closed added) ──
  const counts = useMemo(
    () => ({
      all: tickets.length,
      open: tickets.filter((t) => t.status === 'open').length,
      in_progress: tickets.filter((t) => t.status === 'in_progress').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
      closed: tickets.filter((t) => t.status === 'closed').length,
    }),
    [tickets],
  );
  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => {
        if (!q) return true;
        return (
          t.subject.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (categoryLabels[t.category] || t.category).toLowerCase().includes(q)
        );
      });
  }, [tickets, statusFilter, search]);
  const filterOptions: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'open', label: `Open (${counts.open})` },
    { id: 'in_progress', label: `In progress (${counts.in_progress})` },
    { id: 'resolved', label: `Resolved (${counts.resolved})` },
    { id: 'closed', label: `Closed (${counts.closed})` },
  ];

  // ── Search dropdown ──
  const [searchFocused, setSearchFocused] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(e.target as Node)) setSearchFocused(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  const showHits = searchFocused && (query.trim().length >= 2);

  return (
    <Layout>
      <Helmet>
        <title>Support Hub — Real Estate on Purpose</title>
      </Helmet>

      <div className="mb-7">
        <span className="eye-label">Support Hub</span>
        <h1 className="font-display text-[clamp(2rem,2.6vw+0.6rem,2.5rem)] font-medium tracking-tighter leading-[1.1] text-reop-dark-blue mt-1.5">
          Answers, fast.
        </h1>
        <p className="text-[15px] text-muted-foreground mt-2 max-w-[640px] leading-relaxed">
          Search the knowledge base, open a ticket, or talk to a real human — whichever gets you unblocked soonest.
        </p>
      </div>

      {/* ── HERO: search ── */}
      <section
        className="relative overflow-hidden rounded-[14px] text-white px-9 py-8 mb-7"
        style={{ background: 'linear-gradient(135deg, hsl(var(--reop-dark-blue)), hsl(210 47% 20%))' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(184 100% 50% / 0.22), transparent 70%)' }}
        />
        <div className="relative">
          <h2 className="font-display text-[clamp(1.55rem,2vw+0.5rem,2rem)] font-medium tracking-[-0.035em] leading-[1.15] text-balance max-w-[640px] mb-2.5">
            What do you need help with?
          </h2>
          <p className="text-[14.5px] max-w-[560px] leading-[1.65]" style={{ color: 'hsl(210 30% 85%)' }}>
            {categories.length > 0
              ? `${categories.length} categories · ${featuredArticles.length} featured articles. Search by keyword or browse by topic — most questions are answered below.`
              : 'Search by keyword or browse by topic — most questions are answered below.'}
          </p>

          {/* Search bar */}
          <div ref={searchWrapRef} className="relative mt-5 max-w-[640px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search articles, shortcuts, or describe a problem…"
              className="w-full h-14 pl-14 pr-4 rounded-[12px] border-none text-[16px] text-reop-dark-blue bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(184_100%_50%)] focus:ring-offset-2"
              aria-label="Search the knowledge base"
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
            )}

            {/* Hits dropdown */}
            {showHits && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-border rounded-[12px] shadow-lg overflow-hidden max-h-[440px] overflow-y-auto">
                {searching && hits.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching…
                  </div>
                ) : hits.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-reop-dark-blue mb-1">No articles match.</p>
                    <p className="text-[12.5px] text-muted-foreground mb-3">
                      Try different keywords, or open a ticket and we'll help directly.
                    </p>
                    <Link
                      to="/support#new-ticket"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-[12px] font-semibold hover:bg-reop-teal-hover transition"
                      onClick={() => setSearchFocused(false)}
                    >
                      Open a ticket
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchFocused(false);
                            navigate(`/support/articles/${h.slug}`);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-reop-teal-soft transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-md bg-reop-teal-soft text-primary flex items-center justify-center flex-shrink-0">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[13.5px] font-semibold text-reop-dark-blue truncate">
                                {h.title}
                              </div>
                              <div className="text-[10.5px] uppercase tracking-[0.05em] font-bold text-primary mt-0.5">
                                {h.category_name}
                              </div>
                              {h.snippet && (
                                <p
                                  className="text-[12px] text-muted-foreground mt-1 leading-snug line-clamp-2"
                                  dangerouslySetInnerHTML={{
                                    __html: h.snippet
                                      .replace(/«/g, '<mark class="bg-amber-200/70 text-reop-dark-blue px-0.5 rounded">')
                                      .replace(/»/g, '</mark>'),
                                  }}
                                />
                              )}
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mt-2 flex-shrink-0" />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Popular queries */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 relative">
            <span className="text-[11.5px] py-1" style={{ color: 'hsl(184 60% 80%)' }}>
              Popular:
            </span>
            {POPULAR_QUERIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setQuery(p);
                  setSearchFocused(true);
                }}
                className="px-3 py-1.5 rounded-full text-[12px] cursor-pointer transition"
                style={{ background: 'hsl(210 47% 26%)', color: 'hsl(184 60% 90%)' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <div className="mb-7">
        <h2 className="font-display text-[20px] font-medium tracking-[-0.02em] text-reop-dark-blue mb-3">
          Browse the knowledge base
        </h2>
        {catsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading categories…
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((c) => {
              const Icon = ICON_BY_TOKEN[c.icon_token] ?? HelpCircle;
              const count = c.article_count ?? 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpenCategory(c)}
                  className="text-left bg-card border border-border rounded-[12px] px-5 py-5 transition hover:border-primary hover:-translate-y-0.5 hover:shadow-[0_8px_20px_hsl(184_100%_34%/0.10)]"
                >
                  <div className="w-[42px] h-[42px] rounded-[10px] bg-reop-teal-soft text-primary flex items-center justify-center mb-3.5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <b className="block text-base font-semibold text-reop-dark-blue mb-1">{c.name}</b>
                  {c.description && (
                    <p className="text-[12.5px] text-muted-foreground leading-[1.5] mb-2.5">
                      {c.description}
                    </p>
                  )}
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    {count === 0 ? 'Coming soon' : `${count} article${count === 1 ? '' : 's'}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 2-col: tickets + top FAQs ── */}
      <div id="new-ticket" className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 mb-7">
        {/* Tickets */}
        <div className="bg-card border border-border rounded-[12px] overflow-hidden flex flex-col">
          <div className="flex justify-between items-center px-5 py-4 border-b border-border flex-wrap gap-2">
            <h3 className="m-0 text-base font-semibold flex items-center gap-2 text-reop-dark-blue">
              <Inbox className="w-[15px] h-[15px] text-primary" />
              Your tickets
            </h3>
            <div className="relative max-w-[220px] w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tickets…"
                className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>

          <div className="px-5 py-3 border-b border-border">
            <div className="inline-flex gap-0.5 rounded-[9px] bg-[hsl(210_20%_94%)] p-[3px] flex-wrap">
              {filterOptions.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    'px-3 py-[6px] rounded-[7px] text-[12.5px] transition-all',
                    statusFilter === f.id
                      ? 'bg-card text-reop-dark-blue font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                      : 'text-muted-foreground hover:text-reop-dark-blue font-medium',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {ticketsLoading ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filteredTickets.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-reop-dark-blue mb-1">
                {tickets.length === 0 ? 'No tickets yet' : 'No tickets match your filters'}
              </p>
              <p className="text-[13px] text-muted-foreground max-w-[360px] mx-auto">
                {tickets.length === 0
                  ? "Search the KB above first — most answers are already there. If you're still stuck, the form opens one with two clicks."
                  : 'Try a different status or clear your search.'}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {filteredTickets.map((ticket, idx) => {
                const meta = statusMeta[ticket.status];
                const Icon = meta.Icon;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => { setSelectedTicket(ticket); setDetailOpen(true); }}
                    className={cn(
                      'w-full text-left grid grid-cols-[auto_1fr_auto] gap-3.5 px-5 py-3.5 items-center hover:bg-[hsl(210_20%_98.5%)] transition',
                      idx !== filteredTickets.length - 1 && 'border-b border-border',
                    )}
                  >
                    <div className={cn('w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0', meta.iconCls)}>
                      <Icon className={cn('w-3.5 h-3.5', ticket.status === 'in_progress' && 'animate-spin')} />
                    </div>
                    <div className="min-w-0">
                      <b className="text-sm font-semibold block mb-0.5 text-reop-dark-blue truncate">{ticket.subject}</b>
                      <span className="text-xs text-muted-foreground truncate block">
                        {categoryLabels[ticket.category] || ticket.category} · {ticket.priority} priority
                      </span>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground whitespace-nowrap flex flex-col items-end gap-1">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold', meta.pillCls)}>
                        {meta.label}
                      </span>
                      <span>
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {format(new Date(ticket.updated_at || ticket.created_at), 'MMM d')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Top FAQs */}
        <TopFaqsCard articles={featuredArticles} />
      </div>

      {/* ── Ticket form (below) ── */}
      <div className="mb-7">
        <TicketForm onSubmit={createTicket} isSubmitting={isCreating} />
      </div>

      <TicketDetailDialog
        ticket={selectedTicket}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedTicket(null);
        }}
      />

      <CategoryArticlesDialog
        category={openCategory}
        onClose={() => setOpenCategory(null)}
      />
    </Layout>
  );
}

// ── Category articles modal ───────────────────────────────────────────

function CategoryArticlesDialog({
  category, onClose,
}: { category: SupportCategory | null; onClose: () => void }) {
  // Fetch articles for the open category. The hook is keyed on categoryId
  // so re-opens get instant cache hits.
  const { articles, isLoading } = useSupportArticles({
    categoryId: category?.id,
    limit: 50,
  });
  const navigate = useNavigate();
  const Icon = category ? (ICON_BY_TOKEN[category.icon_token] ?? HelpCircle) : HelpCircle;

  return (
    <Dialog open={!!category} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[640px] max-h-[85vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border space-y-0">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-[10px] bg-reop-teal-soft text-primary flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[18px] font-semibold text-reop-dark-blue tracking-[-0.01em] text-left">
                {category?.name ?? 'Category'}
              </DialogTitle>
              {category?.description && (
                <DialogDescription className="text-[13px] text-muted-foreground leading-snug mt-1 text-left">
                  {category.description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Article list */}
        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading articles…
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm font-semibold text-reop-dark-blue mb-1">
                No articles in this category yet.
              </p>
              <p className="text-[13px] text-muted-foreground mb-4 max-w-[360px] mx-auto">
                We're still writing — in the meantime, search above or open a ticket below.
              </p>
              <Button
                onClick={onClose}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Close
              </Button>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {articles.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/support/articles/${a.slug}`);
                    }}
                    className="w-full text-left bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/40 hover:bg-reop-teal-soft/40 transition group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13.5px] font-semibold text-reop-dark-blue group-hover:text-primary transition">
                            {a.title}
                          </span>
                          {a.is_featured && (
                            <Star className="w-3 h-3 text-amber-500 fill-amber-400" aria-label="Featured" />
                          )}
                        </div>
                        {a.summary && (
                          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                            {a.summary}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground self-center group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Top FAQs (featured articles) ──────────────────────────────────────

function TopFaqsCard({ articles }: { articles: SupportArticle[] }) {
  return (
    <div className="bg-card border border-border rounded-[12px] p-5">
      <h3 className="m-0 mb-3.5 text-base font-semibold flex items-center gap-2">
        <HelpCircle className="w-[15px] h-[15px] text-primary" />
        Top FAQs this week
      </h3>
      {articles.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-2">
          Featured articles will show up here as admins flag them.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {articles.map((a) => (
            <li key={a.id}>
              <Link
                to={`/support/articles/${a.slug}`}
                className="block py-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[13.5px] font-medium text-reop-dark-blue group-hover:text-primary transition leading-snug">
                    {a.title}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1 group-hover:text-primary group-hover:translate-x-0.5 transition" />
                </div>
                {a.summary && (
                  <p className="text-[12px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                    {a.summary}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


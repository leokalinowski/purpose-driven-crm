import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Search as SearchIcon,
  Users,
  Briefcase,
  Calendar,
  FileText,
  Clock,
  Phone,
  Tag,
  Home,
  CheckCircle,
  Mail,
  Gift,
  Zap,
  UserPlus,
  Upload,
  CheckSquare,
  Keyboard,
  type LucideIcon,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';

type PillTone = 'primary' | 'warn' | 'ok' | 'plain' | 'muted';

const pillToneCls: Record<PillTone, string> = {
  primary: 'bg-primary/10 text-primary',
  warn: 'bg-[hsl(35_100%_94%)] text-[hsl(35_80%_45%)]',
  ok: 'bg-[hsl(140_40%_92%)] text-reop-green',
  plain: 'bg-[hsl(210_20%_94%)] text-secondary',
  muted: 'bg-[hsl(210_15%_92%)] text-muted-foreground',
};

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
        pillToneCls[tone],
      )}
    >
      {children}
    </span>
  );
}

const HL = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-[2px] bg-[hsl(45_100%_85%)] px-0.5 font-semibold text-[hsl(35_80%_25%)]">
    {children}
  </span>
);

type FilterKey = 'all' | 'contacts' | 'opportunities' | 'events' | 'resources';

const filters: { key: FilterKey; label: string; icon: LucideIcon; count: number }[] = [
  { key: 'all', label: 'All results', icon: SearchIcon, count: 12 },
  { key: 'contacts', label: 'Contacts', icon: Users, count: 4 },
  { key: 'opportunities', label: 'Opportunities', icon: Briefcase, count: 3 },
  { key: 'events', label: 'Events', icon: Calendar, count: 2 },
  { key: 'resources', label: 'Resources', icon: FileText, count: 3 },
];

const recents = ['Shoal Creek', 'David Chen', 'Spring Mixer', 'DNC'];

type ContactResult = {
  id: string;
  initials: string;
  avClass: string;
  name: React.ReactNode;
  meta: { icon: LucideIcon; text: React.ReactNode }[];
  badge: { tone: PillTone; label: string };
};

const contactResults: ContactResult[] = [
  {
    id: 'margaret-sullivan',
    initials: 'MS',
    avClass: 'bg-reop-teal-soft text-primary',
    name: (
      <>
        <HL>Margaret</HL> Sullivan
      </>
    ),
    meta: [
      { icon: Phone, text: '(512) 555-0194' },
      { icon: Tag, text: 'Past Client · A-List' },
      { icon: Clock, text: '18 days since touch' },
    ],
    badge: { tone: 'primary', label: 'Past Client' },
  },
  {
    id: 'margaret-ann-rivera',
    initials: 'MR',
    avClass: 'bg-[hsl(280_40%_88%)] text-[hsl(280_50%_35%)]',
    name: (
      <>
        <HL>Margaret</HL>-Ann Rivera
      </>
    ),
    meta: [
      { icon: Phone, text: '(512) 555-0277' },
      { icon: Tag, text: 'Sphere · B-List' },
      { icon: Clock, text: '42 days since touch' },
    ],
    badge: { tone: 'muted', label: 'Sphere' },
  },
  {
    id: 'jim-karen-ferguson',
    initials: 'JM',
    avClass: 'bg-[hsl(35_80%_88%)] text-[hsl(35_80%_35%)]',
    name: (
      <>
        Jim &amp; Karen Ferguson{' '}
        <span className="text-[12px] font-normal text-muted-foreground">
          (note: "<HL>margaret</HL> was a great referral source")
        </span>
      </>
    ),
    meta: [
      { icon: Phone, text: '(512) 555-0172' },
      { icon: Tag, text: 'Active Client' },
    ],
    badge: { tone: 'warn', label: 'Active' },
  },
  {
    id: 'david-lisa-park',
    initials: 'DP',
    avClass: 'bg-[hsl(140_40%_88%)] text-[hsl(140_55%_28%)]',
    name: (
      <>
        David &amp; Lisa Park{' '}
        <span className="text-[12px] font-normal text-muted-foreground">
          (referred by <HL>Margaret</HL> Sullivan)
        </span>
      </>
    ),
    meta: [
      { icon: Tag, text: 'Active Buyer · $400K' },
      { icon: Clock, text: '3 days since touch' },
    ],
    badge: { tone: 'ok', label: 'Buyer' },
  },
];

type DealResult = {
  id: string;
  icIcon: LucideIcon;
  icClass: string;
  title: React.ReactNode;
  sub: React.ReactNode;
  price: string;
  priceClass?: string;
};

const dealResults: DealResult[] = [
  {
    id: '412-ridgewood-listing',
    icIcon: Home,
    icClass: 'bg-[hsl(35_80%_92%)] text-[hsl(35_80%_38%)]',
    title: <>412 Ridgewood Dr — potential listing</>,
    sub: (
      <>
        Seller: <HL>Margaret</HL> Sullivan · In conversation · Spring 2025
      </>
    ),
    price: '$648K est.',
  },
  {
    id: '412-ridgewood-2021',
    icIcon: CheckCircle,
    icClass: 'bg-[hsl(140_40%_88%)] text-[hsl(140_55%_28%)]',
    title: <>412 Ridgewood Dr — closed 2021</>,
    sub: (
      <>
        Buyer: <HL>Margaret</HL> Sullivan · Closed Sep 2021
      </>
    ),
    price: '$512K',
    priceClass: 'text-[hsl(142_55%_28%)]',
  },
  {
    id: 'park-buyer-rep',
    icIcon: Users,
    icClass: 'bg-[hsl(210_60%_88%)] text-[hsl(210_80%_38%)]',
    title: <>David &amp; Lisa Park — buyer representation</>,
    sub: (
      <>
        Referred by <HL>Margaret</HL> Sullivan · Active · pre-approved $400K
      </>
    ),
    price: 'In progress',
    priceClass: 'text-[hsl(35_80%_38%)]',
  },
];

type EventResult = {
  id: string;
  mo: string;
  dn: string;
  badgeBg?: string;
  title: React.ReactNode;
  sub: React.ReactNode;
  pill: { tone: PillTone; label: string };
};

const eventResults: EventResult[] = [
  {
    id: 'spring-client-mixer',
    mo: 'Mar',
    dn: '22',
    title: (
      <>
        Spring Client Mixer — <HL>Margaret</HL> Sullivan confirmed
      </>
    ),
    sub: <>Bartlett's on the Lake · 47 invited · 31 confirmed</>,
    pill: { tone: 'ok', label: 'Confirmed' },
  },
  {
    id: 'fall-harvest-2024',
    mo: 'Nov',
    dn: '2',
    badgeBg: 'bg-[hsl(35_70%_40%)]',
    title: <>Fall Harvest Mixer — 2024</>,
    sub: (
      <>
        <HL>Margaret</HL> &amp; Robert attended · noted: "introduced herself to 3 guests"
      </>
    ),
    pill: { tone: 'muted', label: 'Past' },
  },
];

type ResourceResult = {
  id: string;
  icIcon: LucideIcon;
  icClass: string;
  title: React.ReactNode;
  sub: React.ReactNode;
  href: string;
};

const resourceResults: ResourceResult[] = [
  {
    id: 'note-jan8',
    icIcon: FileText,
    icClass: 'bg-reop-teal-soft text-primary',
    title: (
      <>
        Note: Jan 8 call with <HL>Margaret</HL> Sullivan
      </>
    ),
    sub: <>"...she mentioned downsizing plans, spring listing window..." · Contact notes</>,
    href: '/contacts/margaret-sullivan',
  },
  {
    id: 'newsletter-march',
    icIcon: Mail,
    icClass: 'bg-[hsl(280_40%_88%)] text-[hsl(280_50%_35%)]',
    title: (
      <>
        Newsletter — March issue mentions <HL>Margaret</HL>
      </>
    ),
    sub: <>Kowalski home anniversary shoutout section · Coach suggestion</>,
    href: '/newsletter',
  },
  {
    id: 'delight-birthday',
    icIcon: Gift,
    icClass: 'bg-[hsl(35_80%_88%)] text-[hsl(35_80%_35%)]',
    title: (
      <>
        Delight — Birthday gift to <HL>Margaret</HL> Sullivan
      </>
    ),
    sub: <>$40 spa gift card · Sent Mar 14, 2024 · Redeemed</>,
    href: '/delight',
  },
];

const quickActions: { icon: LucideIcon; title: string; sub: string; href: string }[] = [
  { icon: UserPlus, title: 'Add new contact', sub: 'Create a contact record', href: '/contacts/new' },
  { icon: Upload, title: 'Import contacts', sub: 'CSV upload & mapping', href: '/spheresync-tasks?tab=database' },
  { icon: Briefcase, title: 'New opportunity', sub: 'Start a transaction file', href: '/pipeline/new' },
  { icon: CheckSquare, title: 'Weekly check-in', sub: "Submit this week's numbers", href: '/spheresync-tasks?checkin=1' },
];

const recentActivity = [
  { title: 'Viewed — Margaret Sullivan', meta: 'Contact profile · 2 min ago' },
  { title: 'Updated — 4820 Shoal Creek', meta: 'Stage → Under contract · 1 hr ago' },
  { title: 'Sent — Spring Mixer invite', meta: '47 contacts · Jan 10' },
];

const shortcuts = [
  { label: 'Open search', keys: '⌘ K' },
  { label: 'Navigate results', keys: '↑ ↓' },
  { label: 'Open result', keys: '↵ Enter' },
  { label: 'Close', keys: 'Esc' },
];

export default function Search() {
  const [query, setQuery] = useState('Margaret');
  const [filter, setFilter] = useState<FilterKey>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showGroup = (key: Exclude<FilterKey, 'all'>) => filter === 'all' || filter === key;
  const isEmpty = useMemo(() => query.trim().length === 0, [query]);

  return (
    <Layout>
      <Helmet>
        <title>Search — REOP</title>
      </Helmet>

      <section className="relative mb-6 overflow-hidden rounded-[14px] bg-reop-dark-blue px-8 py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 50% 100%, hsl(184 100% 34% / 0.2), transparent 70%)',
          }}
        />
        <div className="relative">
          <h1 className="mb-[18px] text-[clamp(1.3rem,2vw+0.5rem,1.75rem)] font-medium tracking-[-0.03em] text-white">
            Search everything.
          </h1>
          <div className="relative max-w-[720px]">
            <SearchIcon className="absolute left-[18px] top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts, opportunities, events, resources…"
              autoFocus
              className="h-14 w-full rounded-xl bg-white pl-[52px] pr-[18px] text-[16px] text-reop-dark-blue shadow-[0_4px_20px_rgba(0,0,0,0.15)] outline-none focus:outline-2 focus:outline-[hsl(184_100%_50%)] focus:outline-offset-2"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-[5px] bg-[hsl(210_20%_95%)] px-2 py-[3px] text-[11px] text-muted-foreground">
              ⌘K
            </span>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-[hsl(210_30%_70%)]">Recent:</span>
            {recents.map((r) => (
              <button
                key={r}
                onClick={() => setQuery(r)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-[5px] text-[12px] text-[hsl(210_30%_85%)] transition-colors hover:bg-white/20"
              >
                <Clock className="h-3 w-3" />
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-6 flex gap-0 overflow-x-auto border-b border-border">
        {filters.map((f) => {
          const Icon = f.icon;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-[18px] py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-reop-dark-blue',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10.5px] font-semibold',
                  active ? 'bg-reop-teal-soft text-primary' : 'bg-[hsl(210_20%_93%)] text-muted-foreground',
                )}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_280px]">
        <div>
          {isEmpty ? (
            <div className="px-5 py-16 text-center text-muted-foreground">
              <div className="mb-4 inline-flex h-[60px] w-[60px] items-center justify-center rounded-[14px] bg-reop-teal-soft text-primary">
                <SearchIcon className="h-[26px] w-[26px]" />
              </div>
              <h4 className="mb-1.5 text-base text-reop-dark-blue">Start typing to search</h4>
              <p className="mx-auto max-w-[320px] text-sm">
                Search across contacts, opportunities, events, notes, and resources.
              </p>
            </div>
          ) : (
            <>
              {showGroup('contacts') && (
                <div className="mb-7">
                  <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                    <Users className="h-[13px] w-[13px]" />
                    Contacts
                  </div>
                  {contactResults.map((c) => (
                    <Link
                      key={c.id}
                      to={`/contacts/${c.id}`}
                      className="mb-2 grid grid-cols-[40px_1fr_auto] items-center gap-3.5 rounded-[10px] border border-border bg-card px-4 py-3.5 text-inherit no-underline transition-all hover:border-primary hover:shadow-[0_2px_10px_hsl(184_100%_34%_/0.08)]"
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                          c.avClass,
                        )}
                      >
                        {c.initials}
                      </div>
                      <div>
                        <b className="mb-[3px] block text-sm font-semibold">{c.name}</b>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[12.5px] text-muted-foreground">
                          {c.meta.map((m, i) => {
                            const Icon = m.icon;
                            return (
                              <span key={i} className="inline-flex items-center gap-1">
                                <Icon className="h-[11px] w-[11px]" />
                                {m.text}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <Pill tone={c.badge.tone}>{c.badge.label}</Pill>
                    </Link>
                  ))}
                </div>
              )}

              {showGroup('opportunities') && (
                <div className="mb-7">
                  <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                    <Briefcase className="h-[13px] w-[13px]" />
                    Opportunities
                  </div>
                  {dealResults.map((d) => {
                    const Icon = d.icIcon;
                    return (
                      <Link
                        key={d.id}
                        to={`/pipeline/${d.id}`}
                        className="mb-2 grid grid-cols-[36px_1fr_auto] items-center gap-3.5 rounded-[10px] border border-border bg-card px-4 py-3.5 text-inherit no-underline transition-all hover:border-primary hover:shadow-[0_2px_10px_hsl(184_100%_34%_/0.08)]"
                      >
                        <div
                          className={cn(
                            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                            d.icClass,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <b className="mb-[3px] block text-sm font-semibold">{d.title}</b>
                          <div className="text-[12.5px] text-muted-foreground">{d.sub}</div>
                        </div>
                        <div
                          className={cn(
                            'whitespace-nowrap text-sm font-bold text-primary',
                            d.priceClass,
                          )}
                        >
                          {d.price}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {showGroup('events') && (
                <div className="mb-7">
                  <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                    <Calendar className="h-[13px] w-[13px]" />
                    Events
                  </div>
                  {eventResults.map((e) => (
                    <Link
                      key={e.id}
                      to={`/events/${e.id}`}
                      className="mb-2 grid grid-cols-[52px_1fr_auto] items-center gap-3.5 rounded-[10px] border border-border bg-card px-4 py-3.5 text-inherit no-underline transition-all hover:border-primary hover:shadow-[0_2px_10px_hsl(184_100%_34%_/0.08)]"
                    >
                      <div
                        className={cn(
                          'flex-shrink-0 rounded-lg px-2.5 py-1.5 text-center text-white',
                          e.badgeBg ?? 'bg-reop-dark-blue',
                        )}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-[0.07em] text-[hsl(184_60%_80%)]">
                          {e.mo}
                        </div>
                        <div className="text-lg font-semibold leading-[1.1]">{e.dn}</div>
                      </div>
                      <div>
                        <b className="mb-[3px] block text-sm font-semibold">{e.title}</b>
                        <div className="text-[12.5px] text-muted-foreground">{e.sub}</div>
                      </div>
                      <Pill tone={e.pill.tone}>{e.pill.label}</Pill>
                    </Link>
                  ))}
                </div>
              )}

              {showGroup('resources') && (
                <div className="mb-7">
                  <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                    <FileText className="h-[13px] w-[13px]" />
                    Resources &amp; notes
                  </div>
                  {resourceResults.map((r) => {
                    const Icon = r.icIcon;
                    return (
                      <div
                        key={r.id}
                        className="mb-2 grid grid-cols-[36px_1fr_auto] items-center gap-3.5 rounded-[10px] border border-border bg-card px-4 py-3.5 transition-all hover:border-primary hover:shadow-[0_2px_10px_hsl(184_100%_34%_/0.08)]"
                      >
                        <div
                          className={cn(
                            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                            r.icClass,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <b className="mb-[3px] block text-sm font-semibold">{r.title}</b>
                          <div className="text-[12.5px] text-muted-foreground">{r.sub}</div>
                        </div>
                        <Link
                          to={r.href}
                          className="whitespace-nowrap text-[12px] font-semibold text-primary"
                        >
                          View →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-3.5">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-reop-dark-blue">
                Quick actions
              </h3>
            </div>
            <div className="flex flex-col gap-2 p-3.5">
              {quickActions.map((q) => {
                const Icon = q.icon;
                return (
                  <Link
                    key={q.title}
                    to={q.href}
                    className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card px-3.5 py-3 text-sm text-reop-dark-blue transition-colors hover:border-primary hover:bg-[hsl(184_100%_98%)]"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[7px] bg-reop-teal-soft text-primary">
                      <Icon className="h-[15px] w-[15px]" />
                    </div>
                    <div className="leading-tight">
                      <b className="block font-semibold">{q.title}</b>
                      <span className="text-[11.5px] text-muted-foreground">{q.sub}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-reop-dark-blue">
                Recent activity
              </h3>
            </div>
            <div className="px-4">
              <div className="flex flex-col">
                {recentActivity.map((a, i) => (
                  <div
                    key={a.title}
                    className={cn(
                      'py-2.5 text-[12.5px]',
                      i < recentActivity.length - 1 && 'border-b border-border',
                    )}
                  >
                    <div className="mb-0.5 font-semibold text-reop-dark-blue">{a.title}</div>
                    <div className="text-muted-foreground">{a.meta}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Keyboard className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-reop-dark-blue">
                Keyboard shortcuts
              </h3>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {shortcuts.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="rounded-[4px] bg-[hsl(210_20%_94%)] px-[7px] py-0.5 font-mono text-[11px]">
                    {s.keys}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  );
}

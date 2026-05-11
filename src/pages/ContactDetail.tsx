import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  FolderOpen,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Pencil,
  MoreHorizontal,
  Star,
  Users,
  User,
  Home,
  Activity,
  Briefcase,
  FileText,
  Gift,
  Plus,
  Send,
  Calendar,
  CalendarHeart,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckSquare,
  BarChart2,
  Package,
  Heart,
  type LucideIcon,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { LogTouchModal } from '@/components/shared/LogTouchModal';
import { cn } from '@/lib/utils';

type TabKey = 'overview' | 'touchpoints' | 'deals' | 'notes' | 'delight';
type PillTone = 'primary' | 'accent' | 'warn' | 'ok' | 'plain' | 'muted';
type DotKind = 'call' | 'email' | 'event' | 'note' | 'gift';

const pillToneCls: Record<PillTone, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-[hsl(74_50%_92%)] text-[hsl(74_61%_28%)]',
  warn: 'bg-[hsl(35_100%_94%)] text-[hsl(35_80%_45%)]',
  ok: 'bg-[hsl(140_40%_92%)] text-reop-green',
  plain: 'bg-[hsl(210_20%_94%)] text-secondary',
  muted: 'bg-[hsl(210_15%_92%)] text-muted-foreground',
};

const dotCls: Record<DotKind, { wrap: string; icon: LucideIcon }> = {
  call: { wrap: 'bg-[hsl(184_60%_92%)] text-[hsl(184_100%_28%)]', icon: Phone },
  email: { wrap: 'bg-[hsl(210_60%_93%)] text-[hsl(210_80%_40%)]', icon: Mail },
  event: { wrap: 'bg-[hsl(74_50%_90%)] text-[hsl(74_61%_30%)]', icon: Calendar },
  note: { wrap: 'bg-[hsl(45_93%_92%)] text-[hsl(35_80%_32%)]', icon: FileText },
  gift: { wrap: 'bg-[hsl(300_40%_92%)] text-[hsl(300_50%_35%)]', icon: Gift },
};

type Touchpoint = {
  kind: DotKind;
  title: string;
  body: string;
  note?: string;
  time: string;
};

const touchpoints: Touchpoint[] = [
  {
    kind: 'call',
    title: 'Outbound call — 12 min',
    body: "Checked in on the holidays, mentioned Robert's retirement coming up. She asked about market conditions for empty nesters looking to downsize.",
    note: '"She\'s open to the idea of listing in spring if prices hold. Follow up in Feb — she mentioned looking at the Mueller area."',
    time: 'Jan 8, 2025',
  },
  {
    kind: 'email',
    title: 'Holiday e-newsletter sent',
    body: 'Monthly newsletter — opened, clicked 2 links including "Austin market update."',
    time: 'Dec 15, 2024',
  },
  {
    kind: 'gift',
    title: 'Surprise & Delight — Holiday gift sent',
    body: 'Artisan food basket · $65 · Delivered Dec 12. Handwritten card included.',
    time: 'Dec 12, 2024',
  },
  {
    kind: 'event',
    title: 'Client Appreciation Mixer — attended',
    body: 'Fall Harvest event at Barton Creek. Arrived with Robert. Introduced to 2 other past clients — possible referral group dynamic.',
    time: 'Nov 2, 2024',
  },
  {
    kind: 'call',
    title: 'Outbound call — 8 min',
    body: 'Quick market check-in. Home equity conversation. She was curious about value — shared estimate.',
    time: 'Sep 5, 2024',
  },
  {
    kind: 'note',
    title: '3-year move-in anniversary card sent',
    body: 'Automated milestone — handwritten card via Postable. No reply received.',
    time: 'Sep 18, 2024',
  },
  {
    kind: 'call',
    title: 'Referral received — David & Lisa Park',
    body: "Margaret referred the Parks — they're looking for a starter home under $400K. Active buyers, pre-approved.",
    time: 'Jun 14, 2024',
  },
];

const tabs: { key: TabKey; label: string; icon: LucideIcon; count?: number }[] = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'touchpoints', label: 'Touchpoints', icon: Activity, count: 14 },
  { key: 'deals', label: 'Opportunities', icon: Briefcase, count: 2 },
  { key: 'notes', label: 'Notes', icon: FileText, count: 5 },
  { key: 'delight', label: 'Delight', icon: Gift, count: 3 },
];

const tierItems: { lab: string; val: string; icon?: LucideIcon; tone?: string }[] = [
  { lab: 'Sphere Tier', val: 'A-List', icon: Star },
  { lab: 'Last Touch', val: '18 days ago', tone: 'text-[hsl(35_80%_38%)]' },
  { lab: 'Touchpoints YTD', val: '7 of 12' },
  { lab: 'Referrals Sent', val: '3', icon: Users },
  { lab: 'Relationship Since', val: 'Apr 2019' },
  { lab: 'Source', val: 'Open House' },
];

type Note = { author: string; initials: string; ts: string; body: string };
const notesData: Note[] = [
  {
    author: 'Jordan Kim',
    initials: 'JK',
    ts: 'Jan 8, 2025 · 10:22 am',
    body: "Called to check in after the holidays. She mentioned Robert is retiring in March and they've been thinking seriously about downsizing — wants something single-story in a walkable neighborhood. Mueller or South Congress area. Said she'd want to list before summer. Following up in mid-Feb.",
  },
  {
    author: 'Jordan Kim',
    initials: 'JK',
    ts: 'Nov 2, 2024 · 7:48 pm',
    body: 'Margaret and Robert both came to the Fall Mixer. She was very enthusiastic — introduced herself to other guests unprompted. Mentioned she tells everyone about me. Strong referral energy. Consider inviting her to be a "host ambassador" at the spring event.',
  },
  {
    author: 'Jordan Kim',
    initials: 'JK',
    ts: 'Sep 5, 2024 · 2:15 pm',
    body: 'Equity call — walked her through the $648K estimate. She was surprised and happy. Robert has been talking about retiring — she\'s thinking spring listing is realistic if prices hold through winter.',
  },
];

type TaskItem = { title: string; meta: string; done?: boolean };
const tasksData: TaskItem[] = [
  { title: 'Call re: spring listing walkthrough', meta: 'Due Jan 26, 2025' },
  { title: 'Send Mueller neighborhood CMA', meta: 'Due Feb 3, 2025' },
  { title: 'Birthday gift — order by Mar 10', meta: 'Mar 10, 2025' },
  { title: 'Send holiday gift basket', meta: 'Completed Dec 12', done: true },
  { title: 'Holiday newsletter send', meta: 'Completed Dec 15', done: true },
];

function Pill({ children, tone = 'muted' }: { children: React.ReactNode; tone?: PillTone }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-semibold', pillToneCls[tone])}>
      {children}
    </span>
  );
}

function PanelHead({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
      <h3 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-reop-dark-blue">
        <Icon className="w-4 h-4 text-primary" />
        {title}
      </h3>
      {action}
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-2.5 border-b border-border last:border-b-0 text-sm items-baseline">
      <span className="text-[12.5px] text-muted-foreground">{k}</span>
      <span className="font-medium text-reop-dark-blue">{v}</span>
    </div>
  );
}

export default function ContactDetail() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [logOpen, setLogOpen] = useState(false);
  const [touchFilter, setTouchFilter] = useState<'All' | 'Calls' | 'Emails' | 'Events' | 'Notes'>('All');
  const [tasks, setTasks] = useState(tasksData);
  const [noteText, setNoteText] = useState('');

  const contactName = 'Margaret Sullivan';

  const filtered = touchpoints.filter((t) => {
    if (touchFilter === 'All') return true;
    if (touchFilter === 'Calls') return t.kind === 'call';
    if (touchFilter === 'Emails') return t.kind === 'email';
    if (touchFilter === 'Events') return t.kind === 'event';
    if (touchFilter === 'Notes') return t.kind === 'note';
    return true;
  });

  return (
    <Layout>
      <Helmet>
        <title>{contactName} — REOP</title>
      </Helmet>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-4">
        <Link
          to="/spheresync-tasks?tab=database"
          className="inline-flex items-center gap-1 hover:text-reop-dark-blue transition-colors"
        >
          <FolderOpen className="w-[13px] h-[13px]" />
          Database
        </Link>
        <ChevronRight className="w-[13px] h-[13px] opacity-50" />
        <span className="text-reop-dark-blue font-medium">{contactName}</span>
      </nav>

      {/* Hero band */}
      <div className="relative overflow-hidden bg-card border border-border rounded-[14px] px-8 py-7 mb-6">
        <div
          aria-hidden
          className="absolute -right-20 -top-20 w-[320px] h-[320px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsl(184 100% 34% / 0.07), transparent 70%)' }}
        />
        <div className="relative grid gap-6 [grid-template-columns:auto_1fr_auto] items-start max-[860px]:[grid-template-columns:auto_1fr]">
          {/* Avatar */}
          <div className="w-[72px] h-[72px] rounded-full bg-reop-dark-blue text-white flex items-center justify-center text-2xl font-semibold flex-shrink-0 border-[3px] border-white shadow-[0_0_0_2px_hsl(var(--reop-teal-soft))]">
            MS
          </div>

          {/* Name + meta */}
          <div className="min-w-0">
            <h1 className="text-[clamp(1.35rem,2vw+0.5rem,1.75rem)] font-medium tracking-[-0.03em] leading-[1.15] mb-1.5">
              {contactName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-[13px] h-[13px]" />
                <a href="tel:+15125550194" className="text-primary hover:underline">
                  (512) 555-0194
                </a>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-[13px] h-[13px]" />
                <a href="mailto:margaret.sullivan@email.com" className="text-primary hover:underline">
                  margaret.sullivan@email.com
                </a>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-[13px] h-[13px]" />
                Austin, TX 78701
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <Pill tone="primary">Past Client</Pill>
              <Pill tone="accent">Referral Source</Pill>
              <Pill tone="muted">Homeowner</Pill>
              <Pill tone="muted">Empty Nester</Pill>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 max-[860px]:col-span-full">
            <Button className="h-9 gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Call
            </Button>
            <Button variant="outline" className="h-9 gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Email
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => setLogOpen(true)}>
              <Pencil className="w-3.5 h-3.5" />
              Log Touch
            </Button>
            <Button variant="outline" className="h-9 w-9 p-0">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Tier strip */}
        <div className="relative flex flex-wrap gap-x-6 gap-y-3 pt-4 mt-[18px] border-t border-border">
          {tierItems.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.lab} className="flex flex-col gap-0.5">
                <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-bold">
                  {it.lab}
                </span>
                <span className={cn('text-sm font-semibold text-reop-dark-blue inline-flex items-center gap-1.5', it.tone)}>
                  {Icon && <Icon className="w-[13px] h-[13px] text-primary" />}
                  {it.val}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Left column with tabs */}
        <div className="min-w-0">
          <div className="flex border-b border-border mb-6 overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-[18px] py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                    active
                      ? 'text-primary border-primary font-semibold'
                      : 'text-muted-foreground border-transparent hover:text-reop-dark-blue',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.count !== undefined && (
                    <span
                      className={cn(
                        'text-[10.5px] px-1.5 py-px rounded-full font-semibold',
                        active ? 'bg-reop-teal-soft text-primary' : 'bg-[hsl(210_20%_93%)] text-muted-foreground',
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Overview */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <PanelHead
                  icon={User}
                  title="Contact Details"
                  action={
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Button>
                  }
                />
                <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <div>
                    <InfoRow k="Full name" v="Margaret Ann Sullivan" />
                    <InfoRow k="Mobile" v={<a href="tel:+15125550194" className="text-primary hover:underline">(512) 555-0194</a>} />
                    <InfoRow k="Email" v={<a href="mailto:margaret.sullivan@email.com" className="text-primary hover:underline">margaret.sullivan@email.com</a>} />
                    <InfoRow k="Spouse / Partner" v="Robert Sullivan" />
                    <InfoRow k="Home address" v="412 Ridgewood Dr, Austin TX 78701" />
                  </div>
                  <div>
                    <InfoRow
                      k="Birthday"
                      v={
                        <>
                          March 14 <span className="text-xs text-primary font-semibold ml-1">— 47 days away</span>
                        </>
                      }
                    />
                    <InfoRow k="Anniversary" v="June 22" />
                    <InfoRow k="Move-in date" v="Sep 18, 2021" />
                    <InfoRow k="Home value est." v="$648,000" />
                    <InfoRow k="Preferred contact" v="Phone — mornings" />
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <PanelHead icon={Home} title="Property" />
                <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <div>
                    <InfoRow k="Address" v="412 Ridgewood Dr" />
                    <InfoRow k="Purchased" v="Sep 18, 2021 · $512,000" />
                    <InfoRow k="Type" v="Single Family — 4 bed / 3 bath" />
                  </div>
                  <div>
                    <InfoRow k="Estimated value" v={<span className="text-primary font-semibold">$648,000</span>} />
                    <InfoRow k="Equity est." v={<span className="text-[hsl(142_55%_28%)] font-semibold">$136,000</span>} />
                    <InfoRow k="Years owned" v="3.6 yrs" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Touchpoints */}
          {tab === 'touchpoints' && (
            <div>
              <div className="flex justify-between items-center mb-5 flex-wrap gap-2.5">
                <div className="inline-flex gap-0.5 rounded-[9px] bg-[hsl(210_20%_94%)] p-[3px]">
                  {(['All', 'Calls', 'Emails', 'Events', 'Notes'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setTouchFilter(opt)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs transition-colors',
                        touchFilter === opt
                          ? 'bg-card text-reop-dark-blue font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                          : 'text-muted-foreground hover:text-reop-dark-blue',
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <Button size="sm" className="gap-1.5" onClick={() => setLogOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Log Touch
                </Button>
              </div>

              <div className="bg-card border border-border rounded-xl">
                <div className="px-5">
                  <div className="flex flex-col">
                    {filtered.map((t, idx) => {
                      const dot = dotCls[t.kind];
                      const Icon = dot.icon;
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[36px_1fr_auto] gap-3.5 py-3.5 border-b border-border last:border-b-0 items-start"
                        >
                          <div className={cn('w-[34px] h-[34px] rounded-full flex items-center justify-center mt-px', dot.wrap)}>
                            <Icon className="w-[15px] h-[15px]" />
                          </div>
                          <div className="min-w-0">
                            <b className="block text-sm font-semibold mb-0.5 text-reop-dark-blue">{t.title}</b>
                            <p className="text-[13px] text-muted-foreground leading-relaxed m-0">{t.body}</p>
                            {t.note && (
                              <div className="mt-2 px-3 py-2.5 bg-[hsl(210_20%_97%)] rounded-lg text-[13px] text-reop-dark-blue leading-relaxed border-l-[3px] border-[hsl(210_20%_85%)]">
                                {t.note}
                              </div>
                            )}
                          </div>
                          <span className="text-[11.5px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                            {t.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Opportunities */}
          {tab === 'deals' && (
            <div className="flex flex-col gap-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <PanelHead
                  icon={Briefcase}
                  title="Associated Opportunities"
                  action={
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                      <Plus className="w-3 h-3" />
                      New opportunity
                    </Button>
                  }
                />
                <div className="px-5">
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 py-4 border-b border-border items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[hsl(140_50%_45%)]" />
                    <div>
                      <b className="block text-sm font-semibold mb-0.5 text-reop-dark-blue">412 Ridgewood Dr</b>
                      <span className="text-[12.5px] text-muted-foreground">Buyer representation · Closed Sep 18, 2021</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[15px] font-semibold text-primary whitespace-nowrap">$512,000</div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5">GCI $15,360</div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8" asChild>
                      <Link to="/pipeline/1">View →</Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 py-4 items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[hsl(35_85%_50%)]" />
                    <div>
                      <b className="block text-sm font-semibold mb-0.5 text-reop-dark-blue">412 Ridgewood Dr — potential listing</b>
                      <span className="text-[12.5px] text-muted-foreground">Seller representation · In conversation</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[15px] font-semibold text-primary whitespace-nowrap">$648,000 est.</div>
                      <div className="text-[11.5px] text-[hsl(35_80%_38%)] mt-0.5">Spring 2025</div>
                    </div>
                    <Button size="sm" className="h-8" asChild>
                      <Link to="/pipeline/2">View →</Link>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <PanelHead icon={Users} title="Referrals from Margaret" />
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10.5px] uppercase tracking-[0.07em] text-muted-foreground font-bold border-b border-border">
                        <th className="text-left px-5 py-2.5 font-bold">Contact</th>
                        <th className="text-left px-5 py-2.5 font-bold">Status</th>
                        <th className="text-left px-5 py-2.5 font-bold">Date referred</th>
                        <th className="text-left px-5 py-2.5 font-bold">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          initials: 'DP',
                          avBg: 'bg-[hsl(210_60%_88%)] text-[hsl(210_80%_35%)]',
                          name: 'David & Lisa Park',
                          status: { label: 'Active buyer', tone: 'warn' as PillTone },
                          date: 'Jun 14, 2024',
                          outcome: 'In pipeline',
                        },
                        {
                          initials: 'TC',
                          avBg: 'bg-[hsl(140_40%_88%)] text-[hsl(140_55%_28%)]',
                          name: 'Tom Chen',
                          status: { label: 'Closed', tone: 'ok' as PillTone },
                          date: 'Mar 2, 2023',
                          outcome: 'Closed $389K · May 2023',
                        },
                        {
                          initials: 'NR',
                          avBg: 'bg-[hsl(300_30%_88%)] text-[hsl(300_50%_30%)]',
                          name: 'Nina & Carlos Reyes',
                          status: { label: 'Nurture', tone: 'muted' as PillTone },
                          date: 'Oct 11, 2022',
                          outcome: 'Buying in 2026',
                        },
                      ].map((r) => (
                        <tr key={r.name} className="border-b border-border last:border-b-0 text-sm">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold', r.avBg)}>
                                {r.initials}
                              </div>
                              <span className="font-medium text-reop-dark-blue">{r.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <Pill tone={r.status.tone}>{r.status.label}</Pill>
                          </td>
                          <td className="px-5 py-3 text-[12.5px] text-muted-foreground">{r.date}</td>
                          <td className="px-5 py-3 text-[12.5px] text-muted-foreground">{r.outcome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {tab === 'notes' && (
            <div className="flex flex-col gap-5">
              <div className="bg-[hsl(210_20%_98%)] border border-border rounded-[10px] px-4 py-3.5">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={`Add a note about ${contactName.split(' ')[0]}…`}
                  className="w-full min-h-[80px] border-0 bg-transparent text-sm text-reop-dark-blue resize-none outline-none leading-relaxed"
                />
                <div className="flex justify-between items-center pt-2.5 border-t border-border mt-2.5">
                  <span className="text-xs text-muted-foreground">Visible only to you</span>
                  <Button size="sm" className="gap-1.5">
                    <Send className="w-3 h-3" />
                    Save note
                  </Button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5">
                  {notesData.map((n, idx) => (
                    <div key={idx} className="border-b border-border last:border-b-0 py-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-reop-dark-blue text-white flex items-center justify-center text-[11px] font-semibold">
                            {n.initials}
                          </div>
                          <span className="text-[13px] font-semibold text-reop-dark-blue">{n.author}</span>
                        </div>
                        <span className="text-[11.5px] text-muted-foreground">{n.ts}</span>
                      </div>
                      <p className="text-sm text-reop-dark-blue leading-relaxed m-0">{n.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Delight */}
          {tab === 'delight' && (
            <div className="flex flex-col gap-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <PanelHead
                  icon={CalendarHeart}
                  title="Upcoming Occasions"
                  action={
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                      <Plus className="w-3 h-3" />
                      Add occasion
                    </Button>
                  }
                />
                <div className="px-5">
                  {[
                    {
                      mo: 'Mar',
                      dn: '14',
                      title: "Margaret's Birthday",
                      sub: '47 days away · Last gifted: $40 spa gift card (Mar 2024)',
                      cta: { label: 'Send gift', icon: Gift, primary: true },
                    },
                    {
                      mo: 'Jun',
                      dn: '22',
                      title: 'Wedding Anniversary',
                      sub: '153 days away · Robert & Margaret · 34th',
                      cta: { label: 'Plan gift', icon: Gift, primary: false },
                    },
                    {
                      mo: 'Sep',
                      dn: '18',
                      title: '4-Year Home Anniversary',
                      sub: '233 days away · 412 Ridgewood Dr',
                      cta: { label: 'Plan card', icon: Mail, primary: false },
                    },
                  ].map((o, idx, arr) => {
                    const CtaIcon = o.cta.icon;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'grid grid-cols-[52px_1fr_auto] gap-3.5 py-3.5 items-center',
                          idx < arr.length - 1 && 'border-b border-border',
                        )}
                      >
                        <div className="bg-[hsl(210_20%_96%)] rounded-lg px-2 py-1.5 text-center">
                          <div className="text-[10px] uppercase tracking-[0.07em] font-bold text-primary">{o.mo}</div>
                          <div className="text-[18px] font-semibold leading-[1.1]">{o.dn}</div>
                        </div>
                        <div>
                          <b className="block text-sm font-semibold mb-0.5 text-reop-dark-blue">{o.title}</b>
                          <span className="text-xs text-muted-foreground">{o.sub}</span>
                        </div>
                        <Button
                          size="sm"
                          variant={o.cta.primary ? 'default' : 'outline'}
                          className="h-8 gap-1.5"
                        >
                          <CtaIcon className="w-3 h-3" />
                          {o.cta.label}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <PanelHead icon={Gift} title="Gift History" />
                <div className="px-5">
                  {[
                    {
                      icon: Package,
                      title: 'Holiday Artisan Food Basket',
                      sub: 'Dec 12, 2024 · $65 · Delivered',
                      pill: 'Delivered',
                    },
                    {
                      icon: Heart,
                      title: 'Birthday — Spa Gift Card',
                      sub: 'Mar 14, 2024 · $40 · Austin Spa House',
                      pill: 'Redeemed',
                    },
                    {
                      icon: Home,
                      title: 'Home Anniversary — Succulent & Card',
                      sub: 'Sep 18, 2023 · $28 · Delivered',
                      pill: 'Delivered',
                    },
                  ].map((g, idx, arr) => {
                    const Icon = g.icon;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'grid grid-cols-[44px_1fr_auto] gap-3.5 py-3 items-center text-sm',
                          idx < arr.length - 1 && 'border-b border-border',
                        )}
                      >
                        <div className="w-10 h-10 rounded-lg bg-[hsl(300_30%_92%)] text-[hsl(300_50%_35%)] flex items-center justify-center">
                          <Icon className="w-[18px] h-[18px]" />
                        </div>
                        <div>
                          <b className="block font-semibold mb-0.5 text-reop-dark-blue">{g.title}</b>
                          <span className="text-xs text-muted-foreground">{g.sub}</span>
                        </div>
                        <Pill tone="ok">{g.pill}</Pill>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          {/* Coach signals */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <PanelHead icon={Sparkles} title="Coach Signals" />
            <div className="px-5 py-4 flex flex-col gap-2.5">
              <div className="px-3.5 py-3 rounded-[10px] bg-[hsl(142_71%_96%)] border border-[hsl(142_40%_82%)] text-[13px] leading-[1.55] text-reop-dark-blue">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em] font-bold text-[hsl(142_55%_28%)] mb-1.5">
                  <TrendingUp className="w-3 h-3" />
                  Top opportunity
                </div>
                Margaret mentioned downsizing plans on your Jan 8 call. Spring listing window opens in ~8 weeks — now is the time to schedule a home walkthrough.
              </div>
              <div className="px-3.5 py-3 rounded-[10px] bg-[hsl(0_84%_97%)] border border-[hsl(0_50%_85%)] text-[13px] leading-[1.55] text-reop-dark-blue">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em] font-bold text-[hsl(0_72%_45%)] mb-1.5">
                  <AlertCircle className="w-3 h-3" />
                  At-risk signal
                </div>
                18 days since last contact. A-list contacts need a touch every 30 days. You're approaching the threshold — call before Jan 26.
              </div>
              <div className="px-3.5 py-3 rounded-[10px] bg-[hsl(184_100%_97%)] border border-[hsl(184_50%_85%)] text-[13px] leading-[1.55] text-reop-dark-blue">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em] font-bold text-primary mb-1.5">
                  <Users className="w-3 h-3" />
                  Referral momentum
                </div>
                3 referrals sent. The Parks are active buyers — their closing strengthens Margaret's trust and increases repeat referral likelihood.
              </div>
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <PanelHead
              icon={CheckSquare}
              title="Tasks"
              action={
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              }
            />
            <div className="px-5">
              {tasks.map((t, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[18px_1fr] gap-2.5 py-2.5 border-b border-border last:border-b-0 items-start text-sm"
                >
                  <button
                    onClick={() =>
                      setTasks((arr) =>
                        arr.map((x, i) => (i === idx ? { ...x, done: !x.done } : x)),
                      )
                    }
                    aria-pressed={!!t.done}
                    aria-label={t.done ? 'Mark task incomplete' : 'Mark task complete'}
                    className={cn(
                      'relative w-4 h-4 rounded mt-0.5 cursor-pointer transition-colors',
                      t.done
                        ? 'bg-reop-green border-[1.5px] border-reop-green'
                        : 'bg-card border-[1.5px] border-border hover:border-primary/40',
                    )}
                  >
                    {t.done && (
                      <span
                        className="absolute top-[2px] left-[3px] w-2 h-[5px] border-l-2 border-b-2 border-white"
                        style={{ transform: 'rotate(-45deg)' }}
                      />
                    )}
                  </button>
                  <div className={cn('min-w-0', t.done && 'opacity-45 line-through')}>
                    <b className="block font-medium text-reop-dark-blue mb-0.5">{t.title}</b>
                    <span className="text-[11.5px] text-muted-foreground">{t.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relationship Health */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <PanelHead icon={BarChart2} title="Relationship Health" />
            <div className="px-5 py-4">
              <div className="flex flex-col gap-3.5">
                <div>
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span className="text-muted-foreground">Touchpoint cadence</span>
                    <span className="font-semibold text-[hsl(35_80%_38%)]">7 / 12 YTD</span>
                  </div>
                  <div className="h-1.5 bg-[hsl(210_20%_94%)] rounded-full overflow-hidden">
                    <span className="block h-full rounded-full bg-[hsl(35_80%_55%)]" style={{ width: '58%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span className="text-muted-foreground">Email engagement</span>
                    <span className="font-semibold text-[hsl(142_55%_28%)]">Opens 89%</span>
                  </div>
                  <div className="h-1.5 bg-[hsl(210_20%_94%)] rounded-full overflow-hidden">
                    <span className="block h-full rounded-full bg-primary" style={{ width: '89%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span className="text-muted-foreground">Event attendance</span>
                    <span className="font-semibold text-reop-dark-blue">3 of 4</span>
                  </div>
                  <div className="h-1.5 bg-[hsl(210_20%_94%)] rounded-full overflow-hidden">
                    <span className="block h-full rounded-full bg-primary" style={{ width: '75%' }} />
                  </div>
                </div>
              </div>
              <div className="mt-[18px] pt-3.5 border-t border-border">
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-bold mb-2.5">
                  Lifetime value
                </div>
                <div className="text-[28px] font-semibold tracking-[-0.02em] text-primary leading-none">$15,360</div>
                <div className="text-xs text-muted-foreground mt-1">GCI from 1 closing + 2 referral closings</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LogTouchModal open={logOpen} contactName={contactName} onClose={() => setLogOpen(false)} />
    </Layout>
  );
}

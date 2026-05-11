import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  KanbanSquare,
  ChevronRight,
  MapPin,
  Home,
  Calendar,
  Clock,
  ArrowRight,
  MoreHorizontal,
  Check,
  CheckSquare,
  FileText,
  Users,
  Activity,
  MessageSquare,
  Plus,
  AlertCircle,
  Upload,
  Download,
  Pencil,
  Image as ImageIcon,
  File as FileIcon,
  User,
  Phone,
  Mail,
  DollarSign,
  Eye,
  Sparkles,
  TrendingUp,
  Bell,
  X,
  Send,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TabKey = 'tasks' | 'docs' | 'parties' | 'timeline' | 'notes';
type PillTone = 'primary' | 'warn' | 'ok' | 'plain' | 'muted';

const pillToneCls: Record<PillTone, string> = {
  primary: 'bg-primary/10 text-primary',
  warn: 'bg-[hsl(35_100%_94%)] text-[hsl(35_80%_45%)]',
  ok: 'bg-[hsl(140_40%_92%)] text-reop-green',
  plain: 'bg-[hsl(210_20%_94%)] text-secondary',
  muted: 'bg-[hsl(210_15%_92%)] text-muted-foreground',
};

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

const STAGES = ['Lead', 'Active', 'Listed', 'Under Contract', 'Closing', 'Closed'] as const;
type Stage = (typeof STAGES)[number];

const stageDates: Partial<Record<Stage, string>> = {
  Lead: 'Dec 18',
  Active: 'Jan 2',
  Listed: 'Jan 5',
  'Under Contract': 'Jan 14',
};

type TaskRow = { label: string; due: string; assign: string; done?: boolean; overdue?: boolean; warn?: boolean };
const taskGroups: { head: string; overdueCount?: number; rows: TaskRow[] }[] = [
  {
    head: 'Overdue',
    overdueCount: 2,
    rows: [
      { label: 'Upload signed purchase agreement', due: 'Jan 15 — overdue', assign: 'JK', overdue: true },
      { label: 'Order title commitment from Lone Star Title', due: 'Jan 15 — overdue', assign: 'JK', overdue: true },
    ],
  },
  {
    head: 'Upcoming',
    rows: [
      { label: 'Schedule home inspection', due: 'Jan 20', assign: 'JK', warn: true },
      { label: 'Confirm earnest money deposit received', due: 'Jan 22', assign: 'JK' },
      { label: 'Send seller net sheet update', due: 'Jan 24', assign: 'JK' },
    ],
  },
  {
    head: 'Completed',
    rows: [
      { label: 'Prepare listing presentation', due: 'Jan 2', assign: 'JK', done: true },
      { label: 'Schedule professional photography', due: 'Jan 4', assign: 'JK', done: true },
      { label: 'Enter listing to MLS', due: 'Jan 5', assign: 'JK', done: true },
      { label: 'Review and negotiate offer from buyers', due: 'Jan 14', assign: 'JK', done: true },
    ],
  },
];

type DocKind = 'pdf' | 'docx' | 'img';
type DocRow = { kind: DocKind; title: string; sub: string; status: { label: string; tone: PillTone }; action: 'download' | 'edit' | 'more' };
const docs: DocRow[] = [
  { kind: 'pdf', title: 'Purchase Agreement — executed', sub: 'Signed Jan 14, 2025 · 28 pages · PDF', status: { label: 'Executed', tone: 'ok' }, action: 'download' },
  { kind: 'pdf', title: "Seller's Disclosure Notice", sub: 'Uploaded Jan 5, 2025 · 6 pages · PDF', status: { label: 'Filed', tone: 'ok' }, action: 'download' },
  { kind: 'pdf', title: 'Listing Agreement', sub: 'Signed Dec 30, 2024 · 12 pages · PDF', status: { label: 'Signed', tone: 'ok' }, action: 'download' },
  { kind: 'pdf', title: 'Title Commitment', sub: 'Pending — ordered Jan 15', status: { label: 'Pending', tone: 'warn' }, action: 'more' },
  { kind: 'img', title: 'MLS Photos (22 images)', sub: 'Professional shoot · Jan 4, 2025 · ZIP', status: { label: 'Published', tone: 'ok' }, action: 'download' },
  { kind: 'docx', title: 'Seller Net Sheet', sub: 'Updated Jan 14, 2025 · XLSX', status: { label: 'Draft', tone: 'primary' }, action: 'edit' },
  { kind: 'pdf', title: 'HOA Docs Package', sub: 'Uploaded Jan 6, 2025 · 44 pages', status: { label: 'Filed', tone: 'ok' }, action: 'download' },
];

const docIconCls: Record<DocKind, { wrap: string; icon: LucideIcon }> = {
  pdf: { wrap: 'bg-[hsl(0_84%_95%)] text-[hsl(0_72%_45%)]', icon: FileText },
  docx: { wrap: 'bg-[hsl(210_80%_93%)] text-[hsl(210_80%_40%)]', icon: FileIcon },
  img: { wrap: 'bg-[hsl(140_40%_92%)] text-[hsl(140_55%_28%)]', icon: ImageIcon },
};

const docActionIcon: Record<DocRow['action'], LucideIcon> = {
  download: Download,
  edit: Pencil,
  more: MoreHorizontal,
};

type Party = { initials: string; avBg: string; name: string; role: string; tel?: string; email?: string; profileLink?: string };
const parties: Party[] = [
  { initials: 'RS', avBg: 'bg-reop-dark-blue text-white', name: 'Robert & Sandra Whitmore', role: 'Sellers · (512) 555-0172 · robert@whitmore.com', tel: '+15125550172', email: 'robert@whitmore.com', profileLink: '/contacts/whitmore' },
  { initials: 'MP', avBg: 'bg-[hsl(210_60%_85%)] text-[hsl(210_80%_35%)]', name: 'Marcus & Diana Patel', role: 'Buyers · Represented by Taylor Realty', tel: '+15125550288', email: 'mpatel@email.com' },
  { initials: 'KR', avBg: 'bg-[hsl(280_40%_88%)] text-[hsl(280_50%_35%)]', name: 'Kelly Ramirez', role: "Buyers' Agent · Taylor Realty · (512) 555-0341", tel: '+15125550341', email: 'k.ramirez@taylorrealty.com' },
  { initials: 'LS', avBg: 'bg-[hsl(0_60%_90%)] text-[hsl(0_72%_40%)]', name: 'Lone Star Title Co.', role: 'Title Company · Escrow Officer: Janet Flores · (512) 555-0099', tel: '+15125550099', email: 'jflores@lonestar.com' },
  { initials: 'FN', avBg: 'bg-[hsl(35_80%_88%)] text-[hsl(35_80%_35%)]', name: 'First National Mortgage', role: 'Lender · Loan Officer: Brian Chu · (512) 555-0187', tel: '+15125550187', email: 'b.chu@fnmortgage.com' },
  { initials: 'AH', avBg: 'bg-[hsl(140_40%_88%)] text-[hsl(140_55%_28%)]', name: 'Austin Home Inspections', role: 'Inspector · Carlos Vega · Scheduled Jan 20, 2025', tel: '+15125550214', email: 'carlos@austinhome.com' },
];

type TimelineKind = 'stage' | 'doc' | 'note' | 'task' | 'default';
const timelineDot: Record<TimelineKind, string> = {
  stage: 'bg-reop-dark-blue text-white',
  doc: 'bg-[hsl(0_84%_95%)] text-[hsl(0_72%_45%)]',
  note: 'bg-[hsl(45_93%_92%)] text-[hsl(35_80%_32%)]',
  task: 'bg-[hsl(140_40%_92%)] text-[hsl(140_55%_28%)]',
  default: 'bg-reop-teal-soft text-primary',
};

type TLEntry = { kind: TimelineKind; icon: LucideIcon; title: string; body: string; time: string };
const timeline: TLEntry[] = [
  { kind: 'stage', icon: ArrowRight, title: 'Stage moved → Under Contract', body: 'Purchase agreement executed. Sales price $724,900. Close date target Feb 28.', time: 'Jan 14, 2025' },
  { kind: 'default', icon: DollarSign, title: 'Offer received and accepted — $724,900', body: 'Multiple offer situation. Accepted highest and best. Buyers waived inspection contingency.', time: 'Jan 13, 2025' },
  { kind: 'default', icon: Eye, title: '3 showings in first 48 hours', body: 'Strong early traffic. Two parties requested disclosures.', time: 'Jan 7, 2025' },
  { kind: 'stage', icon: ArrowRight, title: 'Stage moved → Listed', body: 'Active on MLS. List price $724,900. Professional photos published.', time: 'Jan 5, 2025' },
  { kind: 'doc', icon: FileText, title: 'Listing Agreement signed', body: '6-month listing agreement. 3% commission. MLS entry authorized.', time: 'Dec 30, 2024' },
  { kind: 'stage', icon: ArrowRight, title: 'Stage moved → Active', body: 'Listing presentation delivered. Sellers agreed to $724,900. Prep work begun.', time: 'Jan 2, 2025' },
  { kind: 'stage', icon: ArrowRight, title: 'Opportunity created — Lead stage', body: 'Referral from Margaret Sullivan. Initial consultation scheduled.', time: 'Dec 18, 2024' },
];

type Note = { initials: string; author: string; ts: string; body: string };
const notes: Note[] = [
  { initials: 'JK', author: 'Jordan Kim', ts: 'Jan 14, 2025 · 4:12 pm', body: 'Multiple offer situation went better than expected. The Patels waived their inspection contingency which put them over the top. Buyers seem serious — pre-approved at $800K. Title ordered. Need to follow up with Janet at Lone Star tomorrow on timeline.' },
  { initials: 'JK', author: 'Jordan Kim', ts: 'Jan 5, 2025 · 10:30 am', body: 'Photos came out beautifully. The kitchen and backyard really show. Went live this morning — already 47 Zillow saves in the first 2 hours. Expect showing requests by end of day.' },
  { initials: 'JK', author: 'Jordan Kim', ts: 'Dec 30, 2024 · 2:00 pm', body: 'Listing agreement signed. Robert was a bit nervous about the $724,900 price — showed him the 3 comps and explained the February window. He\'s onboard. Sandra is excited. Target photos Jan 4.' },
];

const keyDates: { k: string; v: string; tone?: 'warn' | 'ok' | 'due' | 'default' }[] = [
  { k: 'Contract signed', v: 'Jan 14, 2025' },
  { k: 'Option period ends', v: 'Jan 21, 2025', tone: 'warn' },
  { k: 'Inspection', v: 'Jan 20, 2025' },
  { k: 'Earnest money due', v: 'Jan 22, 2025', tone: 'warn' },
  { k: 'Appraisal deadline', v: 'Feb 7, 2025' },
  { k: 'Loan approval', v: 'Feb 14, 2025' },
  { k: 'Target close', v: 'Feb 28, 2025', tone: 'ok' },
];

const keyDateToneCls: Record<NonNullable<(typeof keyDates)[number]['tone']>, string> = {
  warn: 'text-[hsl(35_80%_38%)]',
  ok: 'text-[hsl(142_55%_28%)]',
  due: 'text-[hsl(0_72%_45%)]',
  default: 'text-reop-dark-blue',
};

function MoveStageModal({
  open,
  current,
  onClose,
}: {
  open: boolean;
  current: Stage;
  onClose: () => void;
}) {
  const initialNext: Stage = STAGES[Math.min(STAGES.indexOf(current) + 1, STAGES.length - 1)];
  const [next, setNext] = useState<Stage>(initialNext);
  const [notesText, setNotesText] = useState('');

  if (!open) return null;

  const confirm = () => {
    onClose();
    toast.success(`Stage moved to ${next} — tasks updated.`, {
      icon: <CheckCircle2 className="w-4 h-4 text-reop-green" />,
    });
    setNotesText('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/35"
    >
      <div className="bg-white rounded-2xl w-[480px] max-w-full shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-reop-teal-soft text-primary flex items-center justify-center flex-shrink-0">
            <ArrowRight className="w-[18px] h-[18px]" />
          </div>
          <div className="flex-1">
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold text-primary">Pipeline</div>
            <div className="text-base font-semibold tracking-[-0.01em] text-reop-dark-blue">Move from: {current}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-[30px] h-[30px] rounded-md border border-border bg-white flex items-center justify-center text-muted-foreground hover:bg-muted"
          >
            <X className="w-[15px] h-[15px]" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {STAGES.map((s) => {
              const isCurrent = s === current;
              const isPast = STAGES.indexOf(s) < STAGES.indexOf(current);
              const isSelected = s === next && !isCurrent;
              const dotColor = isCurrent ? 'bg-primary' : isPast ? 'bg-[hsl(142_55%_40%)]' : 'bg-[hsl(210_20%_80%)]';
              return (
                <button
                  key={s}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => !isCurrent && setNext(s)}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-3 rounded-[10px] border-[1.5px] text-left transition-all',
                    isSelected
                      ? 'border-primary bg-[hsl(184_100%_98%)]'
                      : 'border-border bg-white',
                    isCurrent && 'opacity-45 cursor-default',
                    isPast && !isCurrent && !isSelected && 'opacity-60',
                  )}
                >
                  <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', dotColor)} />
                  <span className={cn('text-sm', isSelected ? 'font-semibold' : 'font-medium')}>{s}</span>
                  {isCurrent && (
                    <span className="ml-auto text-[11px] font-bold text-muted-foreground">CURRENT</span>
                  )}
                  {isSelected && !isCurrent && (
                    <span className="ml-auto text-[11px] font-bold text-primary">NEXT ↑</span>
                  )}
                </button>
              );
            })}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-reop-dark-blue">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Why is this moving? Any context for the file…"
              className="w-full min-h-[72px] border border-border rounded-lg px-3 py-2.5 text-sm resize-none leading-relaxed text-reop-dark-blue"
            />
          </label>

          <div className="px-3.5 py-3 bg-[hsl(45_80%_96%)] border border-[hsl(45_60%_80%)] rounded-[10px] text-[13px] text-reop-dark-blue flex gap-2.5 leading-[1.55]">
            <Bell className="w-[15px] h-[15px] text-[hsl(35_80%_38%)] flex-shrink-0 mt-px" />
            <span>
              Moving to <strong>{next}</strong> will generate a new task checklist and notify your transaction coordinator.
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-[hsl(210_20%_98%)] flex gap-2.5 justify-end">
          <button
            onClick={onClose}
            className="h-10 px-4 border border-border rounded-lg bg-white text-sm font-semibold text-reop-dark-blue hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className="h-10 px-4 bg-primary text-white border-0 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Confirm move
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OpportunityDetail() {
  const [tab, setTab] = useState<TabKey>('tasks');
  const [moveOpen, setMoveOpen] = useState(false);
  const [taskState, setTaskState] = useState(taskGroups);
  const [noteText, setNoteText] = useState('');

  const tabs: { key: TabKey; label: string; icon: LucideIcon; count?: number }[] = [
    { key: 'tasks', label: 'Tasks', icon: CheckSquare, count: 5 },
    { key: 'docs', label: 'Documents', icon: FileText, count: 7 },
    { key: 'parties', label: 'Parties', icon: Users, count: 6 },
    { key: 'timeline', label: 'Timeline', icon: Activity },
    { key: 'notes', label: 'Notes', icon: MessageSquare, count: 3 },
  ];

  const toggleTask = (gIdx: number, rIdx: number) => {
    setTaskState((arr) =>
      arr.map((g, gi) =>
        gi === gIdx ? { ...g, rows: g.rows.map((r, ri) => (ri === rIdx ? { ...r, done: !r.done } : r)) } : g,
      ),
    );
  };

  return (
    <Layout>
      <Helmet>
        <title>4820 Shoal Creek Blvd — REOP</title>
      </Helmet>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-4">
        <Link
          to="/spheresync-tasks?tab=pipeline"
          className="inline-flex items-center gap-1 hover:text-reop-dark-blue transition-colors"
        >
          <KanbanSquare className="w-[13px] h-[13px]" />
          Pipeline
        </Link>
        <ChevronRight className="w-[13px] h-[13px] opacity-50" />
        <span className="text-reop-dark-blue font-medium">4820 Shoal Creek Blvd</span>
      </nav>

      {/* Hero */}
      <div className="bg-card border border-border rounded-[14px] overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 px-8 pt-7 pb-[22px] items-start border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              <Pill tone="warn">Under Contract</Pill>
              <Pill tone="muted">Seller Rep</Pill>
              <Pill tone="muted">Residential</Pill>
            </div>
            <h1 className="text-[clamp(1.35rem,2vw+0.5rem,1.75rem)] font-medium tracking-[-0.03em] mb-1.5 leading-[1.15]">
              4820 Shoal Creek Blvd
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground mb-3">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-[13px] h-[13px]" />
                Austin, TX 78756
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Home className="w-[13px] h-[13px]" />
                4 bed · 3 bath · 2,840 sq ft
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-[13px] h-[13px]" />
                Listed Jan 5, 2025
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-[13px] h-[13px]" />
                12 days on market
              </span>
            </div>
            <Link
              to="/contacts/whitmore"
              className="inline-flex items-center gap-2 text-[13px] text-reop-dark-blue hover:text-primary transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-reop-dark-blue text-white flex items-center justify-center text-[11px] font-semibold">
                RS
              </div>
              <span>
                Robert &amp; Sandra Whitmore <span className="text-muted-foreground font-normal">(sellers)</span>
              </span>
            </Link>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-[clamp(1.6rem,2.5vw,2.25rem)] font-semibold tracking-[-0.03em] text-primary leading-none">
              $724,900
            </div>
            <div className="text-[13px] text-muted-foreground mt-1">
              Est. GCI <strong className="text-reop-dark-blue">$21,747</strong> @ 3%
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <Button onClick={() => setMoveOpen(true)} className="gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" />
                Move stage
              </Button>
              <Button variant="outline" className="w-9 p-0">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-8 py-[22px] bg-[hsl(210_20%_98%)]">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-0 relative">
            {STAGES.map((s, idx) => {
              const isDone = idx < 3;
              const isCurrent = s === 'Under Contract';
              return (
                <div key={s} className="relative flex flex-col gap-1.5 items-center">
                  {idx < STAGES.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        'hidden md:block absolute top-[13px] h-0.5 z-0',
                        idx < 3 ? 'bg-primary' : 'bg-[hsl(210_20%_88%)]',
                      )}
                      style={{ left: 'calc(50% + 14px)', right: 'calc(-50% + 14px)' }}
                    />
                  )}
                  <div
                    className={cn(
                      'relative z-[1] w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2',
                      isDone
                        ? 'bg-primary border-primary text-white'
                        : isCurrent
                        ? 'bg-white border-primary text-primary shadow-[0_0_0_4px_hsl(184_100%_34%/0.18)]'
                        : 'bg-white border-[hsl(210_20%_85%)] text-[hsl(210_20%_60%)]',
                    )}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                  </div>
                  <b className="text-[11.5px] font-semibold text-reop-dark-blue text-center">{s}</b>
                  <span className="text-[10.5px] text-muted-foreground text-center">{stageDates[s] ?? '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
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

          {/* TASKS */}
          {tab === 'tasks' && (
            <div className="flex flex-col gap-6">
              {taskState.map((g, gIdx) => (
                <div key={g.head}>
                  <div className="text-[11px] uppercase tracking-[0.06em] font-bold text-muted-foreground mb-2.5 flex justify-between items-center">
                    <span>
                      {g.head}
                      {g.overdueCount && <span className="text-[hsl(0_72%_45%)] ml-1">({g.overdueCount})</span>}
                    </span>
                    {gIdx === 0 && (
                      <Button variant="outline" size="sm" className="h-8 gap-1.5">
                        <Plus className="w-3 h-3" />
                        Add task
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {g.rows.map((r, rIdx) => (
                      <div
                        key={rIdx}
                        className={cn(
                          'grid grid-cols-[18px_1fr_auto_auto] gap-3 px-3.5 py-2.5 border border-border rounded-[9px] bg-card text-sm items-center transition-colors hover:border-[hsl(210_20%_80%)]',
                        )}
                      >
                        <button
                          onClick={() => toggleTask(gIdx, rIdx)}
                          aria-pressed={!!r.done}
                          aria-label={r.done ? 'Mark task incomplete' : 'Mark task complete'}
                          className={cn(
                            'relative w-4 h-4 rounded cursor-pointer transition-colors',
                            r.done
                              ? 'bg-reop-green border-[1.5px] border-reop-green'
                              : 'bg-card border-[1.5px] border-border hover:border-primary/40',
                          )}
                        >
                          {r.done && (
                            <span
                              className="absolute top-[2px] left-[3px] w-2 h-[5px] border-l-2 border-b-2 border-white"
                              style={{ transform: 'rotate(-45deg)' }}
                            />
                          )}
                        </button>
                        <span className={cn('font-medium text-reop-dark-blue', r.done && 'opacity-40 line-through')}>
                          {r.label}
                        </span>
                        <span
                          className={cn(
                            'text-[11.5px] whitespace-nowrap inline-flex items-center gap-1',
                            r.overdue ? 'text-[hsl(0_72%_45%)] font-semibold' : r.warn ? 'text-[hsl(35_80%_38%)] font-semibold' : 'text-muted-foreground',
                          )}
                        >
                          {r.overdue && <AlertCircle className="w-3 h-3" />}
                          {r.due}
                        </span>
                        <div className="w-[22px] h-[22px] rounded-full bg-reop-teal-soft text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                          {r.assign}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DOCS */}
          {tab === 'docs' && (
            <div>
              <div className="flex justify-end mb-4">
                <Button size="sm" className="gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Upload document
                </Button>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <PanelHead icon={FileText} title="Contract Documents" />
                <div className="px-5">
                  {docs.map((d, idx) => {
                    const ic = docIconCls[d.kind];
                    const Icon = ic.icon;
                    const ActionIcon = docActionIcon[d.action];
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'grid grid-cols-[36px_1fr_auto_auto] gap-3 py-3 items-center text-sm',
                          idx < docs.length - 1 && 'border-b border-border',
                        )}
                      >
                        <div className={cn('w-[34px] h-[34px] rounded-lg flex items-center justify-center flex-shrink-0', ic.wrap)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <b className="font-medium block mb-0.5 text-reop-dark-blue truncate">{d.title}</b>
                          <span className="text-xs text-muted-foreground">{d.sub}</span>
                        </div>
                        <Pill tone={d.status.tone}>{d.status.label}</Pill>
                        <button
                          aria-label={d.action}
                          className="w-7 h-7 rounded-md border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition-colors flex-shrink-0"
                        >
                          <ActionIcon className="w-[13px] h-[13px]" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PARTIES */}
          {tab === 'parties' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <PanelHead
                icon={Users}
                title="Transaction Parties"
                action={
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    <Plus className="w-3 h-3" />
                    Add party
                  </Button>
                }
              />
              <div className="px-5">
                {parties.map((p, idx) => (
                  <div
                    key={p.name}
                    className={cn(
                      'grid grid-cols-[40px_1fr_auto] gap-3.5 py-3.5 items-center',
                      idx < parties.length - 1 && 'border-b border-border',
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0', p.avBg)}>
                      {p.initials}
                    </div>
                    <div className="min-w-0">
                      <b className="text-sm font-semibold block mb-0.5 text-reop-dark-blue">{p.name}</b>
                      <span className="text-xs text-muted-foreground">{p.role}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {p.profileLink && (
                        <Link
                          to={p.profileLink}
                          aria-label="View profile"
                          className="w-[30px] h-[30px] rounded-md border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition-colors"
                        >
                          <User className="w-[13px] h-[13px]" />
                        </Link>
                      )}
                      {p.tel && (
                        <a
                          href={`tel:${p.tel}`}
                          aria-label="Call"
                          className="w-[30px] h-[30px] rounded-md border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition-colors"
                        >
                          <Phone className="w-[13px] h-[13px]" />
                        </a>
                      )}
                      {p.email && (
                        <a
                          href={`mailto:${p.email}`}
                          aria-label="Email"
                          className="w-[30px] h-[30px] rounded-md border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-reop-teal-soft hover:text-primary hover:border-primary transition-colors"
                        >
                          <Mail className="w-[13px] h-[13px]" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIMELINE */}
          {tab === 'timeline' && (
            <div className="bg-card border border-border rounded-xl">
              <div className="px-5">
                {timeline.map((t, idx) => {
                  const Icon = t.icon;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'grid grid-cols-[36px_1fr_auto] gap-3.5 py-3.5 items-start',
                        idx < timeline.length - 1 && 'border-b border-border',
                      )}
                    >
                      <div className={cn('w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0', timelineDot[t.kind])}>
                        <Icon className="w-[15px] h-[15px]" />
                      </div>
                      <div className="min-w-0">
                        <b className="block text-sm font-semibold mb-0.5 text-reop-dark-blue">{t.title}</b>
                        <p className="text-[13px] text-muted-foreground leading-[1.5] m-0">{t.body}</p>
                      </div>
                      <span className="text-[11.5px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {t.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NOTES */}
          {tab === 'notes' && (
            <div className="flex flex-col gap-5">
              <div className="bg-[hsl(210_20%_98%)] border border-border rounded-[10px] px-4 py-3.5">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note about this opportunity…"
                  className="w-full min-h-[80px] border-0 bg-transparent text-sm text-reop-dark-blue resize-none outline-none leading-relaxed"
                />
                <div className="flex justify-end pt-2.5 border-t border-border mt-2.5">
                  <Button size="sm" className="gap-1.5">
                    <Send className="w-3 h-3" />
                    Save note
                  </Button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5">
                  {notes.map((n, idx) => (
                    <div key={idx} className={cn('py-4', idx < notes.length - 1 && 'border-b border-border')}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-[13px] font-semibold text-reop-dark-blue">
                          <div className="w-7 h-7 rounded-full bg-reop-dark-blue text-white flex items-center justify-center text-[11px] font-semibold">
                            {n.initials}
                          </div>
                          {n.author}
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
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <PanelHead icon={Sparkles} title="Coach Signals" />
            <div className="px-5 py-4 flex flex-col gap-2.5">
              <div className="px-3.5 py-3 rounded-[10px] bg-[hsl(0_84%_97%)] border border-[hsl(0_50%_85%)] text-[13px] leading-[1.55] text-reop-dark-blue">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em] font-bold text-[hsl(0_72%_45%)] mb-1.5">
                  <AlertCircle className="w-3 h-3" />
                  Action required
                </div>
                2 overdue tasks are blocking contract momentum. Upload the purchase agreement and order title today.
              </div>
              <div className="px-3.5 py-3 rounded-[10px] bg-[hsl(142_71%_96%)] border border-[hsl(142_40%_82%)] text-[13px] leading-[1.55] text-reop-dark-blue">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em] font-bold text-[hsl(142_55%_28%)] mb-1.5">
                  <TrendingUp className="w-3 h-3" />
                  Strong position
                </div>
                Multiple-offer acceptance with waived inspection gives you strong contract terms. Likely to close on schedule.
              </div>
              <div className="px-3.5 py-3 rounded-[10px] bg-[hsl(184_100%_97%)] border border-[hsl(184_50%_85%)] text-[13px] leading-[1.55] text-reop-dark-blue">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em] font-bold text-primary mb-1.5">
                  <Calendar className="w-3 h-3" />
                  Close window
                </div>
                Target close date Feb 28 — 44 days out. Keep lender and title on a tight timeline to hit the date.
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <PanelHead icon={Calendar} title="Key Dates" />
            <div className="px-5">
              {keyDates.map((d, idx) => (
                <div
                  key={d.k}
                  className={cn(
                    'flex justify-between items-center py-2.5 text-sm',
                    idx < keyDates.length - 1 && 'border-b border-border',
                  )}
                >
                  <span className="text-muted-foreground text-[12.5px]">{d.k}</span>
                  <span className={cn('font-semibold', keyDateToneCls[d.tone ?? 'default'])}>{d.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <PanelHead icon={DollarSign} title="Summary" />
            <div className="px-5 py-4 flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">List price</span>
                <span className="font-semibold text-reop-dark-blue">$724,900</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sale price</span>
                <span className="font-semibold text-reop-dark-blue">$724,900</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commission rate</span>
                <span className="font-semibold text-reop-dark-blue">3%</span>
              </div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. GCI</span>
                <span className="font-bold text-primary text-base">$21,747</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium text-reop-dark-blue">Referral — M. Sullivan</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MoveStageModal open={moveOpen} current="Under Contract" onClose={() => setMoveOpen(false)} />
    </Layout>
  );
}

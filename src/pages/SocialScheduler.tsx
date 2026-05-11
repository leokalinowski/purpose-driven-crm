/**
 * SocialScheduler — agent-facing social media hub.
 *
 * Five tabs:
 *   Overview  — stat cards (total followers, posts this month, scheduled,
 *               drafts), upcoming queue, recent activity
 *   Compose   — SocialPostForm
 *   Calendar  — SocialCalendar (react-big-calendar)
 *   Connect   — ConnectSocialAccounts (read-only display of linked
 *               platforms; new connections happen through admin until WLI
 *               tier is enabled)
 *   Analytics — SocialAnalytics (charts of engagement over the window)
 *
 * Backend: all data flows through the Metricool API via the
 * metricool-proxy edge function. The hooks in `useSocialScheduler.ts` are
 * adapters — they keep the same Social* return shapes the components
 * already expect, so this page didn't have to change as we swapped Postiz
 * out for Metricool.
 */

import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Plus, Instagram, Facebook, Linkedin, Youtube, Twitter, BarChart3,
  CalendarDays, Send, Clock, AlertCircle, CheckCircle2, Sparkles,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  useSocialAccounts,
  useSocialPosts,
  useSocialAnalytics,
  type SocialPost,
} from '@/hooks/useSocialScheduler';
import { SocialPostForm } from '@/components/social/SocialPostForm';
import { ConnectSocialAccounts } from '@/components/social/ConnectSocialAccounts';
import { SocialCalendar } from '@/components/social/SocialCalendar';
import { SocialAnalytics } from '@/components/social/SocialAnalytics';

type Tab = 'overview' | 'compose' | 'calendar' | 'connect' | 'analytics';

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
  twitter: Twitter,
  tiktok: Twitter,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
  facebook: '#1877f2',
  linkedin: '#0a66c2',
  youtube: '#ff0000',
  twitter: '#0f172a',
  tiktok: '#0f172a',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  threads: 'Threads',
  bluesky: 'Bluesky',
  gmb: 'Google Business',
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  const hrs = Math.round(mins / 60);
  const days = Math.round(hrs / 24);
  const future = ms > 0;
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  if (hrs < 24) return future ? `in ${hrs}h` : `${hrs}h ago`;
  if (days < 14) return future ? `in ${days}d` : `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PostStatusBadge({ status }: { status: SocialPost['status'] }) {
  const map: Record<SocialPost['status'], { label: string; cls: string }> = {
    scheduled: { label: 'Scheduled', cls: 'bg-reop-teal-soft text-primary' },
    posted: { label: 'Posted', cls: 'bg-[hsl(140_50%_94%)] text-[hsl(140_50%_30%)]' },
    failed: { label: 'Failed', cls: 'bg-[hsl(0_70%_94%)] text-[hsl(0_70%_40%)]' },
    draft: { label: 'Draft', cls: 'bg-[hsl(210_20%_94%)] text-muted-foreground' },
  };
  const m = map[status];
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold', m.cls)}>{m.label}</span>;
}

export default function SocialScheduler() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  const { data: accounts = [], isLoading: accountsLoading } = useSocialAccounts(user?.id);
  const { data: posts = [], isLoading: postsLoading } = useSocialPosts(user?.id);
  const { data: analytics = [] } = useSocialAnalytics(user?.id);

  const { upcoming, recent, drafts, failed } = useMemo(() => {
    const now = new Date();
    const upcoming = posts
      .filter((p) => p.status === 'scheduled' && new Date(p.schedule_time) >= now)
      .slice(0, 6);
    const recent = posts
      .filter((p) => p.status === 'posted')
      .slice(-6)
      .reverse();
    const drafts = posts.filter((p) => p.status === 'draft');
    const failed = posts.filter((p) => p.status === 'failed');
    return { upcoming, recent, drafts, failed };
  }, [posts]);

  const platformStats = useMemo(() => {
    type S = { platform: string; followers: number; postsThisMonth: number; engagement: number };
    const map = new Map<string, S>();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    for (const a of accounts) {
      map.set(a.platform, { platform: a.platform, followers: 0, postsThisMonth: 0, engagement: 0 });
    }
    for (const p of posts) {
      if (p.status === 'posted' && new Date(p.schedule_time) >= monthStart) {
        const cur = map.get(p.platform) ?? { platform: p.platform, followers: 0, postsThisMonth: 0, engagement: 0 };
        cur.postsThisMonth++;
        map.set(p.platform, cur);
      }
    }
    for (const a of analytics) {
      const cur = map.get(a.platform);
      if (cur) {
        cur.followers = Math.max(cur.followers, a.followers ?? 0);
        cur.engagement = Math.max(cur.engagement, a.engagement_rate ?? 0);
      }
    }
    return Array.from(map.values());
  }, [accounts, posts, analytics]);

  const totalFollowers = platformStats.reduce((s, p) => s + p.followers, 0);
  const postsThisMonth = platformStats.reduce((s, p) => s + p.postsThisMonth, 0);

  const TABS: { key: Tab; label: string; Icon: typeof Send }[] = [
    { key: 'overview',  label: 'Overview',  Icon: BarChart3 },
    { key: 'compose',   label: 'Compose',   Icon: Send },
    { key: 'calendar',  label: 'Calendar',  Icon: CalendarDays },
    { key: 'connect',   label: 'Channels',  Icon: Plus },
    { key: 'analytics', label: 'Analytics', Icon: BarChart3 },
  ];

  return (
    <>
      <Helmet><title>Social Media — Real Estate on Purpose</title></Helmet>
      <Layout>
        {/* PAGE HEAD */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <span className="eye-label block mb-1.5">Social Media</span>
            <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-medium tracking-tighter leading-[1.15] mb-1.5">
              One queue, every channel.
            </h1>
            <p className="text-sm text-muted-foreground max-w-[640px] leading-[1.55]">
              Compose once, schedule everywhere — your Coach surfaces what's overdue and what's due to drop next.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setTab('connect')}
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect channel
            </button>
            <button
              onClick={() => setTab('compose')}
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition"
            >
              <Send className="w-3.5 h-3.5" />
              New post
            </button>
          </div>
        </div>

        {/* TAB STRIP */}
        <div className="flex flex-wrap gap-1 mb-6 border-b border-border">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 h-9 -mb-px border-b-2 text-sm font-medium transition',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* TAB BODY */}
        {tab === 'overview' && (
          <OverviewTab
            accounts={accounts}
            platformStats={platformStats}
            upcoming={upcoming}
            recent={recent}
            drafts={drafts.length}
            failed={failed.length}
            totalFollowers={totalFollowers}
            postsThisMonth={postsThisMonth}
            postsLoading={postsLoading}
            accountsLoading={accountsLoading}
            onCompose={() => setTab('compose')}
            onSeeCalendar={() => setTab('calendar')}
            onConnect={() => setTab('connect')}
          />
        )}

        {tab === 'compose' && (
          <SocialPostForm agentId={user?.id} onSuccess={() => setTab('calendar')} />
        )}

        {tab === 'calendar' && (
          <SocialCalendar agentId={user?.id} />
        )}

        {tab === 'connect' && (
          <ConnectSocialAccounts agentId={user?.id} connectedAccounts={accounts} />
        )}

        {tab === 'analytics' && (
          <SocialAnalytics agentId={user?.id} />
        )}
      </Layout>
    </>
  );
}

// ── Overview tab ────────────────────────────────────────────────────────

interface OverviewTabProps {
  accounts: Array<{ platform: string; account_name?: string }>;
  platformStats: Array<{ platform: string; followers: number; postsThisMonth: number; engagement: number }>;
  upcoming: SocialPost[];
  recent: SocialPost[];
  drafts: number;
  failed: number;
  totalFollowers: number;
  postsThisMonth: number;
  postsLoading: boolean;
  accountsLoading: boolean;
  onCompose: () => void;
  onSeeCalendar: () => void;
  onConnect: () => void;
}

function OverviewTab({
  accounts, platformStats, upcoming, recent, drafts, failed,
  totalFollowers, postsThisMonth, postsLoading, accountsLoading,
  onCompose, onSeeCalendar, onConnect,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total followers" value={fmt(totalFollowers)} />
        <StatCard label="Posts this month" value={fmt(postsThisMonth)} />
        <StatCard label="Scheduled" value={fmt(upcoming.length)} />
        <StatCard label="Drafts" value={fmt(drafts)} accent={drafts > 0 ? 'amber' : undefined} />
      </div>

      {/* Connected channels strip */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground">Channels</h2>
          {accounts.length > 0 && (
            <button onClick={onConnect} className="text-[12px] text-primary hover:underline">Manage</button>
          )}
        </div>
        {accountsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-md border border-border bg-card/40 animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-foreground font-semibold">No channels connected yet</p>
            <p className="text-[12.5px] text-muted-foreground mt-1 mb-3">
              Reach out to your admin to get your social accounts linked.
            </p>
            <button onClick={onConnect} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-semibold hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition">
              <Plus className="w-3.5 h-3.5" /> See channels
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {platformStats.map((p) => {
              const Icon = PLATFORM_ICONS[p.platform] ?? Sparkles;
              return (
                <div key={p.platform} className="rounded-md border border-border bg-card p-3 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 text-white"
                    style={{ background: PLATFORM_COLORS[p.platform] ?? '#0f172a' }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-foreground truncate">
                      {PLATFORM_LABELS[p.platform] ?? p.platform}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {fmt(p.followers)} followers · {p.postsThisMonth} this mo
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Two-column queue */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Upcoming"
          subtitle={upcoming.length === 0 ? 'Nothing in the queue.' : `Next ${upcoming.length}`}
          action={
            <button onClick={onSeeCalendar} className="text-[12px] text-primary hover:underline">
              Open calendar
            </button>
          }
        >
          {postsLoading ? <SkeletonRows /> : upcoming.length === 0 ? (
            <EmptyHint
              icon={<Clock className="w-6 h-6" />}
              text="Schedule your first post and it'll appear here."
              action={<button onClick={onCompose} className="text-[12px] text-primary hover:underline mt-1">Compose now</button>}
            />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((p) => <PostRow key={p.id} post={p} />)}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent activity"
          subtitle={recent.length === 0 ? 'Nothing posted in the last window.' : `Last ${recent.length} published`}
        >
          {postsLoading ? <SkeletonRows /> : recent.length === 0 ? (
            <EmptyHint icon={<CheckCircle2 className="w-6 h-6" />} text="Once posts go out, you'll see them here." />
          ) : (
            <ul className="space-y-2">
              {recent.map((p) => <PostRow key={p.id} post={p} />)}
            </ul>
          )}
        </Panel>
      </section>

      {/* Drafts / failed footer */}
      {(drafts > 0 || failed > 0) && (
        <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
          {drafts > 0 && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              {drafts} draft{drafts === 1 ? '' : 's'} waiting
            </span>
          )}
          {failed > 0 && (
            <span className="inline-flex items-center gap-1.5 text-rose-700">
              <AlertCircle className="w-3.5 h-3.5" />
              {failed} post{failed === 1 ? '' : 's'} failed — check the calendar
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: 'amber' | 'rose' }) {
  return (
    <div className={cn(
      'rounded-md border bg-card p-4',
      accent === 'amber' ? 'border-amber-200 bg-amber-50/40'
        : accent === 'rose' ? 'border-rose-200 bg-rose-50/30'
          : 'border-border',
    )}>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Panel({
  title, subtitle, action, children,
}: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {subtitle && <div className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function PostRow({ post }: { post: SocialPost }) {
  const Icon = PLATFORM_ICONS[post.platform] ?? Sparkles;
  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 text-white"
        style={{ background: PLATFORM_COLORS[post.platform] ?? '#0f172a' }}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[12.5px] font-semibold text-foreground">
            {PLATFORM_LABELS[post.platform] ?? post.platform}
          </span>
          <PostStatusBadge status={post.status} />
          <span className="text-[11px] text-muted-foreground">{formatRelative(post.schedule_time)}</span>
        </div>
        <p className="text-[12.5px] text-foreground/80 line-clamp-2 leading-snug whitespace-pre-wrap">
          {post.content || <span className="italic text-muted-foreground">(no caption)</span>}
        </p>
      </div>
    </li>
  );
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 rounded-md border border-border bg-card/40 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyHint({
  icon, text, action,
}: { icon: React.ReactNode; text: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-6 text-muted-foreground">
      <div className="flex justify-center mb-2 opacity-60">{icon}</div>
      <p className="text-[12.5px] leading-snug max-w-xs mx-auto">{text}</p>
      {action}
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

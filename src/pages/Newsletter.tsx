import { useMemo, useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Edit3, Plus, ArrowUp, ArrowDown, Sparkles, BarChart3, Send,
  Mail, FileText, Trash2, Eye, Repeat,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNewsletterAnalytics } from '@/hooks/useNewsletterAnalytics';
import { useNewsletterTemplates } from '@/hooks/useNewsletterTemplates';
import { NewsletterAnalyticsDashboard } from '@/components/newsletter/analytics/NewsletterAnalyticsDashboard';
import { NewsletterScheduleManager } from '@/components/newsletter/NewsletterScheduleManager';
import { AIGenerateDialog } from '@/components/newsletter/AIGenerateDialog';

type Tab = 'overview' | 'schedule' | 'templates' | 'analytics';

function formatPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusBadgeStyle: Record<string, string> = {
  sent: 'bg-reop-teal-soft text-primary',
  completed: 'bg-[hsl(140_50%_94%)] text-[hsl(140_50%_30%)]',
  sending: 'bg-[hsl(35_100%_94%)] text-[hsl(35_80%_40%)]',
  draft: 'bg-[hsl(210_20%_94%)] text-muted-foreground',
  failed: 'bg-[hsl(0_70%_94%)] text-[hsl(0_70%_40%)]',
};

const VALID_TABS: Tab[] = ['overview', 'schedule', 'templates', 'analytics'];

export default function Newsletter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Honor `?tab=schedule` so dashboard banners + Coach nudges can deep-link
  // straight to the recurring-cadence tab.
  const initialTab = (() => {
    const t = searchParams.get('tab');
    return t && (VALID_TABS as string[]).includes(t) ? (t as Tab) : 'overview';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  // Re-sync if the param changes after mount (e.g. nav between banners).
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (VALID_TABS as string[]).includes(t)) setTab(t as Tab);
  }, [searchParams]);

  const { metrics, campaigns, isLoading: analyticsLoading } = useNewsletterAnalytics('all', user?.id);
  const { templates, isLoading: templatesLoading, deleteTemplate } = useNewsletterTemplates();
  const [showAIDialog, setShowAIDialog] = useState(false);

  const recentCampaigns = useMemo(() => campaigns.slice(0, 6), [campaigns]);

  const summaryTiles: { lab: string; val: string; sub: string; deltaTone?: 'up' | 'down' }[] = [
    {
      lab: 'Avg open rate',
      val: formatPct(metrics.avgOpenRate),
      sub: 'Industry avg: 21.5%',
      deltaTone: metrics.avgOpenRate != null && metrics.avgOpenRate >= 21.5 ? 'up' : 'down',
    },
    {
      lab: 'Avg click rate',
      val: formatPct(metrics.avgClickRate),
      sub: 'Industry avg: 2.8%',
      deltaTone: metrics.avgClickRate != null && metrics.avgClickRate >= 2.8 ? 'up' : 'down',
    },
    {
      lab: 'Campaigns sent',
      val: String(metrics.totalCampaigns),
      sub: `${metrics.totalDelivered.toLocaleString()} delivered`,
    },
    {
      lab: 'Bounce rate',
      val: formatPct(metrics.bounceRate),
      sub: metrics.bounceRate != null && metrics.bounceRate < 2 ? 'Healthy list' : 'Watch list quality',
      deltaTone: metrics.bounceRate != null && metrics.bounceRate < 2 ? 'up' : 'down',
    },
  ];

  return (
    <>
      <Helmet><title>E-Newsletter — Real Estate on Purpose</title></Helmet>
      <Layout>
        {/* PAGE HEAD */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <span className="eye-label block mb-1.5">E-Newsletter</span>
            <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-medium tracking-tighter leading-[1.15] mb-1.5">
              Stay top of mind, every month.
            </h1>
            <p className="text-sm text-muted-foreground max-w-[640px] leading-[1.55]">
              One template, one schedule, your whole sphere — the Coach drafts, you approve.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {/* AI compose is the highest-leverage entry point — surface it
                in the page header so agents see it before the manual flows. */}
            <button
              onClick={() => setShowAIDialog(true)}
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg border border-primary/30 bg-reop-teal-soft text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Compose with AI
            </button>
            <button
              onClick={() => navigate('/newsletter-builder')}
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Open builder
            </button>
            <button
              onClick={() => navigate('/newsletter-builder')}
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New issue
            </button>
          </div>
        </div>

        {/* SEGMENTED TABS */}
        <div className="mb-5 inline-flex gap-0.5 rounded-[9px] bg-[hsl(210_20%_94%)] p-[3px] flex-wrap">
          {(['overview', 'schedule', 'templates', 'analytics'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[7px] text-sm transition-all capitalize',
                tab === t
                  ? 'bg-card text-reop-dark-blue font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-muted-foreground hover:text-reop-dark-blue font-medium',
              )}
            >
              {t === 'overview' && <Mail className="w-3.5 h-3.5" />}
              {t === 'schedule' && <Repeat className="w-3.5 h-3.5" />}
              {t === 'templates' && <FileText className="w-3.5 h-3.5" />}
              {t === 'analytics' && <BarChart3 className="w-3.5 h-3.5" />}
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            {/* METRICS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-3.5 mb-6">
              {summaryTiles.map((m) => (
                <div key={m.lab} className="bg-card border border-border rounded-[12px] py-4 px-5">
                  <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground font-semibold">{m.lab}</div>
                  <div className="flex items-baseline gap-2.5 my-2">
                    <span className="text-[26px] sm:text-[32px] font-medium tracking-[-0.02em] leading-none">{m.val}</span>
                    {m.deltaTone === 'up' && (
                      <span className="text-[12.5px] text-reop-green inline-flex items-center gap-0.5 font-semibold">
                        <ArrowUp className="w-3 h-3" />good
                      </span>
                    )}
                    {m.deltaTone === 'down' && (
                      <span className="text-[12.5px] text-[hsl(35_80%_38%)] inline-flex items-center gap-0.5 font-semibold">
                        <ArrowDown className="w-3 h-3" />watch
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-dashed border-border">{m.sub}</div>
                </div>
              ))}
            </div>

            {/* RECENT SENDS + COACH SIDEBAR */}
            <div className="grid xl:grid-cols-[1fr_340px] gap-5 items-start">
              <div className="bg-card border border-border rounded-[12px] overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex justify-between items-center">
                  <h3 className="m-0 text-base font-semibold inline-flex items-center gap-2">
                    <Send className="w-4 h-4 text-primary" />
                    Recent sends
                  </h3>
                  {campaigns.length > 6 && (
                    <button
                      onClick={() => setTab('analytics')}
                      className="text-[12.5px] text-primary font-semibold hover:underline"
                    >
                      View all {campaigns.length} →
                    </button>
                  )}
                </div>

                {analyticsLoading ? (
                  <div className="px-5 py-6 text-sm text-muted-foreground">Loading sends…</div>
                ) : recentCampaigns.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <Mail className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">No newsletter sends yet.</p>
                    <button
                      onClick={() => navigate('/newsletter-builder')}
                      className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-reop-teal-hover transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Compose first issue
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentCampaigns.map((c) => {
                      const status = c.status?.toLowerCase() ?? 'draft';
                      return (
                        <div
                          key={c.id}
                          className="px-5 py-3.5 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_90px_90px_auto] gap-3 items-center text-sm"
                        >
                          <div className="min-w-0">
                            <b className="block font-semibold mb-0.5 truncate">{c.campaign_name || 'Untitled'}</b>
                            <span className="text-[11.5px] text-muted-foreground">
                              {formatDateShort(c.send_date)} · {c.recipient_count?.toLocaleString() ?? 0} recipients
                            </span>
                          </div>
                          <div className="hidden sm:block text-right">
                            <span className="font-semibold text-[14px]">{formatPct(c.open_rate)}</span>
                            <div className="text-[10.5px] text-muted-foreground uppercase tracking-[0.04em]">opens</div>
                          </div>
                          <div className="hidden sm:block text-right">
                            <span className="font-semibold text-[14px]">{formatPct(c.click_through_rate)}</span>
                            <div className="text-[10.5px] text-muted-foreground uppercase tracking-[0.04em]">clicks</div>
                          </div>
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize',
                              statusBadgeStyle[status] ?? statusBadgeStyle.draft,
                            )}
                          >
                            {status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <aside className="flex flex-col gap-4">
                <div className="bg-reop-teal-soft border border-[hsl(184_50%_85%)] rounded-[12px] p-[18px]">
                  <div className="flex gap-2.5 items-start mb-3">
                    <div className="w-[30px] h-[30px] rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <b className="block text-sm font-semibold mb-0.5">Coach nudge</b>
                      <span className="text-[11.5px] text-muted-foreground leading-[1.4]">
                        Monthly cadence keeps sphere relationships warm
                      </span>
                    </div>
                  </div>
                  <p className="text-[12.5px] text-reop-dark-blue leading-[1.5] mb-3">
                    {metrics.totalCampaigns === 0
                      ? "You haven't sent a newsletter yet. Open the builder to start your first issue."
                      : metrics.avgOpenRate != null && metrics.avgOpenRate < 20
                        ? `Open rate of ${formatPct(metrics.avgOpenRate)} is below industry avg. Subject lines that name your reader's neighborhood typically lift opens.`
                        : `Open rate of ${formatPct(metrics.avgOpenRate)} is healthy. Keep it monthly — Thursday at 10 AM is the sweet spot for most agents.`}
                  </p>
                  <button
                    onClick={() => navigate('/newsletter-builder')}
                    className="w-full inline-flex items-center justify-center gap-1.5 h-[34px] rounded-lg bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-reop-teal-hover transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Open the builder
                  </button>
                </div>

                <div className="bg-card border border-border rounded-[12px] p-[18px]">
                  <h4 className="m-0 mb-3 text-[12px] uppercase tracking-[0.05em] text-muted-foreground font-bold">
                    What gets sent
                  </h4>
                  <ul className="m-0 p-0 list-none text-[13px] flex flex-col gap-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Monthly cadence — drafts auto-save in the builder</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Recipients pulled from your sphere (DNC respected)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Unsubscribes tracked + honored automatically</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Open + click rates land in the Analytics tab</span>
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
          </>
        )}

        {tab === 'templates' && (
          <div className="bg-card border border-border rounded-[12px] overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center">
              <h3 className="m-0 text-base font-semibold inline-flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Saved templates
                <span className="ml-1 text-[12.5px] text-muted-foreground font-normal">{templates.length}</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAIDialog(true)}
                  className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg border border-primary/30 bg-reop-teal-soft text-[12.5px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Generate
                </button>
                <button
                  onClick={() => navigate('/newsletter-builder')}
                  className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-reop-teal-hover transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New template
                </button>
              </div>
            </div>
            {templatesLoading ? (
              <div className="px-5 py-6 text-sm text-muted-foreground">Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  No templates yet. Save your first issue from the builder to reuse it next month.
                </p>
                <button
                  onClick={() => navigate('/newsletter-builder')}
                  className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-reop-teal-hover transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Open builder
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {templates.map((t) => (
                  <div key={t.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div
                      className="w-12 h-14 rounded-md flex-shrink-0 bg-[hsl(210_30%_96%)] flex items-center justify-center"
                      style={{
                        background: t.thumbnail_url
                          ? `url(${t.thumbnail_url}) center/cover`
                          : 'linear-gradient(135deg,hsl(184 70% 40%),hsl(210 47% 22%))',
                      }}
                    >
                      {!t.thumbnail_url && <FileText className="w-4 h-4 text-white/80" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <b className="block font-semibold truncate">{t.name}</b>
                      <span className="text-[11.5px] text-muted-foreground">
                        {t.blocks_json?.length ?? 0} blocks · updated {formatDateShort(t.updated_at)}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/newsletter-builder/${t.id}`)}
                      className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-md border border-border bg-card text-xs font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition"
                    >
                      <Eye className="w-3 h-3" />
                      Open
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete template "${t.name}"?`)) {
                          deleteTemplate(t.id);
                        }
                      }}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-card text-muted-foreground hover:bg-[hsl(0_70%_96%)] hover:text-[hsl(0_70%_40%)] transition"
                      aria-label="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'schedule' && <NewsletterScheduleManager />}

        {tab === 'analytics' && <NewsletterAnalyticsDashboard />}

        {/* AI Generate dialog — single instance shared by all entry points
            (header CTA, Templates tab toolbar, future Overview CTAs). */}
        <AIGenerateDialog open={showAIDialog} onClose={() => setShowAIDialog(false)} />
      </Layout>
    </>
  );
}

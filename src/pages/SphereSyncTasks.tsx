import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Sparkles, Calendar, KanbanSquare, History, Phone } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { usePipeline, Opportunity } from '@/hooks/usePipeline';
import { OpportunityDetailV2 } from '@/components/pipeline/OpportunityDetailV2';
import { PrioritiesTab } from '@/components/spheresync/tabs/PrioritiesTab';
import { SphereCadenceTab } from '@/components/spheresync/tabs/SphereCadenceTab';
import { PipelineTab } from '@/components/spheresync/tabs/PipelineTab';
import { cn } from '@/lib/utils';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

type Tab = 'priorities' | 'cadence' | 'pipeline';
const VALID_TABS: Tab[] = ['priorities', 'cadence', 'pipeline'];

export default function SphereSyncTasks() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailOpp, setDetailOpp] = useState<Opportunity | null>(null);

  // Pipeline data lifted to page level so the drawer can refresh from any tab
  const { opportunities, loading: pipelineLoading, updateStage, refresh: refreshPipeline } = usePipeline();

  const weekNum = getCurrentWeekNumber();

  const activeTab: Tab = useMemo(() => {
    const t = searchParams.get('tab');
    return (VALID_TABS as string[]).includes(t ?? '') ? (t as Tab) : 'priorities';
  }, [searchParams]);

  const setActiveTab = (tab: Tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'priorities') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'priorities', label: 'Priorities', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { key: 'cadence',    label: 'Cadence',    icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'pipeline',   label: 'Pipeline',   icon: <KanbanSquare className="h-3.5 w-3.5" /> },
  ];

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
          Please sign in to access SphereSync.
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Helmet><title>SphereSync — Real Estate on Purpose</title></Helmet>
      <Layout>
        <DndProvider backend={HTML5Backend}>
          <div>
            {/* ── Page header ─────────────────────────────────────────────── */}
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.09em] text-primary">
                  SphereSync™
                </span>
                <h1 className="mb-1.5 text-3xl font-medium tracking-tight leading-tight text-foreground">
                  Your operational hub.
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                  What to do now, who to call this week, and where every deal stands — in that order.
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors">
                  <Calendar className="h-3.5 w-3.5" />
                  Week {weekNum}
                </button>
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-white hover:bg-reop-teal-hover transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                  Start calling
                </button>
              </div>
            </div>

            {/* ── Segmented tab control ────────────────────────────────────── */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div
                className="inline-flex rounded-[9px] bg-muted/80 p-0.5 gap-0.5"
                role="tablist"
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-[7px] px-3.5 py-2 text-sm font-medium transition-all',
                      activeTab === tab.key
                        ? 'bg-card text-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.key === 'priorities' && (
                      <span className="ml-0.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {/* count populated by Coach today_list — shows 0 until Coach runs */}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab content ──────────────────────────────────────────────── */}
            {activeTab === 'priorities' && (
              <PrioritiesTab onOpenOpportunity={setDetailOpp} />
            )}
            {activeTab === 'cadence' && (
              <SphereCadenceTab />
            )}
            {activeTab === 'pipeline' && (
              <PipelineTab
                opportunities={opportunities}
                loading={pipelineLoading}
                updateStage={updateStage}
                refresh={refreshPipeline}
                onOpenOpportunity={setDetailOpp}
              />
            )}
          </div>

          {/* Shared opportunity drawer */}
          <OpportunityDetailV2
            opportunity={detailOpp}
            open={!!detailOpp}
            onClose={() => setDetailOpp(null)}
            onRefresh={refreshPipeline}
          />
        </DndProvider>
      </Layout>
    </>
  );
}

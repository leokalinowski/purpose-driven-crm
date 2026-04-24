import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Sparkles, Calendar, KanbanSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { usePipeline, Opportunity } from '@/hooks/usePipeline';
import { OpportunityDetailV2 } from '@/components/pipeline/OpportunityDetailV2';
import { PrioritiesTab } from '@/components/spheresync/tabs/PrioritiesTab';
import { SphereCadenceTab } from '@/components/spheresync/tabs/SphereCadenceTab';
import { PipelineTab } from '@/components/spheresync/tabs/PipelineTab';
import { cn } from '@/lib/utils';

type Tab = 'priorities' | 'cadence' | 'pipeline';

const VALID_TABS: Tab[] = ['priorities', 'cadence', 'pipeline'];

export default function SphereSyncTasks() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailOpp, setDetailOpp] = useState<Opportunity | null>(null);

  // Pipeline data lifted to page level so the drawer can refresh it
  // even when opened from the Priorities tab.
  const { opportunities, loading: pipelineLoading, updateStage, refresh: refreshPipeline } = usePipeline();

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
    { key: 'priorities', label: 'Priorities',     icon: <Sparkles className="h-3.5 w-3.5" /> },
    { key: 'cadence',    label: 'Sphere Cadence', icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'pipeline',   label: 'Pipeline',       icon: <KanbanSquare className="h-3.5 w-3.5" /> },
  ];

  if (!user) {
    return (
      <Layout>
        <Card>
          <CardContent className="p-6">
            <p>Please sign in to access SphereSync.</p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <>
      <Helmet><title>SphereSync — Real Estate on Purpose</title></Helmet>
      <Layout>
        <DndProvider backend={HTML5Backend}>
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">SphereSync</h1>
              <p className="text-muted-foreground text-sm sm:text-base mt-1">
                Your operational hub — what to do now, who to call this week, and where every deal stands.
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5 w-fit">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 md:px-3 py-2.5 md:py-1.5 min-h-[44px] md:min-h-0 rounded-md text-sm font-medium transition-all',
                    activeTab === tab.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={activeTab === tab.key}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
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

          {/* Shared opportunity drawer — works from any tab */}
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

import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { TodayView } from "@/components/pipeline/TodayView";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { AddOpportunityDialog } from "@/components/pipeline/AddOpportunityDialog";
import { Button } from "@/components/ui/button";
import { usePipeline } from "@/hooks/usePipeline";
import { usePipelineFilters } from "@/hooks/usePipelineFilters";
import { useUserRole } from "@/hooks/useUserRole";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Lock, LayoutList, KanbanSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = 'today' | 'board';

export default function Pipeline() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const {
    opportunities,
    loading,
    updateStage,
    refresh,
  } = usePipeline();

  const {
    filtered,
    boardStages,
    pipelineType,
    setPipelineType,
    showLost,
    setShowLost,
  } = usePipelineFilters(opportunities);

  if (!roleLoading && !isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-sm mx-auto p-8 rounded-xl border border-border bg-card shadow-sm">
            <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground text-sm">
              Pipeline is currently available to administrators only.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'today', label: 'Today', icon: <LayoutList className="h-4 w-4" /> },
    { key: 'board', label: 'Board', icon: <KanbanSquare className="h-4 w-4" /> },
  ];

  const pipelineTypeOptions = [
    { value: 'all', label: 'All' },
    { value: 'buyer', label: 'Buyers' },
    { value: 'seller', label: 'Sellers' },
    { value: 'referral', label: 'Referrals' },
  ];

  return (
    <>
      <Helmet>
        <title>Pipeline — Real Estate on Purpose</title>
      </Helmet>
      <Layout>
        <DndProvider backend={HTML5Backend}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
              <AddOpportunityDialog onOpportunityCreated={refresh} />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                    activeTab === tab.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Board filter bar (only on Board tab) */}
            {activeTab === 'board' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                  {pipelineTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPipelineType(opt.value as any)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                        pipelineType === opt.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLost}
                    onChange={e => setShowLost(e.target.checked)}
                    className="rounded"
                  />
                  Show Lost
                </label>
              </div>
            )}

            {/* Tab content */}
            {activeTab === 'today' ? (
              <TodayView />
            ) : (
              <PipelineBoard
                opportunities={filtered}
                onStageUpdate={updateStage}
                onEditOpportunity={() => {}}
                loading={loading}
                boardStages={boardStages}
              />
            )}
          </div>
        </DndProvider>
      </Layout>
    </>
  );
}

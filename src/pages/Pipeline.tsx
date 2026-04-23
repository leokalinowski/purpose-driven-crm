import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineMetrics } from "@/components/pipeline/PipelineMetrics";
import { AddOpportunityDialog } from "@/components/pipeline/AddOpportunityDialog";
import { OpportunityDetailDrawer } from "@/components/pipeline/OpportunityDetailDrawer";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePipeline, Opportunity } from "@/hooks/usePipeline";
import { usePipelineFilters } from "@/hooks/usePipelineFilters";
import { useUserRole } from "@/hooks/useUserRole";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { RefreshCcw, Brain, Lock } from "lucide-react";

export default function Pipeline() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const {
    opportunities,
    metrics,
    loading,
    updateStage,
    updateOpportunity,
    refreshAIScores,
    refresh,
  } = usePipeline();

  const {
    filtered,
    boardStages,
    aiStats,
    pipelineType,
    setPipelineType,
    showLost,
    setShowLost,
    sortBy,
    setSortBy,
  } = usePipelineFilters(opportunities);

  const [detailOpportunity, setDetailOpportunity] = useState<Opportunity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleCardClick = (opp: Opportunity) => {
    setDetailOpportunity(opp);
    setDetailOpen(true);
  };

  // Admin gate
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

  const pipelineTypeOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'buyer', label: 'Buyers' },
    { value: 'seller', label: 'Sellers' },
    { value: 'referral', label: 'Referrals' },
  ];

  const sortOptions: { value: string; label: string }[] = [
    { value: 'created_at', label: 'Newest' },
    { value: 'deal_value', label: 'Deal Value' },
    { value: 'close_date', label: 'Close Date' },
    { value: 'ai_probability', label: 'AI Score' },
    { value: 'days_stale', label: 'Days Stale' },
  ];

  return (
    <>
      <Helmet>
        <title>Pipeline - Real Estate on Purpose</title>
        <meta
          name="description"
          content="AI-First deal management — track and close deals faster with AI-driven insights."
        />
      </Helmet>

      <Layout>
        <DndProvider backend={HTML5Backend}>
          <div className="space-y-5">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  AI-First deal management
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshAIScores()}
                  title="Refresh AI scores"
                >
                  <Brain className="h-4 w-4 mr-1.5" />
                  AI Score
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={refresh}
                  title="Refresh pipeline"
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                <AddOpportunityDialog onOpportunityCreated={refresh} />
              </div>
            </div>

            {/* Filter / sort bar */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Pipeline type tabs */}
              <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                {pipelineTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPipelineType(opt.value as any)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      pipelineType === opt.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Show Lost toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="show-lost"
                  checked={showLost}
                  onCheckedChange={setShowLost}
                  className="scale-90"
                />
                <Label htmlFor="show-lost" className="text-sm text-muted-foreground cursor-pointer">
                  Show Lost
                </Label>
              </div>
            </div>

            {/* AI Stats bar */}
            {(aiStats.scored > 0 || aiStats.stale > 0) && (
              <div className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-lg bg-muted/50 border border-border/60 text-xs">
                {aiStats.scored > 0 && (
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{aiStats.scored}</span> scored
                  </span>
                )}
                {aiStats.avgProbability != null && (
                  <span className="text-muted-foreground">
                    Avg probability:{' '}
                    <span
                      className={`font-semibold ${
                        aiStats.avgProbability >= 70
                          ? 'text-green-600'
                          : aiStats.avgProbability >= 40
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {aiStats.avgProbability}%
                    </span>
                  </span>
                )}
                {aiStats.stale > 0 && (
                  <span className="text-amber-700 font-medium">
                    {aiStats.stale} stale deal{aiStats.stale > 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-muted-foreground ml-auto">
                  {aiStats.total} deal{aiStats.total !== 1 ? 's' : ''} shown
                </span>
              </div>
            )}

            {/* Metrics */}
            <PipelineMetrics metrics={metrics} loading={loading} />

            {/* Board */}
            <PipelineBoard
              opportunities={filtered}
              onStageUpdate={updateStage}
              onEditOpportunity={handleCardClick}
              loading={loading}
              boardStages={boardStages}
            />

            {/* Detail drawer */}
            <OpportunityDetailDrawer
              opportunity={detailOpportunity}
              open={detailOpen}
              onOpenChange={setDetailOpen}
              onStageUpdate={updateStage}
              onUpdate={updateOpportunity}
              onRefresh={refresh}
            />
          </div>
        </DndProvider>
      </Layout>
    </>
  );
}

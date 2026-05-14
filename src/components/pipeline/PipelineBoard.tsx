import { useMemo } from 'react';
import { Opportunity } from '@/hooks/usePipeline';
import { getBoardStages, type StageKey } from '@/config/pipelineStages';
import { PipelineColumn } from './PipelineColumn';

interface PipelineBoardProps {
  opportunities: Opportunity[];
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  onEditOpportunity: (opportunity: Opportunity) => void;
  loading: boolean;
}

export function PipelineBoard({
  opportunities,
  onStageUpdate,
  onEditOpportunity,
  loading,
}: PipelineBoardProps) {
  const boardStages = getBoardStages();

  // Group opportunities by stage. Opportunities with stage = null (sphere-
  // only) AND stage = 'lost' (off-board) are filtered out — the board only
  // shows the 7 active stages.
  const byStage = useMemo(() => {
    const map = Object.fromEntries(
      boardStages.map((s) => [s.key, [] as Opportunity[]]),
    ) as Record<StageKey, Opportunity[]>;
    for (const o of opportunities) {
      if (o.stage && map[o.stage as StageKey]) map[o.stage as StageKey].push(o);
    }
    return map;
  }, [opportunities, boardStages]);

  const handleStageDrop = async (opportunityId: string, newStage: string) => {
    const opp = opportunities.find((o) => o.id === opportunityId);
    if (!opp || opp.stage === newStage) return;
    await onStageUpdate(opportunityId, newStage);
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {boardStages.map((stage) => (
          <div key={stage.key} className="w-[200px] flex-shrink-0 space-y-3">
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // 7 columns, ~200px each ≈ 1400px total + gaps. Wraps to horizontal scroll
  // below ~1100px (the design's intent per Q5). Mobile collapses naturally
  // because each column is fixed-width with flex-shrink-0.
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none">
      {boardStages.map((stage) => (
        <div key={stage.key} className="snap-start">
          <PipelineColumn
            stage={stage}
            opportunities={byStage[stage.key as StageKey]}
            onStageMove={handleStageDrop}
            onStageUpdate={onStageUpdate}
            onEditOpportunity={onEditOpportunity}
          />
        </div>
      ))}
    </div>
  );
}

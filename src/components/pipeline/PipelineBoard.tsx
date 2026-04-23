import { Opportunity } from "@/hooks/usePipeline";
import { PipelineStage } from "@/config/pipelineStages";
import { PipelineColumn } from "./PipelineColumn";

interface PipelineBoardProps {
  opportunities: Opportunity[];
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  onEditOpportunity: (opportunity: Opportunity) => void;
  loading: boolean;
  boardStages: PipelineStage[];
}

export function PipelineBoard({
  opportunities,
  onStageUpdate,
  onEditOpportunity,
  loading,
  boardStages,
}: PipelineBoardProps) {
  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {boardStages.map((stage) => (
          <div key={stage.key} className="min-w-[280px] flex-shrink-0 space-y-3">
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const opportunitiesByStage = opportunities.reduce((acc, opp) => {
    if (!acc[opp.stage]) acc[opp.stage] = [];
    acc[opp.stage].push(opp);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {boardStages.map((stage) => (
        <div key={stage.key} className="min-w-[280px] flex-shrink-0">
          <PipelineColumn
            stage={stage}
            opportunities={opportunitiesByStage[stage.key] ?? []}
            onStageUpdate={onStageUpdate}
            onEditOpportunity={onEditOpportunity}
          />
        </div>
      ))}
    </div>
  );
}

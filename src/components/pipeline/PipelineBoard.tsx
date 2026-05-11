import { useMemo } from 'react';
import { Opportunity } from "@/hooks/usePipeline";
import {
  MetaStage,
  META_STAGES,
  getMetaStageForKey,
  defaultSubStage,
  getEffectivePipelineType,
} from "@/config/pipelineStages";
import { PipelineColumn } from "./PipelineColumn";

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

  // Group opportunities by meta-stage. Init from META_STAGES so adding a
  // new meta (e.g. `closed_lost`) doesn't need a literal map update here.
  const byMeta = useMemo(() => {
    const map = Object.fromEntries(
      META_STAGES.map(m => [m.key, [] as Opportunity[]])
    ) as Record<MetaStage, Opportunity[]>;
    for (const o of opportunities) {
      const meta = getMetaStageForKey(o.stage);
      if (meta && map[meta]) map[meta].push(o);
    }
    return map;
  }, [opportunities]);

  // When dropped onto a meta-column, resolve the specific sub-stage based on pipeline_type
  // and skip the write if the card is already in that meta-column.
  const handleMetaDrop = async (opportunityId: string, meta: MetaStage) => {
    const opp = opportunities.find(o => o.id === opportunityId);
    if (!opp) return;
    const currentMeta = getMetaStageForKey(opp.stage);
    if (currentMeta === meta) return;

    const pipelineType = getEffectivePipelineType(opp);
    const newStage = defaultSubStage(meta, pipelineType);
    await onStageUpdate(opportunityId, newStage);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 snap-x snap-mandatory md:snap-none overflow-x-auto md:overflow-visible pb-4">
        {META_STAGES.map((stage) => (
          <div key={stage.key} className="min-w-[280px] md:min-w-0 space-y-3 snap-start">
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 snap-x snap-mandatory md:snap-none overflow-x-auto md:overflow-visible pb-4">
      {META_STAGES.map((stage) => (
        <div key={stage.key} className="min-w-[280px] md:min-w-0 snap-start">
          <PipelineColumn
            metaStage={stage}
            opportunities={byMeta[stage.key]}
            onMetaStageUpdate={handleMetaDrop}
            onStageUpdate={onStageUpdate}
            onEditOpportunity={onEditOpportunity}
          />
        </div>
      ))}
    </div>
  );
}

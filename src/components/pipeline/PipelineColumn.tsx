import { useDrop } from 'react-dnd';
import { Opportunity } from "@/hooks/usePipeline";
import { PipelineStage } from "@/config/pipelineStages";
import { OpportunityCard } from "./OpportunityCard";
import { Badge } from "@/components/ui/badge";

interface PipelineColumnProps {
  stage: PipelineStage;
  opportunities: Opportunity[];
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  onEditOpportunity: (opportunity: Opportunity) => void;
}

export function PipelineColumn({ stage, opportunities, onStageUpdate, onEditOpportunity }: PipelineColumnProps) {
  const [{ isOver }, drop] = useDrop({
    accept: 'opportunity',
    drop: (item: { id: string }) => {
      if (item.id) {
        onStageUpdate(item.id, stage.key);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const totalValue = opportunities.reduce((sum, opp) => sum + (opp.deal_value ?? 0), 0);

  const scoredOpps = opportunities.filter(o => o.ai_deal_probability != null);
  const avgProbability =
    scoredOpps.length > 0
      ? Math.round(
          scoredOpps.reduce((s, o) => s + (o.ai_deal_probability ?? 0), 0) / scoredOpps.length
        )
      : null;

  return (
    <div
      ref={drop}
      className={`
        min-h-[400px] rounded-xl border-2 transition-all duration-150 flex flex-col
        ${isOver
          ? 'border-primary/60 bg-primary/5 shadow-md'
          : `${stage.color} border-dashed`}
      `}
    >
      {/* Column header */}
      <div className="px-3 py-3 border-b border-border/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-foreground truncate">
              {stage.label}
            </span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 flex-shrink-0">
              {opportunities.length}
            </Badge>
          </div>
          {totalValue > 0 && (
            <span className="text-xs font-semibold text-primary flex-shrink-0">
              ${totalValue.toLocaleString()}
            </span>
          )}
        </div>
        {avgProbability != null && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ~{avgProbability}% avg probability
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="p-2 flex flex-col gap-2 flex-1">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            onEdit={onEditOpportunity}
          />
        ))}
        {opportunities.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground/60 italic">No deals</p>
          </div>
        )}
      </div>
    </div>
  );
}

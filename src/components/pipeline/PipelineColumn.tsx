import { useDrop } from 'react-dnd';
import { Opportunity } from "@/hooks/usePipeline";
import { PipelineStage } from "@/config/pipelineStages";
import { OpportunityCard } from "./OpportunityCard";
import { cn } from "@/lib/utils";

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
      if (item.id) onStageUpdate(item.id, stage.key);
    },
    collect: monitor => ({ isOver: monitor.isOver() }),
  });

  const totalValue = opportunities.reduce((s, o) => s + (o.deal_value ?? 0), 0);

  return (
    <div
      ref={drop}
      className={cn(
        'min-h-[480px] rounded-xl border flex flex-col transition-colors duration-100',
        isOver ? 'border-primary/50 bg-primary/[0.03]' : 'border-border bg-background'
      )}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Accent dot */}
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.accent }}
            />
            <span className="font-semibold text-sm text-foreground">{stage.label}</span>
            <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {opportunities.length}
            </span>
          </div>
          {totalValue > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              ${(totalValue / 1000).toFixed(0)}k
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="p-2 flex flex-col gap-2 flex-1">
        {opportunities.map(opp => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onEdit={onEditOpportunity}
          />
        ))}
        {opportunities.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground/50 select-none">No deals</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useDrop } from 'react-dnd';
import { Opportunity } from "@/hooks/usePipeline";
import { MetaStageDef, MetaStage } from "@/config/pipelineStages";
import { OpportunityCard } from "./OpportunityCard";
import { cn } from "@/lib/utils";

interface PipelineColumnProps {
  metaStage: MetaStageDef;
  opportunities: Opportunity[];
  onMetaStageUpdate: (opportunityId: string, newMeta: MetaStage) => Promise<void> | void;
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  onEditOpportunity: (opportunity: Opportunity) => void;
}

export function PipelineColumn({
  metaStage,
  opportunities,
  onMetaStageUpdate,
  onStageUpdate,
  onEditOpportunity,
}: PipelineColumnProps) {
  const [{ isOver }, drop] = useDrop({
    accept: 'opportunity',
    drop: (item: { id: string }) => {
      if (item.id) onMetaStageUpdate(item.id, metaStage.key);
    },
    collect: monitor => ({ isOver: monitor.isOver() }),
  });

  const totalValue = opportunities.reduce((s, o) => s + (o.deal_value ?? 0), 0);

  return (
    <div
      ref={drop}
      className={cn(
        'min-h-[480px] rounded-xl border border-border bg-card/50 flex flex-col transition-colors duration-100',
        'border-t-[3px]',
        isOver && 'ring-2 ring-primary/40 ring-offset-1',
      )}
      style={{ borderTopColor: metaStage.accent }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-foreground truncate">{metaStage.label}</span>
            <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
              {opportunities.length}
            </span>
          </div>
          {totalValue > 0 && (
            <span className="text-xs font-semibold shrink-0" style={{ color: metaStage.accent }}>
              {totalValue >= 1_000_000
                ? `$${(totalValue / 1_000_000).toFixed(1)}M`
                : `$${Math.round(totalValue / 1000)}K`}
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
            onStageChange={onStageUpdate}
          />
        ))}
        {opportunities.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground/60 select-none text-center px-4">
              Drop here — or use the menu on a card to move it to {metaStage.label.toLowerCase()}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

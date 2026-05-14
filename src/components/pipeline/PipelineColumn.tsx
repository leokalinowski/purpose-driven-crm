import { useDrop } from 'react-dnd';
import { Opportunity } from '@/hooks/usePipeline';
import { PipelineStage } from '@/config/pipelineStages';
import { OpportunityCard } from './OpportunityCard';
import { cn } from '@/lib/utils';

interface PipelineColumnProps {
  stage: PipelineStage;
  opportunities: Opportunity[];
  /** Move an opportunity to this column's stage. */
  onStageMove: (opportunityId: string, newStage: string) => Promise<void> | void;
  /** Fine-grained stage update (used by the per-card move menu). */
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  onEditOpportunity: (opportunity: Opportunity) => void;
}

export function PipelineColumn({
  stage,
  opportunities,
  onStageMove,
  onStageUpdate,
  onEditOpportunity,
}: PipelineColumnProps) {
  const [{ isOver }, drop] = useDrop({
    accept: 'opportunity',
    drop: (item: { id: string }) => {
      if (item.id) onStageMove(item.id, stage.key);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  const totalValue = opportunities.reduce((s, o) => s + (o.deal_value ?? 0), 0);

  return (
    <div
      ref={drop}
      className={cn(
        'min-h-[480px] rounded-xl border-2 flex flex-col transition-colors duration-100',
        // Narrower columns since we're packing 7 across — tight but readable
        'w-[200px] flex-shrink-0',
        stage.color,
        isOver && 'ring-2 ring-primary/40 ring-offset-1',
      )}
    >
      {/* Header — ALL-CAPS short label per Pam's mockup */}
      <div className="px-3 py-2.5 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.accent }}
            />
            <span className="font-bold text-[11px] uppercase tracking-[0.05em] text-foreground truncate">
              {stage.shortLabel}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground bg-background rounded-full px-1.5 py-0.5 shrink-0">
              {opportunities.length}
            </span>
          </div>
          {totalValue > 0 && (
            <span className="text-[11px] font-semibold text-foreground shrink-0">
              ${(totalValue / 1000).toFixed(0)}k
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="p-2 flex flex-col gap-2 flex-1">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onEdit={onEditOpportunity}
            onStageChange={onStageUpdate}
          />
        ))}
        {opportunities.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-[11px] text-muted-foreground/60 select-none text-center px-3">
              Drag a card here, or tap the <span className="font-semibold">⋯</span> menu on a card to move it to {stage.label.toLowerCase()}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

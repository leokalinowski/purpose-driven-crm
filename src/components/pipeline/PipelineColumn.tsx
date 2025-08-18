import { useDrop } from 'react-dnd';
import { Opportunity } from "@/hooks/usePipeline";
import { OpportunityCard } from "./OpportunityCard";
import { Badge } from "@/components/ui/badge";

interface PipelineColumnProps {
  stage: {
    key: string;
    label: string;
    color: string;
  };
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

  const totalValue = opportunities.reduce((sum, opp) => sum + (opp.deal_value || 0), 0);

  return (
    <div
      ref={drop}
      className={`
        min-h-[500px] min-w-[280px] max-w-[320px] p-3 rounded-lg border-2 border-dashed transition-all duration-200
        ${isOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border bg-muted/20'}
        hover:bg-muted/30 flex flex-col
      `}
    >
      {/* Column Header */}
      <div className="flex-shrink-0 mb-3 pb-3 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">{stage.label}</h3>
            <Badge variant="secondary" className="text-xs mt-1">
              {opportunities.length} {opportunities.length === 1 ? 'deal' : 'deals'}
            </Badge>
          </div>
          {totalValue > 0 && (
            <div className="text-right flex-shrink-0 ml-2">
              <div className="text-xs font-medium text-primary">
                ${totalValue.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Scrollable Cards Container */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            onEdit={onEditOpportunity}
          />
        ))}
        {opportunities.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Drop opportunities here
          </div>
        )}
      </div>
    </div>
  );
}
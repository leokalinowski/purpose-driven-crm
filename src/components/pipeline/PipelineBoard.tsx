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
        min-h-[200px] p-2 sm:p-4 rounded-lg border-2 border-dashed transition-colors
        ${isOver ? 'border-primary bg-primary/5' : stage.color}
        w-full sm:w-auto // Full width on mobile
      `}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 sm:mb-4 gap-2">
        <div>
          <h3 className="font-semibold text-sm">{stage.label}</h3>
          <Badge variant="secondary" className="text-xs mt-1">
            {opportunities.length} deals
          </Badge>
        </div>
        {totalValue > 0 && (
          <div className="text-right">
            <div className="text-sm font-medium">
              ${totalValue.toLocaleString()}
            </div>
          </div>
        )}
      </div>
     
      <div className="space-y-2 sm:space-y-3">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            onEdit={onEditOpportunity}
          />
        ))}
      </div>
    </div>
  );
}
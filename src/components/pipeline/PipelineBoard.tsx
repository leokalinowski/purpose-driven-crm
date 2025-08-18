
import { PipelineColumn } from "./PipelineColumn";
import { Opportunity } from "@/hooks/usePipeline";

interface PipelineBoardProps {
  opportunities: Opportunity[];
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  onEditOpportunity: (opportunity: Opportunity) => void;
  loading: boolean;
}

const stages = [
  { key: "lead", label: "Lead", color: "border-blue-200 bg-blue-50" },
  { key: "qualified", label: "Qualified", color: "border-yellow-200 bg-yellow-50" },
  { key: "proposal", label: "Proposal", color: "border-orange-200 bg-orange-50" },
  { key: "negotiation", label: "Negotiation", color: "border-purple-200 bg-purple-50" },
  { key: "closed", label: "Closed", color: "border-green-200 bg-green-50" },
];

export function PipelineBoard({ opportunities, onStageUpdate, onEditOpportunity, loading }: PipelineBoardProps) {
  if (loading) {
    return (
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.key} className="min-w-[280px] animate-pulse">
            <div className="h-48 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex space-x-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageOpportunities = opportunities.filter(
          (opp) => opp.stage === stage.key
        );
        
        return (
          <div key={stage.key} className="min-w-[280px] flex-shrink-0">
            <PipelineColumn
              stage={stage}
              opportunities={stageOpportunities}
              onStageUpdate={onStageUpdate}
              onEditOpportunity={onEditOpportunity}
            />
          </div>
        );
      })}
    </div>
  );
}

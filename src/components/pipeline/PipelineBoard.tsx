
import { PipelineColumn } from "./PipelineColumn";
import { Opportunity } from "@/hooks/usePipeline";

const PIPELINE_STAGES = [
  { key: 'lead', label: 'Lead', color: 'border-gray-300' },
  { key: 'qualified', label: 'Qualified', color: 'border-blue-300' },
  { key: 'appointment', label: 'Appointment', color: 'border-yellow-300' },
  { key: 'contract', label: 'Contract', color: 'border-orange-300' },
  { key: 'closed', label: 'Closed', color: 'border-green-300' }
];

interface PipelineBoardProps {
  opportunities: Opportunity[];
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  onEditOpportunity: (opportunity: Opportunity) => void;
  loading: boolean;
}

export function PipelineBoard({ opportunities, onStageUpdate, onEditOpportunity, loading }: PipelineBoardProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
      {PIPELINE_STAGES.map((stage) => {
        const stageOpportunities = opportunities.filter(opp => opp.stage === stage.key);
        
        return (
          <PipelineColumn
            key={stage.key}
            stage={stage}
            opportunities={stageOpportunities}
            onStageUpdate={onStageUpdate}
            onEditOpportunity={onEditOpportunity}
          />
        );
      })}
    </div>
  );
}

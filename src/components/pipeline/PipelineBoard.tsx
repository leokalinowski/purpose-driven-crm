import { Opportunity } from "@/hooks/usePipeline";
import { PipelineColumn } from "./PipelineColumn";

interface PipelineBoardProps {
  opportunities: Opportunity[];
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  loading: boolean;
}

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'bg-slate-100 border-slate-300' },
  { key: 'qualified', label: 'Qualified', color: 'bg-blue-100 border-blue-300' },
  { key: 'appointment', label: 'Appointment', color: 'bg-yellow-100 border-yellow-300' },
  { key: 'contract', label: 'Contract', color: 'bg-orange-100 border-orange-300' },
  { key: 'closed', label: 'Closed', color: 'bg-green-100 border-green-300' }
];

export function PipelineBoard({ opportunities, onStageUpdate, loading }: PipelineBoardProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAGES.map((stage) => (
          <div key={stage.key} className="space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const opportunitiesByStage = opportunities.reduce((acc, opportunity) => {
    const stage = opportunity.stage;
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(opportunity);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto">
      {STAGES.map((stage) => (
        <PipelineColumn
          key={stage.key}
          stage={stage}
          opportunities={opportunitiesByStage[stage.key] || []}
          onStageUpdate={onStageUpdate}
        />
      ))}
    </div>
  );
}
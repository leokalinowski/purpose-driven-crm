import { Opportunity } from "@/hooks/usePipeline";
import { PipelineColumn } from "./PipelineColumn";
import { Skeleton } from "@/components/ui/skeleton";

interface PipelineBoardProps {
  opportunities: Opportunity[];
  onStageUpdate: (opportunityId: string, newStage: string) => Promise<void>;
  onEditOpportunity: (opportunity: Opportunity) => void;
  loading: boolean;
}

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'border-muted bg-muted/10' },
  { key: 'qualified', label: 'Qualified', color: 'border-primary/30 bg-primary/5' },
  { key: 'appointment', label: 'Appointment', color: 'border-secondary/30 bg-secondary/5' },
  { key: 'contract', label: 'Contract', color: 'border-accent/30 bg-accent/5' },
  { key: 'closed', label: 'Closed', color: 'border-primary/30 bg-primary/5' }
];

export function PipelineBoard({ opportunities, onStageUpdate, onEditOpportunity, loading }: PipelineBoardProps) {
  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage.key} className="min-w-[280px] space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-40 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
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
    <div className="w-full max-w-7xl mx-auto">
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <PipelineColumn
            key={stage.key}
            stage={stage}
            opportunities={opportunitiesByStage[stage.key] || []}
            onStageUpdate={onStageUpdate}
            onEditOpportunity={onEditOpportunity}
          />
        ))}
      </div>
    </div>
  );
}
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { AddOpportunityDialog } from '@/components/pipeline/AddOpportunityDialog';
import { Opportunity } from '@/hooks/usePipeline';
import { usePipelineFilters } from '@/hooks/usePipelineFilters';
import { cn } from '@/lib/utils';

interface PipelineTabProps {
  opportunities: Opportunity[];
  loading: boolean;
  updateStage: (id: string, stage: string) => Promise<void> | void;
  refresh: () => void;
  onOpenOpportunity?: (opp: Opportunity) => void;
}

export function PipelineTab({
  opportunities, loading, updateStage, refresh, onOpenOpportunity,
}: PipelineTabProps) {
  const { filtered, pipelineType, setPipelineType, showLost, setShowLost } =
    usePipelineFilters(opportunities);

  const typeOptions = [
    { value: 'all',      label: 'All' },
    { value: 'buyer',    label: 'Buyers' },
    { value: 'seller',   label: 'Sellers' },
    { value: 'referral', label: 'Referrals' },
  ];

  return (
    <div className="space-y-4">
      {/* Action bar — Add Opportunity + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <AddOpportunityDialog onOpportunityCreated={refresh} />

        <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          {typeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPipelineType(opt.value as any)}
              className={cn(
                'px-4 md:px-3 py-2.5 md:py-1.5 min-h-[44px] md:min-h-0 rounded-md text-sm font-medium transition-all',
                pipelineType === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showLost}
            onChange={e => setShowLost(e.target.checked)}
            className="rounded border-border"
          />
          Show Lost
        </label>
      </div>

      <PipelineBoard
        opportunities={filtered}
        onStageUpdate={updateStage}
        onEditOpportunity={(opp) => onOpenOpportunity?.(opp)}
        loading={loading}
      />
    </div>
  );
}

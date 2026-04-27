import { useMemo } from 'react';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { AddOpportunityDialog } from '@/components/pipeline/AddOpportunityDialog';
import { Opportunity } from '@/hooks/usePipeline';
import { usePipelineFilters } from '@/hooks/usePipelineFilters';
import { META_STAGES, getMetaStageForKey } from '@/config/pipelineStages';
import { cn } from '@/lib/utils';

interface PipelineTabProps {
  opportunities: Opportunity[];
  loading: boolean;
  updateStage: (id: string, stage: string) => Promise<void> | void;
  refresh: () => void;
  onOpenOpportunity?: (opp: Opportunity) => void;
}

function fmtValue(v: number) {
  return v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `$${Math.round(v / 1_000)}K`
    : `$${v}`;
}

export function PipelineTab({
  opportunities, loading, updateStage, refresh, onOpenOpportunity,
}: PipelineTabProps) {
  const { filtered, pipelineType, setPipelineType, showLost, setShowLost } =
    usePipelineFilters(opportunities);

  // Stage summary tiles — computed from all (unfiltered) opportunities
  const stageSummary = useMemo(() => {
    return META_STAGES.map(meta => {
      const opps = opportunities.filter(o => getMetaStageForKey(o.stage) === meta.key);
      const totalValue = opps.reduce((s, o) => s + (o.deal_value ?? 0), 0);
      return { ...meta, count: opps.length, totalValue };
    });
  }, [opportunities]);

  const typeOptions = [
    { value: 'all',      label: 'All' },
    { value: 'buyer',    label: 'Buyers' },
    { value: 'seller',   label: 'Sellers' },
    { value: 'referral', label: 'Referrals' },
  ];

  return (
    <div className="space-y-5">
      {/* Stage summary tiles */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stageSummary.map(meta => (
            <div
              key={meta.key}
              className="rounded-xl border border-border bg-card px-4 py-3.5 overflow-hidden relative"
              style={{ borderTopWidth: 3, borderTopColor: meta.accent }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-1.5">
                {meta.label}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-foreground">{meta.count}</span>
                <span className="text-[12px] text-muted-foreground">deals</span>
              </div>
              {meta.totalValue > 0 && (
                <div className="mt-1 text-[12px] font-medium" style={{ color: meta.accent }}>
                  {fmtValue(meta.totalValue)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

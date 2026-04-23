import { useState, useMemo } from 'react';
import { Opportunity } from './usePipeline';
import { PipelineType, getStagesForType, pipelineTypeFromOpportunityType } from '@/config/pipelineStages';

export type PipelineSortBy = 'deal_value' | 'close_date' | 'ai_probability' | 'days_stale' | 'created_at';
export type PipelineFilterType = PipelineType | 'all';

export function usePipelineFilters(opportunities: Opportunity[]) {
  const [pipelineType, setPipelineType] = useState<PipelineFilterType>('all');
  const [showLost, setShowLost] = useState(false);
  const [sortBy, setSortBy] = useState<PipelineSortBy>('created_at');
  const [filterStage, setFilterStage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...opportunities];

    // Filter by pipeline type
    if (pipelineType !== 'all') {
      result = result.filter(o => {
        const pt = (o as any).pipeline_type ?? pipelineTypeFromOpportunityType((o as any).opportunity_type ?? 'buyer');
        return pt === pipelineType;
      });
    }

    // Filter out lost/withdrawn unless explicitly shown
    if (!showLost) {
      result = result.filter(o => {
        const outcome = (o as any).outcome;
        return !outcome || !['lost', 'withdrawn'].includes(outcome);
      });
    }

    // Filter by specific stage
    if (filterStage) {
      result = result.filter(o => o.stage === filterStage);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'deal_value':
          return (b.deal_value ?? 0) - (a.deal_value ?? 0);
        case 'close_date': {
          const aDate = a.expected_close_date ? new Date(a.expected_close_date).getTime() : Infinity;
          const bDate = b.expected_close_date ? new Date(b.expected_close_date).getTime() : Infinity;
          return aDate - bDate;
        }
        case 'ai_probability':
          return ((b as any).ai_deal_probability ?? 0) - ((a as any).ai_deal_probability ?? 0);
        case 'days_stale':
          return ((b as any).days_in_current_stage ?? 0) - ((a as any).days_in_current_stage ?? 0);
        case 'created_at':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [opportunities, pipelineType, showLost, sortBy, filterStage]);

  // Stages to display on the board
  const boardStages = useMemo(() => {
    if (pipelineType === 'all') return getStagesForType('all');
    return getStagesForType(pipelineType);
  }, [pipelineType]);

  // AI stats summary
  const aiStats = useMemo(() => {
    const scored = filtered.filter(o => (o as any).ai_deal_probability != null);
    const stale = filtered.filter(o => (o as any).is_stale === true);
    const avgProb = scored.length > 0
      ? Math.round(scored.reduce((s, o) => s + ((o as any).ai_deal_probability ?? 0), 0) / scored.length)
      : null;
    return { scored: scored.length, stale: stale.length, avgProbability: avgProb, total: filtered.length };
  }, [filtered]);

  return {
    filtered,
    boardStages,
    aiStats,
    pipelineType, setPipelineType,
    showLost, setShowLost,
    sortBy, setSortBy,
    filterStage, setFilterStage,
  };
}

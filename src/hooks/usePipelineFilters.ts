import { useState, useMemo, useEffect } from 'react';
import { Opportunity } from './usePipeline';
import { PipelineType, getBoardStages, getEffectivePipelineType } from '@/config/pipelineStages';

export type PipelineSortBy = 'deal_value' | 'close_date' | 'ai_probability' | 'days_stale' | 'created_at';
export type PipelineFilterType = PipelineType | 'all';

// Per Pipeline UX audit Should-fix #13: agents have a preferred sort (often
// "Most stale" or "Closest close" — not "Newest first") and forcing them to
// re-pick it on every visit is friction. Persist last-used to localStorage.
// Read defensively so a corrupted/missing value falls back to the sensible
// default rather than crashing.
const SORT_STORAGE_KEY = 'reop.pipeline.sortBy';
const VALID_SORTS: PipelineSortBy[] = ['deal_value', 'close_date', 'ai_probability', 'days_stale', 'created_at'];

function readStoredSort(): PipelineSortBy {
  if (typeof window === 'undefined') return 'created_at';
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (raw && (VALID_SORTS as string[]).includes(raw)) return raw as PipelineSortBy;
  } catch {
    // localStorage may throw in privacy mode; treat as no preference.
  }
  return 'created_at';
}

export function usePipelineFilters(opportunities: Opportunity[]) {
  const [pipelineType, setPipelineType] = useState<PipelineFilterType>('all');
  const [sortBy, setSortBy] = useState<PipelineSortBy>(readStoredSort);
  const [filterStage, setFilterStage] = useState<string | null>(null);

  // Persist on change. Failures are silent — a non-persisted sort is no worse
  // than the pre-fix behavior.
  useEffect(() => {
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortBy);
    } catch {
      /* privacy mode / quota — ignore */
    }
  }, [sortBy]);

  const filtered = useMemo(() => {
    let result = [...opportunities];

    // Filter by pipeline type
    if (pipelineType !== 'all') {
      result = result.filter(o => getEffectivePipelineType(o) === pipelineType);
    }

    // Phase 1: Lost deals are now a first-class meta-stage column (Closed
    // lost) on the board. The legacy "Show lost" toggle that hid them by
    // default is gone — agents need to find lost deals to follow up later.
    // Withdrawn opportunities also flow through the closed_lost meta now.

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
  }, [opportunities, pipelineType, sortBy, filterStage]);

  // Stages to display on the board — universal across types now.
  // The `pipelineType` filter no longer drives a different stage set;
  // it filters which opportunities show, not which columns exist.
  const boardStages = useMemo(() => getBoardStages(), []);

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
    sortBy, setSortBy,
    filterStage, setFilterStage,
  };
}

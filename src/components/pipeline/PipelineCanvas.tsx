import { useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { MultiBackend } from 'react-dnd-multi-backend';
import { HTML5toTouch } from '@/lib/dndBackend';
import { usePipeline, type Opportunity } from '@/hooks/usePipeline';
import { usePipelineFilters, type PipelineFilterType, type PipelineSortBy } from '@/hooks/usePipelineFilters';
import { PipelineBoard } from './PipelineBoard';
import { AddOpportunityDialog } from './AddOpportunityDialog';
import { OpportunityDetailV2 } from './OpportunityDetailV2';
import { getBoardStages } from '@/config/pipelineStages';
import { TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';

type Variant = 'hub' | 'standalone';

export function PipelineCanvas({ variant = 'hub' }: { variant?: Variant }) {
  const { opportunities, metrics, loading, updateStage, refresh } = usePipeline();
  const {
    filtered, aiStats,
    pipelineType, setPipelineType,
    sortBy, setSortBy,
  } = usePipelineFilters(opportunities);

  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);

  // Volume-by-stage from active opportunities. One bucket per board stage
  // (the 7 — `lost` is off-board). Sphere-only rows (stage = NULL) are
  // ignored. Cards beyond the 4 visible summary tiles below still show
  // their stage on the kanban itself.
  const boardStages = useMemo(() => getBoardStages(), []);
  const summaryStages = useMemo(() => boardStages.slice(0, 4), [boardStages]);
  const stageBuckets = useMemo(() => {
    const buckets: Record<string, { count: number; volume: number }> =
      Object.fromEntries(boardStages.map((s) => [s.key, { count: 0, volume: 0 }]));
    for (const o of filtered) {
      if (!o.stage || !buckets[o.stage]) continue;
      buckets[o.stage].count++;
      buckets[o.stage].volume += o.deal_value ?? 0;
    }
    return buckets;
  }, [filtered, boardStages]);

  const formatCurrency = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    if (n > 0) return `$${n.toLocaleString()}`;
    return '$0';
  };

  return (
    // react-dnd's useDrag/useDrop in OpportunityCard + PipelineColumn need an
    // ancestor DndProvider. Phase 3: swapped from HTML5Backend to MultiBackend
    // (HTML5 + Touch) so drag-and-drop works on mobile too — agents reviewing
    // leads on a phone couldn't move cards before. Backend config lives in
    // src/lib/dndBackend.ts and is shared with the Newsletter builder.
    <DndProvider backend={MultiBackend} options={HTML5toTouch}>
      {/* Stage summary tiles — first 4 stages of the funnel as a quick
          glance row above the full 7-column board. The remaining 3 stages
          (active / under contract / closed) are visible on the board
          itself so we don't double-count them as tiles. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 mb-5">
        {summaryStages.map((s) => {
          const b = stageBuckets[s.key];
          return (
            <div
              key={s.key}
              className="relative overflow-hidden bg-card border border-border rounded-[10px] p-[14px_16px]"
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: s.accent }}
              />
              <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground font-semibold mb-2">
                {s.label}
              </div>
              <div className="text-[22px] sm:text-[26px] font-semibold leading-none -tracking-[0.02em]">
                {b.count}
              </div>
              <div className="text-[12px] sm:text-[12.5px] text-muted-foreground mt-1">
                {b.volume > 0 ? formatCurrency(b.volume) : 'No volume'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total + AI stats strip — values suppressed at zero state.
          A confident-looking "$0 / 0.0% / 0 AI scored" reads like a real
          measurement on first open; em-dashes signal "not enough data yet"
          (Pipeline UX audit, Should-fix #7 + Must-fix #4). */}
      <section className="bg-card border border-border rounded-xl p-4 mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Pipeline value
          </span>
          <span className="text-[18px] font-semibold ml-2">
            {metrics.pipelineValue > 0 ? formatCurrency(metrics.pipelineValue) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-muted-foreground">Win rate</span>
          <span className="text-[14px] font-semibold">
            {metrics.winRate !== null ? `${metrics.winRate.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[12.5px] text-muted-foreground">AI scored</span>
          <span className="text-[14px] font-semibold">
            {aiStats.scored > 0 ? aiStats.scored : '—'}
          </span>
          {aiStats.avgProbability !== null && (
            <span className="text-[12px] text-muted-foreground">
              · avg {aiStats.avgProbability}%
            </span>
          )}
        </div>
        {aiStats.stale > 0 && (
          <div className="flex items-center gap-1.5 text-[12.5px] text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            <b>{aiStats.stale}</b> stale
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={pipelineType}
            onChange={(e) => setPipelineType(e.target.value as PipelineFilterType)}
            className="h-9 px-2.5 rounded-md border border-border bg-card text-[12.5px] text-reop-dark-blue font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All pipelines</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="referral">Referral</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as PipelineSortBy)}
            className="h-9 px-2.5 rounded-md border border-border bg-card text-[12.5px] text-reop-dark-blue font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="created_at">Newest first</option>
            <option value="deal_value">Highest value</option>
            <option value="close_date">Closest close</option>
            <option value="ai_probability">AI probability</option>
            <option value="days_stale">Most stale</option>
          </select>
          {/* "Show lost" toggle removed in Phase 1.3 — lost deals now live in
              the dedicated Closed lost meta-stage column instead of being
              filtered from the board by default. */}
          {variant === 'standalone' && (
            <AddOpportunityDialog onOpportunityCreated={refresh} />
          )}
        </div>
      </section>

      {/* Zero-state: when the agent has no opportunities at all (vs. an empty
          filter result), four blank colored rectangles tell them nothing. Show
          a centered explainer card with the same Add Opportunity CTA so the
          first-action path is unambiguous (audit Must-fix #5). The full board
          still appears once any opportunity exists, even if the active filters
          hide it — that case keeps the columns + per-column "Drop here…" hint.
          A separate filtered-empty hint could come later. */}
      {!loading && opportunities.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-8 md:p-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-reop-teal-soft text-primary mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base md:text-lg font-semibold text-foreground mb-2">
              No opportunities yet
            </h3>
            <p className="text-sm text-muted-foreground leading-[1.55] mb-5">
              Add your first one — typically a buyer or seller you're actively working with.
              Once you have a few in motion, drag them between stages as opportunities progress.
            </p>
            {variant === 'standalone' && (
              <AddOpportunityDialog onOpportunityCreated={refresh} />
            )}
          </div>
        </div>
      ) : (
        <PipelineBoard
          opportunities={filtered}
          onStageUpdate={updateStage}
          onEditOpportunity={(o) => setEditingOpportunity(o)}
          loading={loading}
        />
      )}

      <OpportunityDetailV2
        opportunity={editingOpportunity}
        open={!!editingOpportunity}
        onClose={() => setEditingOpportunity(null)}
        onRefresh={refresh}
      />
    </DndProvider>
  );
}

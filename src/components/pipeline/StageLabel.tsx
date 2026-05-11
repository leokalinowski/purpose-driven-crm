/**
 * Shared stage-label display. Use this anywhere a stage needs to render —
 * cards, lists, drawer header, Today view — instead of inlining
 * `getStageLabel(stage, pipelineType)` or hand-rolling `replace(/_/g, ' ')`.
 *
 * Shows the META-stage label (Leads / Working / Under contract / Closed),
 * not the fine-grained sub-stage. The board column vocabulary is the single
 * source of truth across the Pipeline UI per the simplification pass.
 */

import { cn } from '@/lib/utils';
import {
  getStageAccent,
  getMetaStageForKey,
  getEffectivePipelineType,
  META_STAGES,
} from '@/config/pipelineStages';

interface StageLabelProps {
  stage: string | null | undefined;
  /** Either pass an opportunity (we'll resolve pipeline_type) or pass it directly. */
  opportunity?: { pipeline_type?: string | null; opportunity_type?: string | null };
  pipelineType?: 'buyer' | 'seller' | 'referral';
  /** Render as a tinted pill. Default: plain text. */
  variant?: 'text' | 'pill';
  className?: string;
}

export function StageLabel({
  stage,
  opportunity,
  pipelineType: pipelineTypeProp,
  variant = 'text',
  className,
}: StageLabelProps) {
  if (!stage) return <span className={cn('text-muted-foreground', className)}>—</span>;

  const pipelineType =
    pipelineTypeProp ??
    (opportunity ? getEffectivePipelineType(opportunity) : 'buyer');

  const meta = getMetaStageForKey(stage);
  const metaDef = meta ? META_STAGES.find(m => m.key === meta) : undefined;
  // Falls back to the raw sub-stage key (title-cased) if it has no meta —
  // safety net for unmapped legacy data, NOT the expected path.
  const label = metaDef?.label ?? stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const accent = getStageAccent(stage, pipelineType);

  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'inline-flex items-center text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded',
          className,
        )}
        // 8-char hex with `1a` alpha = 10% opacity tint of the accent color.
        style={{ backgroundColor: `${accent}1a`, color: accent }}
      >
        {label}
      </span>
    );
  }

  return <span className={className}>{label}</span>;
}

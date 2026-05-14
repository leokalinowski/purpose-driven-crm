/**
 * Shared stage-label display. Use this anywhere a stage needs to render —
 * cards, lists, drawer header, Today view — instead of inlining
 * `getStageLabel(stage)` or hand-rolling `replace(/_/g, ' ')`.
 *
 * Renders the canonical sentence-case label from PIPELINE_STAGES (one of
 * Pam's 7 + `lost`). The `pill` variant tints with the stage's accent.
 */

import { cn } from '@/lib/utils';
import { getStageAccent, getStageLabel } from '@/config/pipelineStages';

interface StageLabelProps {
  stage: string | null | undefined;
  /** Kept for API stability — opportunity_type drives the type badge,
   *  not stage labels (stages are now universal). */
  opportunity?: { pipeline_type?: string | null; opportunity_type?: string | null };
  pipelineType?: 'buyer' | 'seller' | 'referral';
  /** Render as a tinted pill. Default: plain text. */
  variant?: 'text' | 'pill';
  className?: string;
}

export function StageLabel({
  stage,
  variant = 'text',
  className,
}: StageLabelProps) {
  if (!stage) return <span className={cn('text-muted-foreground', className)}>—</span>;

  const label = getStageLabel(stage);
  const accent = getStageAccent(stage);

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

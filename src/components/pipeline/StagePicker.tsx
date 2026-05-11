/**
 * Shared stage picker — shows the 4 meta-stages from the kanban board
 * (Leads / Working / Under contract / Closed). The DB stores fine-grained
 * sub-stage values (`active_search`, `offer_submitted`, etc.) but agents
 * never see them in this picker — choosing a meta resolves to the canonical
 * sub-stage for that opportunity's pipeline type via `defaultSubStage`.
 *
 * Why meta-only: the user evaluation showed sub-stage labels felt like
 * "old CRM stages" cluttering the dropdown. The board column is the single
 * source of truth for vocabulary; the picker matches it exactly.
 *
 * Used by OpportunityDetailV2 (Transaction tab), EditOpportunityDialog,
 * AddOpportunityDialog. Loss-of-precision is real: picking "Working" for a
 * buyer at `showing` will demote them to `active_search`. That's the
 * deliberate trade-off — agents who want sub-stage precision can still
 * change it via SQL or a future power-user UI; the kanban surface is
 * intentionally simpler.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  META_STAGES,
  defaultSubStage,
  getMetaStageForKey,
  type PipelineType,
  type MetaStage,
} from '@/config/pipelineStages';

interface StagePickerProps {
  /** Current sub-stage key from the DB (e.g. `active_search`). */
  value: string;
  /**
   * Called with the resolved sub-stage key, NOT the meta. Callers can
   * persist this directly to `opportunities.stage`.
   */
  onChange: (newSubStage: string) => void;
  /** Pipeline type — used to resolve the default sub-stage on selection. */
  pipelineType: PipelineType;
  /** Optional label above the trigger. Pass null to suppress. */
  label?: string | null;
  /** Trigger height — defaults to h-8 to match drawer forms. */
  triggerClassName?: string;
  /** Optional id for label/control linking. */
  id?: string;
}

export function StagePicker({
  value,
  onChange,
  pipelineType,
  label = 'Stage',
  triggerClassName = 'h-8 text-sm',
  id,
}: StagePickerProps) {
  // Show the meta-stage of the current sub-stage. Falls back to empty if the
  // sub-stage isn't recognized (e.g. legacy pre-meta-stage data).
  const currentMeta = getMetaStageForKey(value) ?? '';

  const handleChange = (newMeta: string) => {
    if (!newMeta || newMeta === currentMeta) return;
    const subStage = defaultSubStage(newMeta as MetaStage, pipelineType);
    onChange(subStage);
  };

  return (
    <div>
      {label !== null && (
        <Label htmlFor={id} className="text-xs text-muted-foreground mb-1 block">
          {label}
        </Label>
      )}
      <Select value={currentMeta} onValueChange={handleChange}>
        <SelectTrigger id={id} className={triggerClassName}>
          <SelectValue placeholder="Select stage…" />
        </SelectTrigger>
        <SelectContent>
          {META_STAGES.map(meta => (
            <SelectItem key={meta.key} value={meta.key} className="text-sm">
              {meta.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

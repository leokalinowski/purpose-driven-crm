/**
 * Shared stage picker — shows Pam's 7 stages directly (universal, no
 * buyer/seller/referral split). `lost` is intentionally excluded from
 * the default picker; agents move opportunities to `lost` via a
 * dedicated action elsewhere (drawer menu / filter view).
 *
 * Used by OpportunityDetailV2 (Transaction tab), EditOpportunityDialog,
 * AddOpportunityDialog.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getBoardStages, type PipelineType } from '@/config/pipelineStages';

interface StagePickerProps {
  /** Current stage key from the DB. */
  value: string | null | undefined;
  onChange: (newStage: string) => void;
  /** Pipeline type — preserved for API stability; not used (stages are
   *  universal across types now). */
  pipelineType?: PipelineType;
  /** Optional label above the trigger. Pass null to suppress. */
  label?: string | null;
  /** Trigger height — defaults to h-8 to match drawer forms. */
  triggerClassName?: string;
  /** Optional id for label/control linking. */
  id?: string;
  /** Include `lost` in the dropdown (default false). */
  includeLost?: boolean;
}

export function StagePicker({
  value,
  onChange,
  label = 'Stage',
  triggerClassName = 'h-8 text-sm',
  id,
  includeLost = false,
}: StagePickerProps) {
  const stages = includeLost
    ? [...getBoardStages(), { key: 'lost', label: 'Lost' }]
    : getBoardStages();

  const handleChange = (newStage: string) => {
    if (!newStage || newStage === value) return;
    onChange(newStage);
  };

  return (
    <div>
      {label !== null && (
        <Label htmlFor={id} className="text-xs text-muted-foreground mb-1 block">
          {label}
        </Label>
      )}
      <Select value={value ?? ''} onValueChange={handleChange}>
        <SelectTrigger id={id} className={triggerClassName}>
          <SelectValue placeholder="Select stage…" />
        </SelectTrigger>
        <SelectContent>
          {stages.map((stage) => (
            <SelectItem key={stage.key} value={stage.key} className="text-sm">
              {stage.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

import { useRef } from 'react';
import { useDrag } from 'react-dnd';
import { Opportunity } from "@/hooks/usePipeline";
import {
  getStageAccent,
  getStageLabel,
  getBoardStages,
} from "@/config/pipelineStages";
import { Calendar, DollarSign, ArrowRight, AlertCircle, MoreHorizontal, Check, ShieldAlert } from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onEdit: (opportunity: Opportunity) => void;
  onStageChange?: (opportunityId: string, newStage: string) => void;
}

export function OpportunityCard({ opportunity, onEdit, onStageChange }: OpportunityCardProps) {
  const dragMoved = useRef(false);
  const mouseStart = useRef({ x: 0, y: 0 });

  const [{ isDragging }, drag] = useDrag({
    type: 'opportunity',
    item: () => { dragMoved.current = false; return { id: opportunity.id }; },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStart.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - mouseStart.current.x;
    const dy = e.clientY - mouseStart.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 4) dragMoved.current = true;
  };
  const handleClick = () => {
    if (!dragMoved.current) onEdit(opportunity);
  };

  const accent = getStageAccent(opportunity.stage);
  const stageLabel = getStageLabel(opportunity.stage);
  const boardStages = getBoardStages();

  const contactName = opportunity.contact?.first_name || opportunity.contact?.last_name
    ? `${opportunity.contact?.first_name ?? ''} ${opportunity.contact?.last_name ?? ''}`.trim()
    : opportunity.title ?? 'Unknown';

  const hasDue = !!opportunity.next_step_due_date;
  const dueDate = hasDue ? parseISO(opportunity.next_step_due_date!) : null;
  const isDueOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);

  return (
    <div
      ref={drag}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      className={cn(
        'bg-card border border-border rounded-lg p-3 cursor-pointer select-none relative',
        'hover:border-foreground/20 hover:shadow-sm transition-all duration-100',
        'border-l-[3px]',
        isDragging && 'opacity-40 shadow-lg scale-[0.98]'
      )}
      style={{ borderLeftColor: accent }}
    >
      {/* Top row: name + (optional) DNC pill + move-to menu.
          Per Pipeline UX audit Should-fix #10: agents calling/texting from a
          card need an immediate DNC signal. Without this they'd open the
          detail drawer first or, worse, dial without checking. The contact
          join already includes `dnc`, so this is purely a render-side surface.
          Reused styling pattern from ConversationStarterModal's DncBanner —
          amber, compact, glanceable. */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <p className="font-medium text-sm text-foreground leading-tight min-w-0">{contactName}</p>
          {opportunity.contact?.dnc && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
              title="On the Do-Not-Call registry. Sphere outreach is permitted under EBR — your judgment call."
            >
              <ShieldAlert className="h-2.5 w-2.5" />
              DNC
            </span>
          )}
        </div>
        {onStageChange && (
          <div onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-8 md:h-7 md:w-7 -mt-1 -mr-1 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                  aria-label="Move to stage"
                  title="Move to stage"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* The 7 board stages — same vocabulary everywhere.
                    `lost` is intentionally excluded from this quick-move
                    menu; it lives in a separate filter view. */}
                {boardStages.map(stage => (
                  <DropdownMenuItem
                    key={stage.key}
                    onClick={() => {
                      if (stage.key === opportunity.stage) return;
                      onStageChange(opportunity.id, stage.key);
                    }}
                    className="gap-2"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: stage.accent }}
                    />
                    <span className="flex-1">{stage.label}</span>
                    {stage.key === opportunity.stage && (
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Stage pill — universal Pam-style stage label (e.g.
          "Opportunity identified"). Matches the column the card lives in. */}
      {opportunity.stage && (
        <div className="mb-2">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            {stageLabel}
          </span>
        </div>
      )}

      {/* Next step */}
      {opportunity.next_step_title ? (
        <div className={cn('flex items-start gap-1 mb-2', isDueOverdue ? 'text-red-600' : 'text-muted-foreground')}>
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p className="text-xs leading-tight line-clamp-2">{opportunity.next_step_title}</p>
        </div>
      ) : (
        <div className="flex items-center gap-1 mb-2 text-orange-500">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <p className="text-xs">No next step</p>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        {opportunity.deal_value != null && opportunity.deal_value > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            {opportunity.deal_value >= 1_000_000
              ? `${(opportunity.deal_value / 1_000_000).toFixed(1)}M`
              : `${Math.round(opportunity.deal_value / 1000)}k`}
          </span>
        )}
        {opportunity.next_step_due_date && (
          <span className={cn('flex items-center gap-0.5 text-xs', isDueOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
            <Calendar className="h-3 w-3" />
            {isToday(parseISO(opportunity.next_step_due_date)) ? 'Today' : format(parseISO(opportunity.next_step_due_date), 'MMM d')}
          </span>
        )}
      </div>
    </div>
  );
}

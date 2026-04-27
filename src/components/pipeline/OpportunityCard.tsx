import { useRef } from 'react';
import { useDrag } from 'react-dnd';
import { Opportunity } from "@/hooks/usePipeline";
import { pipelineTypeFromOpportunityType, getStageAccent, getStagesForType, getStageLabel, PipelineType } from "@/config/pipelineStages";
import { Calendar, ArrowRight, AlertCircle, MoreHorizontal, Check, Clock } from "lucide-react";
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

function fmtValue(v: number) {
  return v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `$${Math.round(v / 1_000)}K`
    : `$${v.toLocaleString()}`;
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

  const pipelineType = (opportunity.pipeline_type ?? pipelineTypeFromOpportunityType(opportunity.opportunity_type ?? 'buyer')) as PipelineType;
  const accent = getStageAccent(opportunity.stage, pipelineType);
  const stages = getStagesForType(pipelineType);

  const contactName = opportunity.contact?.first_name || opportunity.contact?.last_name
    ? `${opportunity.contact?.first_name ?? ''} ${opportunity.contact?.last_name ?? ''}`.trim()
    : opportunity.title ?? 'Unknown';

  const displayAddress = opportunity.property_address
    ? opportunity.property_city
      ? `${opportunity.property_address}, ${opportunity.property_city}`
      : opportunity.property_address
    : null;

  const hasDue = !!opportunity.next_step_due_date;
  const dueDate = hasDue ? parseISO(opportunity.next_step_due_date!) : null;
  const isDueOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);

  const daysInStage = opportunity.days_in_current_stage ?? 0;
  const isStale = opportunity.is_stale || daysInStage > 21;

  // Coach nudge: prefer ai_suggested_next_action, fall back to risk flags
  const nudgeText = opportunity.ai_suggested_next_action ?? opportunity.ai_risk_flags?.[0] ?? null;
  const nudgeTone: 'warn' | 'risk' | null =
    isDueOverdue ? 'risk' : isStale ? 'warn' : nudgeText ? 'warn' : null;

  return (
    <div
      ref={drag}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      className={cn(
        'bg-card border border-border rounded-xl overflow-hidden cursor-pointer select-none relative transition-all duration-100',
        'hover:border-foreground/20 hover:shadow-sm',
        'border-t-[3px]',
        isDragging && 'opacity-40 shadow-lg scale-[0.98]'
      )}
      style={{ borderTopColor: accent, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'transparent' }}
    >
      <div className="border border-border rounded-xl border-t-0 -mt-px overflow-hidden">
        <div className="p-3.5">
          {/* Top row: name + stage menu */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-sm text-foreground leading-tight flex-1 min-w-0">{contactName}</p>
            {onStageChange && (
              <div onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-8 w-8 md:h-7 md:w-7 -mt-1 -mr-1 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                      aria-label="Move to stage"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {stages.map(s => (
                      <DropdownMenuItem
                        key={s.key}
                        onClick={() => { if (s.key !== opportunity.stage) onStageChange(opportunity.id, s.key); }}
                        className="gap-2"
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.accent }} />
                        <span className="flex-1">{s.label}</span>
                        {s.key === opportunity.stage && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Address */}
          {displayAddress && (
            <p className="text-[11px] text-muted-foreground mb-2 truncate">{displayAddress}</p>
          )}

          {/* Stage pill */}
          <div className="mb-2.5">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${accent}1a`, color: accent }}
            >
              {getStageLabel(opportunity.stage, pipelineType)}
            </span>
          </div>

          {/* Next step */}
          {opportunity.next_step_title ? (
            <div className={cn('flex items-start gap-1 mb-2.5', isDueOverdue ? 'text-red-600' : 'text-muted-foreground')}>
              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <p className="text-xs leading-tight line-clamp-2">{opportunity.next_step_title}</p>
            </div>
          ) : (
            <div className="flex items-center gap-1 mb-2.5 text-orange-500">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <p className="text-xs">No next step</p>
            </div>
          )}

          {/* Meta row: value (teal) + due date + days in stage */}
          <div className="flex items-center gap-3 flex-wrap">
            {opportunity.deal_value != null && opportunity.deal_value > 0 && (
              <span className="text-xs font-semibold text-primary">
                {fmtValue(opportunity.deal_value)}
              </span>
            )}
            {opportunity.next_step_due_date && (
              <span className={cn('flex items-center gap-0.5 text-xs', isDueOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                <Calendar className="h-3 w-3" />
                {isToday(parseISO(opportunity.next_step_due_date)) ? 'Today' : format(parseISO(opportunity.next_step_due_date), 'MMM d')}
              </span>
            )}
            {daysInStage > 0 && (
              <span className={cn('flex items-center gap-0.5 text-xs', isStale ? 'text-amber-600' : 'text-muted-foreground')}>
                <Clock className="h-3 w-3" />
                {daysInStage}d
              </span>
            )}
          </div>
        </div>

        {/* Coach nudge strip */}
        {nudgeTone && nudgeText && (
          <div className={cn(
            'px-3.5 py-2 text-[11px] leading-snug border-t',
            nudgeTone === 'risk'
              ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-amber-50 border-amber-100 text-amber-700'
          )}>
            {nudgeText}
          </div>
        )}
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { useDrag } from 'react-dnd';
import { Opportunity } from "@/hooks/usePipeline";
import { pipelineTypeFromOpportunityType, getStageAccent } from "@/config/pipelineStages";
import { Calendar, DollarSign, ArrowRight, AlertCircle } from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { cn } from '@/lib/utils';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onEdit: (opportunity: Opportunity) => void;
}

export function OpportunityCard({ opportunity, onEdit }: OpportunityCardProps) {
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

  const pipelineType = (opportunity.pipeline_type ?? pipelineTypeFromOpportunityType(opportunity.opportunity_type ?? 'buyer')) as 'buyer' | 'seller' | 'referral';
  const accent = getStageAccent(opportunity.stage, pipelineType);

  const contactName = opportunity.contact?.first_name || opportunity.contact?.last_name
    ? `${opportunity.contact?.first_name ?? ''} ${opportunity.contact?.last_name ?? ''}`.trim()
    : opportunity.title ?? 'Unknown';

  // Next step due status
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
        'bg-card border border-border rounded-lg p-3 cursor-pointer select-none',
        'hover:border-foreground/20 hover:shadow-sm transition-all duration-100',
        'border-l-[3px]',
        isDragging && 'opacity-40 shadow-lg scale-[0.98]'
      )}
      style={{ borderLeftColor: accent }}
    >
      {/* Name */}
      <p className="font-medium text-sm text-foreground leading-tight mb-1.5">{contactName}</p>

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

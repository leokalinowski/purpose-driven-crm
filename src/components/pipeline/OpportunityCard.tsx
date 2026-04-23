import { useDrag } from 'react-dnd';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/hooks/usePipeline";
import { Calendar, DollarSign, Clock, Shield, Zap } from "lucide-react";
import { format } from "date-fns";
import { useState, useRef } from "react";
import { pipelineTypeFromOpportunityType } from "@/config/pipelineStages";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onEdit: (opportunity: Opportunity) => void;
}

function AIProbabilityPill({ probability }: { probability: number }) {
  const colorClass =
    probability >= 70
      ? 'bg-green-100 text-green-700 border-green-200'
      : probability >= 40
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : 'bg-red-100 text-red-700 border-red-200';

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold leading-none ${colorClass}`}>
      <Zap className="h-2.5 w-2.5" />
      {probability}%
    </span>
  );
}

export function OpportunityCard({ opportunity, onEdit }: OpportunityCardProps) {
  const [dragDistance, setDragDistance] = useState(0);
  const startPos = useRef({ x: 0, y: 0 });

  const [{ isDragging }, drag] = useDrag({
    type: 'opportunity',
    item: { id: opportunity.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const handleClick = () => {
    if (dragDistance < 5) {
      onEdit(opportunity);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startPos.current = { x: e.clientX, y: e.clientY };
    setDragDistance(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (startPos.current.x !== 0 || startPos.current.y !== 0) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - startPos.current.x, 2) +
        Math.pow(e.clientY - startPos.current.y, 2)
      );
      setDragDistance(distance);
    }
  };

  const handleMouseUp = () => {
    startPos.current = { x: 0, y: 0 };
  };

  const pipelineType =
    (opportunity.pipeline_type as 'buyer' | 'seller' | 'referral' | null) ??
    pipelineTypeFromOpportunityType(opportunity.opportunity_type ?? 'buyer');

  const borderColorClass =
    pipelineType === 'buyer'
      ? 'border-l-blue-500'
      : pipelineType === 'seller'
      ? 'border-l-amber-500'
      : pipelineType === 'referral'
      ? 'border-l-purple-500'
      : 'border-l-slate-400';

  const displayName =
    opportunity.contact?.first_name || opportunity.contact?.last_name
      ? `${opportunity.contact?.first_name ?? ''} ${opportunity.contact?.last_name ?? ''}`.trim()
      : 'Unknown Contact';

  return (
    <Card
      ref={drag}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md hover:translate-y-[-1px] group
        ${isDragging ? 'opacity-40 scale-95 shadow-lg' : 'opacity-100'}
        w-full border-l-4 ${borderColorClass}
        bg-card select-none
      `}
    >
      <CardContent className="p-3 flex flex-col gap-1.5">
        {/* Header row: name + AI probability */}
        <div className="flex items-start justify-between gap-1">
          <h4 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors leading-tight flex-1 min-w-0">
            {displayName}
          </h4>
          <div className="flex items-center gap-1 flex-shrink-0">
            {opportunity.contact?.dnc && (
              <Shield className="h-3.5 w-3.5 text-destructive" aria-label="DNC" />
            )}
            {opportunity.ai_deal_probability != null && (
              <AIProbabilityPill probability={opportunity.ai_deal_probability} />
            )}
          </div>
        </div>

        {/* Title (optional) */}
        {opportunity.title && (
          <p className="text-xs text-muted-foreground truncate leading-tight">
            {opportunity.title}
          </p>
        )}

        {/* Deal value + close date row */}
        <div className="flex items-center gap-3 flex-wrap">
          {opportunity.deal_value != null && opportunity.deal_value > 0 && (
            <div className="flex items-center gap-1 text-xs font-semibold text-primary">
              <DollarSign className="h-3 w-3 flex-shrink-0" />
              <span>${opportunity.deal_value.toLocaleString()}</span>
            </div>
          )}
          {opportunity.expected_close_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>{format(new Date(opportunity.expected_close_date), 'MMM dd')}</span>
            </div>
          )}
          {opportunity.is_stale && (
            <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>{opportunity.days_in_current_stage}d</span>
            </div>
          )}
        </div>

        {/* AI suggested next action */}
        {opportunity.ai_suggested_next_action && (
          <p className="text-[11px] text-muted-foreground italic truncate leading-tight border-t border-border/50 pt-1 mt-0.5">
            {opportunity.ai_suggested_next_action}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

import { useDrag } from 'react-dnd';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/hooks/usePipeline";
import { Calendar, DollarSign, User, Shield, ShieldCheck, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useState, useRef } from "react";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onEdit: (opportunity: Opportunity) => void;
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

  const handleClick = (e: React.MouseEvent) => {
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

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'lead': return 'bg-muted text-muted-foreground';
      case 'qualified': return 'bg-primary text-primary-foreground';
      case 'appointment': return 'bg-secondary text-secondary-foreground';
      case 'contract': return 'bg-accent text-accent-foreground';
      case 'closed': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDNCStatus = () => {
    if (!opportunity.contact?.dnc_last_checked) {
      return { icon: Shield, color: 'text-muted-foreground', text: 'NC' };
    }
    if (opportunity.contact?.dnc) {
      return { icon: Shield, color: 'text-destructive', text: 'DNC' };
    }
    return { icon: ShieldCheck, color: 'text-accent-foreground', text: 'OK' };
  };

  const dncStatus = getDNCStatus();

  // Get display name with fallback
  const displayName = opportunity.contact?.first_name || opportunity.contact?.last_name
    ? `${opportunity.contact?.first_name || ''} ${opportunity.contact?.last_name || ''}`.trim()
    : 'Unknown Contact';

  return (
    <Card
      ref={drag}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`
        relative cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-accent/10 group
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
        border-l-4 border-l-primary/30 hover:border-l-primary
        bg-card hover:bg-card/80
      `}
    >
      {/* DNC Status Badge - Top Right Corner */}
      <div className="absolute top-2 right-2 z-10">
        <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 border border-border/50">
          <dncStatus.icon className={`h-3 w-3 ${dncStatus.color}`} />
          <span className={`text-xs font-medium ${dncStatus.color}`}>
            {dncStatus.text}
          </span>
        </div>
      </div>

      <CardContent className="p-3 h-full grid grid-rows-[auto_1fr_auto] min-h-[160px]">
        {/* Header - Name and Email */}
        <div className="space-y-1 pr-12">
          <h4 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
            {displayName}
          </h4>
          {opportunity.contact?.email && (
            <p className="text-xs text-muted-foreground truncate">
              {opportunity.contact.email}
            </p>
          )}
        </div>

        {/* Content - Deal Info */}
        <div className="py-2 space-y-2">
          {opportunity.deal_value && opportunity.deal_value > 0 && (
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">${opportunity.deal_value.toLocaleString()}</span>
            </div>
          )}
          {opportunity.expected_close_date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{format(new Date(opportunity.expected_close_date), 'MMM dd')}</span>
            </div>
          )}
          {opportunity.contact?.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{opportunity.contact.phone}</span>
            </div>
          )}
        </div>

        {/* Footer - Stage Badge and Notes */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Badge
            variant="secondary"
            className={`text-xs ${getStageColor(opportunity.stage)} capitalize`}
          >
            {opportunity.stage}
          </Badge>
          {opportunity.notes && (
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
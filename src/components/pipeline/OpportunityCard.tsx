import { useDrag } from 'react-dnd';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/hooks/usePipeline";
import { Calendar, DollarSign, User, Shield, ShieldCheck } from "lucide-react";
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
    // Only trigger edit if drag distance is minimal (actual click, not drag)
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
      case 'lead': return 'bg-slate-500';
      case 'qualified': return 'bg-blue-500';
      case 'appointment': return 'bg-yellow-500';
      case 'contract': return 'bg-orange-500';
      case 'closed': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getDNCStatus = () => {
    if (!opportunity.contact?.dnc_last_checked) {
      return { icon: Shield, color: 'text-yellow-500', text: 'Not Checked' };
    }
    if (opportunity.contact?.dnc) {
      return { icon: Shield, color: 'text-red-500', text: 'Do Not Call' };
    }
    return { icon: ShieldCheck, color: 'text-green-500', text: 'Safe to Call' };
  };

  const dncStatus = getDNCStatus();

  return (
    <Card
      ref={drag}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-accent/50
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
        w-full min-h-[180px]
      `}
    >
      <CardContent className="p-3 sm:p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">
              {opportunity.contact?.first_name} {opportunity.contact?.last_name}
            </h4>
            {opportunity.contact?.email && (
              <p className="text-xs text-muted-foreground truncate">
                {opportunity.contact.email}
              </p>
            )}
            <div className="flex items-center gap-1 mt-1">
              <dncStatus.icon className={`h-3 w-3 flex-shrink-0 ${dncStatus.color}`} />
              <span className={`text-xs ${dncStatus.color} truncate`}>
                {dncStatus.text}
              </span>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={`text-xs text-white flex-shrink-0 ${getStageColor(opportunity.stage)}`}
          >
            {opportunity.stage}
          </Badge>
        </div>

        <div className="space-y-1">
          {opportunity.deal_value && opportunity.deal_value > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">${opportunity.deal_value.toLocaleString()}</span>
            </div>
          )}

          {opportunity.expected_close_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{format(new Date(opportunity.expected_close_date), 'MMM dd, yyyy')}</span>
            </div>
          )}

          {opportunity.contact?.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{opportunity.contact.phone}</span>
            </div>
          )}
        </div>

        {opportunity.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2 break-words">
            {opportunity.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
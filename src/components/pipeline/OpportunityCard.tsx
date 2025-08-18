import { useDrag } from 'react-dnd';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/hooks/usePipeline";
import { Calendar, DollarSign, User } from "lucide-react";
import { format } from "date-fns";

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const [{ isDragging }, drag] = useDrag({
    type: 'opportunity',
    item: { id: opportunity.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

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

  return (
    <Card
      ref={drag}
      className={`
        cursor-move transition-all duration-200 hover:shadow-md
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
      `}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-sm">
              {opportunity.contact?.first_name} {opportunity.contact?.last_name}
            </h4>
            {opportunity.contact?.email && (
              <p className="text-xs text-muted-foreground truncate">
                {opportunity.contact.email}
              </p>
            )}
          </div>
          <Badge 
            variant="secondary" 
            className={`text-xs text-white ${getStageColor(opportunity.stage)}`}
          >
            {opportunity.stage}
          </Badge>
        </div>

        {opportunity.deal_value && opportunity.deal_value > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            ${opportunity.deal_value.toLocaleString()}
          </div>
        )}

        {opportunity.expected_close_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(opportunity.expected_close_date), 'MMM dd, yyyy')}
          </div>
        )}

        {opportunity.contact?.phone && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {opportunity.contact.phone}
          </div>
        )}

        {opportunity.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {opportunity.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
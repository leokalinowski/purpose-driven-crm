import { ArrowRight, Clock, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActionItem } from '@/hooks/useActionItems';

interface ActionItemsCardProps {
  items: ActionItem[];
  onDismiss: (id: string, dismissUntil?: Date) => void;
}

const priorityColors: Record<string, string> = {
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-warning text-warning-foreground',
  low: 'bg-muted text-muted-foreground',
};

export function ActionItemsCard({ items, onDismiss }: ActionItemsCardProps) {
  if (items.length === 0) return null;

  const handleDismissForWeek = (id: string) => {
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
    onDismiss(id, oneWeekFromNow);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Action Items
        </CardTitle>
        <CardDescription>
          Complete these items to get the most out of your platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge className={priorityColors[item.priority] || priorityColors.medium}>
                  {item.priority}
                </Badge>
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  {item.description && (
                    <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.action_url && (
                  <Link to={item.action_url}>
                    <Button variant="outline" size="sm">
                      Go
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDismissForWeek(item.id)}
                  title="Dismiss for 1 week"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

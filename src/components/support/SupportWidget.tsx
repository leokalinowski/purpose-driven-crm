import { ArrowRight, AlertTriangle, Ticket, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useActionItems } from '@/hooks/useActionItems';
import { useSupportTickets } from '@/hooks/useSupportTickets';

export function SupportWidget() {
  const { actionItems, isLoading: actionItemsLoading } = useActionItems();
  const { tickets, isLoading: ticketsLoading } = useSupportTickets();

  const isLoading = actionItemsLoading || ticketsLoading;
  const activeTickets = tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved');
  const unresolvedActionItems = actionItems.filter(item => !item.is_dismissed);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasItems = unresolvedActionItems.length > 0 || activeTickets.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LifeBuoy className="h-5 w-5" />
            Support & Action Items
          </CardTitle>
          <Link to="/support">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {!hasItems ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">You're all caught up! 🎉</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Action Items */}
            {unresolvedActionItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">
                    {unresolvedActionItems.length} item{unresolvedActionItems.length > 1 ? 's' : ''} need your attention
                  </span>
                </div>
                <ul className="space-y-1">
                  {unresolvedActionItems.slice(0, 3).map((item) => (
                    <li key={item.id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                      <span className="truncate">{item.title}</span>
                      {item.priority === 'high' && (
                        <Badge variant="destructive" className="text-xs">Urgent</Badge>
                      )}
                    </li>
                  ))}
                  {unresolvedActionItems.length > 3 && (
                    <li className="text-xs text-muted-foreground pl-3.5">
                      +{unresolvedActionItems.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Recent Tickets */}
            {activeTickets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Recent Tickets</span>
                </div>
                <ul className="space-y-1">
                  {activeTickets.slice(0, 2).map((ticket) => (
                    <li key={ticket.id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="truncate">{ticket.subject}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

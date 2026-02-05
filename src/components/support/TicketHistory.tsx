import { format } from 'date-fns';
import { Ticket, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportTicket } from '@/hooks/useSupportTickets';

interface TicketHistoryProps {
  tickets: SupportTicket[];
  isLoading: boolean;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  open: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    label: 'Open',
  },
  in_progress: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    label: 'In Progress',
  },
  resolved: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-green-500/10 text-green-600 border-green-500/20',
    label: 'Resolved',
  },
  closed: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-muted text-muted-foreground border-muted',
    label: 'Closed',
  },
};

const categoryLabels: Record<string, string> = {
  database: 'Database',
  social: 'Social',
  events: 'Events',
  newsletter: 'Newsletter',
  spheresync: 'SphereSync',
  technical: 'Technical',
  general: 'General',
};

export function TicketHistory({ tickets, isLoading }: TicketHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            My Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          My Tickets
        </CardTitle>
        <CardDescription>
          Track the status of your support requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No tickets yet</p>
            <p className="text-sm">Submit a request above and it will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const status = statusConfig[ticket.status] || statusConfig.open;
              return (
                <div
                  key={ticket.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{ticket.subject}</span>
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[ticket.category] || ticket.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                      </span>
                      {ticket.assigned_to && (
                        <span>Assigned to: {ticket.assigned_to}</span>
                      )}
                    </div>
                  </div>
                  <Badge className={`flex items-center gap-1 ${status.color}`}>
                    {status.icon}
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { X, Send, Clock, AlertCircle, Loader2, CheckCircle, RefreshCw, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SupportTicket } from '@/hooks/useSupportTickets';
import { useTicketComments } from '@/hooks/useTicketComments';
import { TicketConversation } from './TicketConversation';

interface TicketDetailDialogProps {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  coaching: 'Coaching',
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  low: { color: 'bg-muted text-muted-foreground', label: 'Low' },
  medium: { color: 'bg-yellow-500/10 text-yellow-600', label: 'Medium' },
  high: { color: 'bg-red-500/10 text-red-600', label: 'High' },
};

export function TicketDetailDialog({ ticket, open, onOpenChange }: TicketDetailDialogProps) {
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { 
    comments, 
    isLoading, 
    refetch, 
    postComment, 
    isPosting 
  } = useTicketComments(ticket?.id || null);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current && comments.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  // Refetch comments when dialog opens
  useEffect(() => {
    if (open && ticket) {
      refetch();
    }
  }, [open, ticket, refetch]);

  const handleSendReply = () => {
    if (!replyText.trim() || isPosting) return;
    postComment(replyText.trim());
    setReplyText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  if (!ticket) return null;

  const status = statusConfig[ticket.status] || statusConfig.open;
  const priority = priorityConfig[ticket.priority] || priorityConfig.medium;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold leading-tight mb-2">
                {ticket.subject}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {categoryLabels[ticket.category] || ticket.category}
                </Badge>
                <Badge className={`text-xs ${priority.color}`}>
                  {priority.label}
                </Badge>
                <Badge className={`flex items-center gap-1 text-xs ${status.color}`}>
                  {status.icon}
                  {status.label}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Ticket details */}
        <div className="px-6 py-4 bg-muted/30">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Created:</span>{' '}
              <span className="font-medium">
                {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            {ticket.resolved_at && (
              <div>
                <span className="text-muted-foreground">Resolved:</span>{' '}
                <span className="font-medium">
                  {format(new Date(ticket.resolved_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            )}
            {ticket.assigned_to && (
              <div>
                <span className="text-muted-foreground">Assigned to:</span>{' '}
                <span className="font-medium">{ticket.assigned_to}</span>
              </div>
            )}
          </div>
          {ticket.description && (
            <div className="mt-3">
              <span className="text-sm text-muted-foreground">Description:</span>
              <p className="text-sm mt-1">{ticket.description}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Conversation header */}
        <div className="px-6 py-3 flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversation
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Conversation thread */}
        <ScrollArea className="flex-1 min-h-[200px] max-h-[300px]" ref={scrollRef}>
          <TicketConversation comments={comments} isLoading={isLoading} />
        </ScrollArea>

        <Separator />

        {/* Reply input */}
        <div className="p-4 space-y-3">
          <Textarea
            placeholder="Type your reply... (Press Enter to send, Shift+Enter for new line)"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[80px] resize-none"
            disabled={isPosting}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSendReply}
              disabled={!replyText.trim() || isPosting}
              className="gap-2"
            >
              {isPosting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

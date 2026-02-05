import { format } from 'date-fns';
import { User, HeadphonesIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TicketComment } from '@/hooks/useTicketComments';
import { Skeleton } from '@/components/ui/skeleton';

interface TicketConversationProps {
  comments: TicketComment[];
  isLoading: boolean;
}

export function TicketConversation({ comments, isLoading }: TicketConversationProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <HeadphonesIcon className="h-12 w-12 mb-3 opacity-50" />
        <p className="font-medium">No messages yet</p>
        <p className="text-sm">Start the conversation by sending a message below</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className={cn(
            'flex gap-3',
            !comment.is_admin && 'flex-row-reverse'
          )}
        >
          {/* Avatar */}
          <div
            className={cn(
              'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
              comment.is_admin 
                ? 'bg-primary/10 text-primary' 
                : 'bg-secondary text-secondary-foreground'
            )}
          >
            {comment.is_admin ? (
              <HeadphonesIcon className="h-4 w-4" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>

          {/* Message bubble */}
          <div
            className={cn(
              'flex-1 max-w-[80%]',
              !comment.is_admin && 'text-right'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'text-sm font-medium',
                !comment.is_admin && 'ml-auto'
              )}>
                {comment.is_admin ? comment.author : 'You'}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(comment.created_at), 'MMM d, h:mm a')}
              </span>
            </div>
            <div
              className={cn(
                'rounded-lg px-4 py-2 inline-block text-left',
                comment.is_admin
                  ? 'bg-muted'
                  : 'bg-primary text-primary-foreground'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

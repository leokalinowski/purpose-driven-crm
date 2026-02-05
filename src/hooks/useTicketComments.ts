import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TicketComment {
  id: string;
  text: string;
  author: string;
  author_email: string;
  created_at: string;
  is_admin: boolean;
}

export function useTicketComments(ticketId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];

      const { data, error } = await supabase.functions.invoke('get-ticket-comments', {
        body: null,
        headers: {},
      });

      // For GET requests, we need to call with query params in the URL
      const response = await supabase.functions.invoke(`get-ticket-comments?ticket_id=${ticketId}`, {
        method: 'GET',
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch comments');
      }

      return (response.data?.comments || []) as TicketComment[];
    },
    enabled: !!ticketId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const postCommentMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke('post-ticket-comment', {
        body: { ticket_id: ticketId, message },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
      toast({
        title: 'Message sent',
        description: 'Your reply has been posted to the ticket.',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to post comment:', error);
      toast({
        title: 'Failed to send message',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  return {
    comments: commentsQuery.data || [],
    isLoading: commentsQuery.isLoading,
    error: commentsQuery.error,
    refetch: commentsQuery.refetch,
    postComment: (message: string) => {
      if (ticketId) {
        postCommentMutation.mutate({ ticketId, message });
      }
    },
    isPosting: postCommentMutation.isPending,
  };
}

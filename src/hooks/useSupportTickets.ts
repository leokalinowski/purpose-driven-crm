import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type TicketCategory = 'database' | 'social' | 'events' | 'newsletter' | 'spheresync' | 'technical' | 'general';
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  agent_id: string;
  category: TicketCategory;
  subject: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  clickup_task_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CreateTicketInput {
  category: TicketCategory;
  subject: string;
  description?: string;
  priority: TicketPriority;
}

export function useSupportTickets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ticketsQuery = useQuery({
    queryKey: ['support-tickets', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user?.id,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Call edge function to create ticket and sync with ClickUp
      const { data, error } = await supabase.functions.invoke('create-support-ticket', {
        body: {
          ...input,
          agent_id: user.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast({
        title: 'Ticket submitted',
        description: 'Your support request has been created and sent to the team.',
      });
    },
    onError: (error) => {
      console.error('Failed to create ticket:', error);
      toast({
        title: 'Failed to submit ticket',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  return {
    tickets: ticketsQuery.data || [],
    isLoading: ticketsQuery.isLoading,
    error: ticketsQuery.error,
    createTicket: createTicketMutation.mutate,
    isCreating: createTicketMutation.isPending,
  };
}

export function useAdminSupportTickets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ticketsQuery = useQuery({
    queryKey: ['admin-support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          profiles:agent_id (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SupportTicket> }) => {
      const { data, error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast({
        title: 'Ticket updated',
        description: 'The ticket has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update ticket',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    tickets: ticketsQuery.data || [],
    isLoading: ticketsQuery.isLoading,
    error: ticketsQuery.error,
    updateTicket: updateTicketMutation.mutate,
    isUpdating: updateTicketMutation.isPending,
  };
}

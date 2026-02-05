import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type ActionItemType = 'no_contacts' | 'no_metricool' | 'no_coaching' | 'pending_posts' | 'incomplete_profile' | 'incomplete_event';
export type ActionItemPriority = 'high' | 'medium' | 'low';

export interface ActionItem {
  id: string;
  agent_id: string;
  item_type: ActionItemType;
  priority: ActionItemPriority;
  title: string;
  description: string | null;
  action_url: string | null;
  is_dismissed: boolean;
  dismissed_until: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function useActionItems() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const actionItemsQuery = useQuery({
    queryKey: ['action-items', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('agent_action_items')
        .select('*')
        .eq('agent_id', user.id)
        .is('resolved_at', null)
        .or(`is_dismissed.eq.false,dismissed_until.lt.${new Date().toISOString()}`)
        .order('priority', { ascending: true });

      if (error) throw error;
      return data as ActionItem[];
    },
    enabled: !!user?.id,
  });

  const dismissItemMutation = useMutation({
    mutationFn: async ({ id, dismissUntil }: { id: string; dismissUntil?: Date }) => {
      const { error } = await supabase
        .from('agent_action_items')
        .update({
          is_dismissed: true,
          dismissed_until: dismissUntil?.toISOString() || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      toast({
        title: 'Item dismissed',
        description: 'This item has been temporarily hidden.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to dismiss item',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Separate items by priority
  const highPriorityItems = actionItemsQuery.data?.filter(item => item.priority === 'high') || [];
  const otherItems = actionItemsQuery.data?.filter(item => item.priority !== 'high') || [];

  return {
    actionItems: actionItemsQuery.data || [],
    highPriorityItems,
    otherItems,
    isLoading: actionItemsQuery.isLoading,
    error: actionItemsQuery.error,
    dismissItem: dismissItemMutation.mutate,
    isDismissing: dismissItemMutation.isPending,
    refetch: actionItemsQuery.refetch,
  };
}

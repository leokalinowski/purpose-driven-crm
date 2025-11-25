import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { MetricoolLink } from '@/types';

interface CreateMetricoolLinkParams {
  userId: string;
  iframeUrl: string;
}

interface UpdateMetricoolLinkParams {
  linkId: string;
  iframeUrl: string;
}

interface ToggleMetricoolLinkParams {
  linkId: string;
  isActive: boolean;
}

export const useAllMetricoolLinks = () => {
  return useQuery({
    queryKey: ['all-metricool-links'],
    queryFn: async (): Promise<MetricoolLink[]> => {
      const { data, error } = await supabase
        .from('metricool_links')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as MetricoolLink[];
    },
  });
};

export const useMetricoolManagement = () => {
  const queryClient = useQueryClient();

  const createMetricoolLink = useMutation({
    mutationFn: async ({ userId, iframeUrl }: CreateMetricoolLinkParams) => {
      const { data, error } = await supabase
        .from('metricool_links')
        .insert({
          user_id: userId,
          iframe_url: iframeUrl,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['metricool-link', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['all-metricool-links'] });
      toast({
        title: "Success",
        description: "Metricool link created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create Metricool link",
        variant: "destructive",
      });
    },
  });

  const updateMetricoolLink = useMutation({
    mutationFn: async ({ linkId, iframeUrl }: UpdateMetricoolLinkParams) => {
      const { data, error } = await supabase
        .from('metricool_links')
        .update({
          iframe_url: iframeUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metricool-link', data.user_id] });
      queryClient.invalidateQueries({ queryKey: ['all-metricool-links'] });
      toast({
        title: "Success",
        description: "Metricool link updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update Metricool link",
        variant: "destructive",
      });
    },
  });

  const toggleMetricoolLinkStatus = useMutation({
    mutationFn: async ({ linkId, isActive }: ToggleMetricoolLinkParams) => {
      const { data, error } = await supabase
        .from('metricool_links')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metricool-link', data.user_id] });
      queryClient.invalidateQueries({ queryKey: ['all-metricool-links'] });
      toast({
        title: "Success",
        description: `Metricool link ${data.is_active ? 'activated' : 'deactivated'} successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle Metricool link status",
        variant: "destructive",
      });
    },
  });

  const deleteMetricoolLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('metricool_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      return linkId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metricool-link'] });
      queryClient.invalidateQueries({ queryKey: ['all-metricool-links'] });
      toast({
        title: "Success",
        description: "Metricool link deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete Metricool link",
        variant: "destructive",
      });
    },
  });

  return {
    createMetricoolLink,
    updateMetricoolLink,
    toggleMetricoolLinkStatus,
    deleteMetricoolLink,
  };
};

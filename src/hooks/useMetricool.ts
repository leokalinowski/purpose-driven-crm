import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MetricoolLink {
  id: string;
  user_id: string;
  iframe_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useMetricoolLink = (userId?: string) => {
  const { user } = useAuth();
  const actualUserId = userId || user?.id;

  return useQuery({
    queryKey: ['metricool-link', actualUserId],
    queryFn: async () => {
      if (!actualUserId) return null;

      const { data, error } = await supabase
        .from('metricool_links')
        .select('*')
        .eq('user_id', actualUserId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
      return data as MetricoolLink | null;
    },
    enabled: !!actualUserId,
  });
};

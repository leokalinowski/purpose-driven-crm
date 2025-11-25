import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { MetricoolLink } from '@/types';

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

      // If there's any error (including auth errors), just return null
      // The link is just a URL - if we can't fetch it, we'll show "no link configured"
      if (error) {
        // PGRST116 is "not found" - this is fine
        // Any other error (including auth) - just treat as "no link configured"
        return null;
      }
      return data as MetricoolLink | null;
    },
    enabled: !!actualUserId,
    retry: false,
  });
};

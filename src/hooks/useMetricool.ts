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

      if (error) {
        // Handle authentication errors gracefully
        if (error.code === 'PGRST116') {
          // Not found - this is fine, just means no link configured
          return null;
        }
        // For other errors, check if it's an auth error
        if (error.message?.includes('JWT') || error.message?.includes('authentication') || error.message?.includes('not authenticated')) {
          throw new Error('Authentication error. Please refresh the page or log in again.');
        }
        throw error;
      }
      return data as MetricoolLink | null;
    },
    enabled: !!actualUserId,
    retry: false, // Don't retry on auth errors
  });
};

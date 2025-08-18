import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface OpportunityActivity {
  id: string;
  opportunity_id: string;
  agent_id: string;
  activity_type: string;
  description: string;
  metadata?: any;
  activity_date: string;
  created_at: string;
}

export const useOpportunityActivities = (opportunityId: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<OpportunityActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = async () => {
    if (!user || !opportunityId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunity_activities')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('activity_date', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        title: "Error",
        description: "Failed to load activities",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addActivity = async (
    activityType: string, 
    description: string, 
    metadata?: any,
    activityDate?: string
  ) => {
    if (!user || !opportunityId) return false;

    try {
      const { data, error } = await supabase
        .from('opportunity_activities')
        .insert({
          opportunity_id: opportunityId,
          agent_id: user.id,
          activity_type: activityType,
          description,
          metadata,
          activity_date: activityDate || new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setActivities(prev => [data, ...prev]);
      return true;
    } catch (error) {
      console.error('Error adding activity:', error);
      toast({
        title: "Error",
        description: "Failed to add activity",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [user, opportunityId]);

  return {
    activities,
    loading,
    addActivity,
    refetch: fetchActivities
  };
};
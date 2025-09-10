import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ContactActivity {
  id: string;
  contact_id: string;
  agent_id: string;
  activity_type: 'call' | 'text' | 'email' | 'meeting' | 'note' | 'task';
  activity_date: string;
  duration_minutes: number | null;
  outcome: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ActivityInput {
  activity_type: ContactActivity['activity_type'];
  activity_date?: string;
  duration_minutes?: number;
  outcome?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export const useContactActivities = (contactId: string) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!user || !contactId) return;

    setLoading(true);
    try {
      // Using direct table access since contact_activities might not be in generated types yet
      const { data, error } = await (supabase as any)
        .from('contact_activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('activity_date', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching contact activities:', error);
      // Set empty array on error to prevent UI issues
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [user, contactId]);

  const addActivity = useCallback(async (activityData: ActivityInput) => {
    if (!user || !contactId) throw new Error('User not authenticated or no contact ID');

    try {
      // Using direct insert since contact_activities might not be in generated types yet
      const { data, error } = await (supabase as any)
        .from('contact_activities')
        .insert([{
          ...activityData,
          contact_id: contactId,
          agent_id: user.id,
          activity_date: activityData.activity_date || new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      // Refresh activities after adding
      await fetchActivities();
      return data;
    } catch (error) {
      console.error('Error adding activity:', error);
      throw error;
    }
  }, [user, contactId, fetchActivities]);

  const updateActivity = useCallback(async (id: string, activityData: Partial<ActivityInput>) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { data, error } = await (supabase as any)
        .from('contact_activities')
        .update(activityData)
        .eq('id', id)
        .eq('agent_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Refresh activities after updating
      await fetchActivities();
      return data;
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  }, [user, fetchActivities]);

  const deleteActivity = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await (supabase as any)
        .from('contact_activities')
        .delete()
        .eq('id', id)
        .eq('agent_id', user.id);

      if (error) throw error;

      // Refresh activities after deleting
      await fetchActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  }, [user, fetchActivities]);

  return {
    activities,
    loading,
    fetchActivities,
    addActivity,
    updateActivity,
    deleteActivity,
  };
};
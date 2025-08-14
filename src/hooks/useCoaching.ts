import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface CoachingSubmission {
  id: string;
  agent_id: string;
  week_ending: string;
  leads_contacted: number;
  appointments_set: number;
  deals_closed: number;
  challenges?: string;
  tasks?: string;
  created_at: string;
  updated_at: string;
}

export interface CoachingFormData {
  week_ending: Date;
  leads_contacted: number;
  appointments_set: number;
  deals_closed: number;
  challenges?: string;
  tasks?: string;
}

export interface WeeklyMetrics {
  week_ending: string;
  leads_contacted: number;
  appointments_set: number;
  deals_closed: number;
}

export interface TeamAverages {
  avg_leads_contacted: number;
  avg_appointments_set: number;
  avg_deals_closed: number;
}

// Get the most recent Sunday for a given date
export const getLastSunday = (date = new Date()): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? 0 : day; // If it's Sunday, use current date, otherwise go back to Sunday
  result.setDate(result.getDate() - diff);
  return result;
};

export const useCoachingSubmissions = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['coaching-submissions', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('*')
        .order('week_ending', { ascending: false });

      if (error) throw error;
      return data as CoachingSubmission[];
    },
    enabled: !!user,
  });
};

export const useSubmitCoachingForm = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: CoachingFormData) => {
      if (!user) throw new Error('User not authenticated');

      const submission = {
        agent_id: user.id,
        week_ending: formData.week_ending.toISOString().split('T')[0],
        leads_contacted: formData.leads_contacted,
        appointments_set: formData.appointments_set,
        deals_closed: formData.deals_closed,
        challenges: formData.challenges || null,
        tasks: formData.tasks || null,
      };

      const { data, error } = await supabase
        .from('coaching_submissions')
        .insert(submission)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['team-averages'] });
      toast({
        title: "Success",
        description: "Weekly performance submitted successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to submit performance data: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const usePersonalMetrics = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['personal-metrics', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('week_ending, leads_contacted, appointments_set, deals_closed')
        .eq('agent_id', user.id)
        .order('week_ending', { ascending: true });

      if (error) throw error;
      return data as WeeklyMetrics[];
    },
    enabled: !!user,
  });
};

export const useTeamAverages = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['team-averages'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      // Get the current week ending (last Sunday)
      const currentWeek = getLastSunday().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('leads_contacted, appointments_set, deals_closed')
        .eq('week_ending', currentWeek);

      if (error) throw error;

      if (data.length === 0) {
        return {
          avg_leads_contacted: 0,
          avg_appointments_set: 0,
          avg_deals_closed: 0,
        };
      }

      const totals = data.reduce(
        (acc, submission) => ({
          leads_contacted: acc.leads_contacted + submission.leads_contacted,
          appointments_set: acc.appointments_set + submission.appointments_set,
          deals_closed: acc.deals_closed + submission.deals_closed,
        }),
        { leads_contacted: 0, appointments_set: 0, deals_closed: 0 }
      );

      return {
        avg_leads_contacted: Math.round(totals.leads_contacted / data.length),
        avg_appointments_set: Math.round(totals.appointments_set / data.length),
        avg_deals_closed: Math.round(totals.deals_closed / data.length),
      } as TeamAverages;
    },
    enabled: !!user,
  });
};

export const useAgentCurrentWeekMetrics = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['agent-current-metrics', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const currentWeek = getLastSunday().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('leads_contacted, appointments_set, deals_closed')
        .eq('agent_id', user.id)
        .eq('week_ending', currentWeek)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
      
      return data || {
        leads_contacted: 0,
        appointments_set: 0,
        deals_closed: 0,
      };
    },
    enabled: !!user,
  });
};
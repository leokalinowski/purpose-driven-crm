import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { getCurrentWeekNumber } from '@/utils/po2Logic';

export interface CoachingSubmission {
  id: string;
  agent_id: string;
  week_number: number;
  year: number;
  leads_contacted: number;
  appointments_set: number;
  deals_closed: number;
  challenges?: string;
  tasks?: string;
  created_at: string;
  updated_at: string;
}

export interface CoachingFormData {
  week_number: number;
  year: number;
  leads_contacted: number;
  appointments_set: number;
  deals_closed: number;
  challenges?: string;
  tasks?: string;
}

export interface WeeklyMetrics {
  week_number: number;
  year: number;
  leads_contacted: number;
  appointments_set: number;
  deals_closed: number;
}

export interface TeamAverages {
  avg_leads_contacted: number;
  avg_appointments_set: number;
  avg_deals_closed: number;
}

export const useCoachingSubmissions = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['coaching-submissions', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('*')
        .eq('agent_id', user.id)
        .order('year', { ascending: false })
        .order('week_number', { ascending: false });

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

      // Check if submission already exists for this week
      const { data: existingSubmission } = await supabase
        .from('coaching_submissions')
        .select('id')
        .eq('agent_id', user.id)
        .eq('week_number', formData.week_number)
        .eq('year', formData.year)
        .single();

      if (existingSubmission) {
        // Update existing submission
        const { data, error } = await supabase
          .from('coaching_submissions')
          .update({
            leads_contacted: formData.leads_contacted,
            appointments_set: formData.appointments_set,
            deals_closed: formData.deals_closed,
            challenges: formData.challenges || null,
            tasks: formData.tasks || null,
          })
          .eq('id', existingSubmission.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new submission
        const { data, error } = await supabase
          .from('coaching_submissions')
          .insert({
            agent_id: user.id,
            week_number: formData.week_number,
            year: formData.year,
            leads_contacted: formData.leads_contacted,
            appointments_set: formData.appointments_set,
            deals_closed: formData.deals_closed,
            challenges: formData.challenges || null,
            tasks: formData.tasks || null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['personal-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['team-averages'] });
      queryClient.invalidateQueries({ queryKey: ['agent-current-metrics'] });
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
        .select('week_number, year, leads_contacted, appointments_set, deals_closed')
        .eq('agent_id', user.id)
        .order('year', { ascending: true })
        .order('week_number', { ascending: true });

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

      // Get the current week number and year
      const currentWeekNumber = getCurrentWeekNumber();
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('leads_contacted, appointments_set, deals_closed')
        .eq('week_number', currentWeekNumber)
        .eq('year', currentYear);

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

      // Get the current week number and year
      const currentWeekNumber = getCurrentWeekNumber();
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('leads_contacted, appointments_set, deals_closed')
        .eq('agent_id', user.id)
        .eq('week_number', currentWeekNumber)
        .eq('year', currentYear)
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
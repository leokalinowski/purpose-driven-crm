import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

export interface CoachingSubmission {
  id: string;
  agent_id: string;
  week_number: number;
  year: number;
  week?: string;
  database_size: number;
  dials_made: number;
  conversations: number;
  leads_contacted: number;
  appointments_set: number;
  appointments_held: number;
  agreements_signed: number;
  offers_made_accepted: number;
  deals_closed: number;
  closings: number;
  closing_amount: number;
  challenges?: string;
  tasks?: string;
  coaching_notes?: string;
  must_do_task?: string;
  created_at: string;
  updated_at: string;
}

export interface CoachingFormData {
  week_number: number;
  year: number;
  week?: string;
  dials_made: number;
  leads_contacted: number;
  appointments_set: number;
  appointments_held: number;
  agreements_signed: number;
  offers_made_accepted: number;
  closings: number;
  closing_amount: number;
  challenges?: string;
  tasks?: string;
  coaching_notes?: string;
  must_do_task?: string;
}

export interface WeeklyMetrics {
  week_number: number;
  year: number;
  database_size: number;
  dials_made: number;
  conversations: number;
  leads_contacted: number;
  appointments_set: number;
  appointments_held: number;
  agreements_signed: number;
  offers_made_accepted: number;
  deals_closed: number;
  closings: number;
  closing_amount: number;
}

export interface TeamAverages {
  avg_database_size: number;
  avg_dials_made: number;
  avg_conversations: number;
  avg_leads_contacted: number;
  avg_appointments_set: number;
  avg_appointments_held: number;
  avg_agreements_signed: number;
  avg_offers_made_accepted: number;
  avg_deals_closed: number;
  avg_closings: number;
  avg_closing_amount: number;
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

      // Fetch total contacts count for auto-populating database_size
      const { count: contactCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id);

      const database_size = contactCount || 0;

      // Check if submission already exists for this week
      const { data: existingSubmission } = await supabase
        .from('coaching_submissions')
        .select('id')
        .eq('agent_id', user.id)
        .eq('week_number', formData.week_number)
        .eq('year', formData.year)
        .maybeSingle();

      if (existingSubmission) {
        // Update existing submission
        const { data, error } = await supabase
          .from('coaching_submissions')
          .update({
            week: formData.week || null,
            database_size: database_size,
            dials_made: formData.dials_made || 0,
            conversations: 0,
            leads_contacted: formData.leads_contacted || 0,
            appointments_set: formData.appointments_set || 0,
            appointments_held: formData.appointments_held || 0,
            agreements_signed: formData.agreements_signed || 0,
            offers_made_accepted: formData.offers_made_accepted || 0,
            deals_closed: 0,
            closings: formData.closings || 0,
            closing_amount: formData.closing_amount || 0,
            challenges: formData.challenges || null,
            tasks: formData.tasks || null,
            coaching_notes: formData.coaching_notes || null,
            must_do_task: formData.must_do_task || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSubmission.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new submission
        // Calculate week ending date from week number for backward compatibility
        const startOfYear = new Date(formData.year, 0, 1);
        const weekStart = new Date(startOfYear.getTime() + (formData.week_number - 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        const { data, error } = await supabase
          .from('coaching_submissions')
          .insert({
            agent_id: user.id,
            week_number: formData.week_number,
            year: formData.year,
            week: formData.week || null,
            week_ending: weekEnd.toISOString().split('T')[0],
            database_size: database_size,
            dials_made: formData.dials_made || 0,
            conversations: 0,
            leads_contacted: formData.leads_contacted || 0,
            appointments_set: formData.appointments_set || 0,
            appointments_held: formData.appointments_held || 0,
            agreements_signed: formData.agreements_signed || 0,
            offers_made_accepted: formData.offers_made_accepted || 0,
            deals_closed: 0,
            closings: formData.closings || 0,
            closing_amount: formData.closing_amount || 0,
            challenges: formData.challenges || null,
            tasks: formData.tasks || null,
            coaching_notes: formData.coaching_notes || null,
            must_do_task: formData.must_do_task || null,
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
        .select('week_number, year, database_size, dials_made, conversations, leads_contacted, appointments_set, agreements_signed, offers_made_accepted, deals_closed, closings')
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
        .select('database_size, dials_made, conversations, leads_contacted, appointments_set, appointments_held, agreements_signed, offers_made_accepted, deals_closed, closings, closing_amount')
        .eq('week_number', currentWeekNumber)
        .eq('year', currentYear);

      if (error) throw error;

      if (data.length === 0) {
        return {
          avg_database_size: 0,
          avg_dials_made: 0,
          avg_conversations: 0,
          avg_leads_contacted: 0,
          avg_appointments_set: 0,
          avg_appointments_held: 0,
          avg_agreements_signed: 0,
          avg_offers_made_accepted: 0,
          avg_deals_closed: 0,
          avg_closings: 0,
          avg_closing_amount: 0,
        };
      }

      const totals = data.reduce(
        (acc, submission) => ({
          database_size: acc.database_size + (submission.database_size || 0),
          dials_made: acc.dials_made + (submission.dials_made || 0),
          conversations: acc.conversations + (submission.conversations || 0),
          leads_contacted: acc.leads_contacted + (submission.leads_contacted || 0),
          appointments_set: acc.appointments_set + (submission.appointments_set || 0),
          appointments_held: acc.appointments_held + (submission.appointments_held || 0),
          agreements_signed: acc.agreements_signed + (submission.agreements_signed || 0),
          offers_made_accepted: acc.offers_made_accepted + (submission.offers_made_accepted || 0),
          deals_closed: acc.deals_closed + (submission.deals_closed || 0),
          closings: acc.closings + (submission.closings || 0),
          closing_amount: acc.closing_amount + (submission.closing_amount || 0),
        }),
        { database_size: 0, dials_made: 0, conversations: 0, leads_contacted: 0, appointments_set: 0, appointments_held: 0, agreements_signed: 0, offers_made_accepted: 0, deals_closed: 0, closings: 0, closing_amount: 0 }
      );

      return {
        avg_database_size: Math.round(totals.database_size / data.length),
        avg_dials_made: Math.round(totals.dials_made / data.length),
        avg_conversations: Math.round(totals.conversations / data.length),
        avg_leads_contacted: Math.round(totals.leads_contacted / data.length),
        avg_appointments_set: Math.round(totals.appointments_set / data.length),
        avg_appointments_held: Math.round(totals.appointments_held / data.length),
        avg_agreements_signed: Math.round(totals.agreements_signed / data.length),
        avg_offers_made_accepted: Math.round(totals.offers_made_accepted / data.length),
        avg_deals_closed: Math.round(totals.deals_closed / data.length),
        avg_closings: Math.round(totals.closings / data.length),
        avg_closing_amount: Math.round(totals.closing_amount / data.length),
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
        .select('database_size, dials_made, conversations, leads_contacted, appointments_set, appointments_held, agreements_signed, offers_made_accepted, deals_closed, closings, closing_amount')
        .eq('agent_id', user.id)
        .eq('week_number', currentWeekNumber)
        .eq('year', currentYear)
        .maybeSingle();

      if (error) throw error;
      
      return data || {
        database_size: 0,
        dials_made: 0,
        conversations: 0,
        leads_contacted: 0,
        appointments_set: 0,
        appointments_held: 0,
        agreements_signed: 0,
        offers_made_accepted: 0,
        deals_closed: 0,
        closings: 0,
        closing_amount: 0,
      };
    },
    enabled: !!user,
  });
};
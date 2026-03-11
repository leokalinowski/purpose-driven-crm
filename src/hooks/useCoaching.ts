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

// New SphereSync form data — agent-facing check-in
export interface WeeklyCheckInData {
  week_number: number;
  year: number;
  conversations: number;
  activation_attempts: number;
  appointments_set: number;
  contacts_added: number;
  contacts_removed: number;
  activation_day_completed: boolean;
}

// Admin form data — keeps all fields
export interface CoachingFormData {
  week_number: number;
  year: number;
  week?: string;
  conversations: number;
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

// Submit Weekly Check-In (agent-facing, SphereSync vocabulary)
export const useSubmitWeeklyCheckIn = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: WeeklyCheckInData) => {
      if (!user) throw new Error('User not authenticated');

      // Fetch total contacts count for auto-populating database_size
      const { count: contactCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id);

      const database_size = contactCount || 0;

      // Map SphereSync fields to DB columns
      const dbData = {
        agent_id: user.id,
        week_number: formData.week_number,
        year: formData.year,
        database_size,
        conversations: formData.conversations || 0,
        dials_made: formData.activation_attempts || 0,        // activation_attempts → dials_made
        appointments_set: formData.appointments_set || 0,
        leads_contacted: formData.contacts_added || 0,         // contacts_added → leads_contacted
        deals_closed: formData.contacts_removed || 0,          // contacts_removed → deals_closed
        agreements_signed: formData.activation_day_completed ? 1 : 0, // boolean → 0/1
        updated_at: new Date().toISOString(),
      };

      // Check if submission already exists for this week
      const { data: existingSubmission } = await supabase
        .from('coaching_submissions')
        .select('id')
        .eq('agent_id', user.id)
        .eq('week_number', formData.week_number)
        .eq('year', formData.year)
        .maybeSingle();

      if (existingSubmission) {
        const { data, error } = await supabase
          .from('coaching_submissions')
          .update(dbData)
          .eq('id', existingSubmission.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Calculate week ending date
        const startOfYear = new Date(formData.year, 0, 1);
        const weekStart = new Date(startOfYear.getTime() + (formData.week_number - 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        const { data, error } = await supabase
          .from('coaching_submissions')
          .insert({
            ...dbData,
            week_ending: weekEnd.toISOString().split('T')[0],
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
      queryClient.invalidateQueries({ queryKey: ['week-submission'] });
      toast({
        title: "Check-in submitted!",
        description: "Your weekly numbers have been recorded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to submit: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

// Legacy submit (kept for admin form compatibility)
export const useSubmitCoachingForm = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: CoachingFormData) => {
      if (!user) throw new Error('User not authenticated');

      const { count: contactCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id);

      const database_size = contactCount || 0;

      const { data: existingSubmission } = await supabase
        .from('coaching_submissions')
        .select('id')
        .eq('agent_id', user.id)
        .eq('week_number', formData.week_number)
        .eq('year', formData.year)
        .maybeSingle();

      const submissionPayload = {
        week: formData.week || null,
        database_size,
        dials_made: formData.dials_made || 0,
        conversations: formData.conversations || 0,
        leads_contacted: formData.leads_contacted || 0,
        appointments_set: formData.appointments_set || 0,
        appointments_held: formData.appointments_held || 0,
        agreements_signed: formData.agreements_signed || 0,
        offers_made_accepted: formData.offers_made_accepted || 0,
        deals_closed: formData.leads_contacted || 0, // preserve contacts_removed mapping
        closings: formData.closings || 0,
        closing_amount: formData.closing_amount || 0,
        challenges: formData.challenges || null,
        tasks: formData.tasks || null,
        coaching_notes: formData.coaching_notes || null,
        must_do_task: formData.must_do_task || null,
        updated_at: new Date().toISOString(),
      };

      if (existingSubmission) {
        const { data, error } = await supabase
          .from('coaching_submissions')
          .update(submissionPayload)
          .eq('id', existingSubmission.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const startOfYear = new Date(formData.year, 0, 1);
        const weekStart = new Date(startOfYear.getTime() + (formData.week_number - 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        const { data, error } = await supabase
          .from('coaching_submissions')
          .insert({
            agent_id: user.id,
            week_number: formData.week_number,
            year: formData.year,
            week_ending: weekEnd.toISOString().split('T')[0],
            ...submissionPayload,
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
          avg_database_size: 0, avg_dials_made: 0, avg_conversations: 0, avg_leads_contacted: 0,
          avg_appointments_set: 0, avg_appointments_held: 0, avg_agreements_signed: 0,
          avg_offers_made_accepted: 0, avg_deals_closed: 0, avg_closings: 0, avg_closing_amount: 0,
        };
      }

      const totals = data.reduce(
        (acc, s) => ({
          database_size: acc.database_size + (s.database_size || 0),
          dials_made: acc.dials_made + (s.dials_made || 0),
          conversations: acc.conversations + (s.conversations || 0),
          leads_contacted: acc.leads_contacted + (s.leads_contacted || 0),
          appointments_set: acc.appointments_set + (s.appointments_set || 0),
          appointments_held: acc.appointments_held + (s.appointments_held || 0),
          agreements_signed: acc.agreements_signed + (s.agreements_signed || 0),
          offers_made_accepted: acc.offers_made_accepted + (s.offers_made_accepted || 0),
          deals_closed: acc.deals_closed + (s.deals_closed || 0),
          closings: acc.closings + (s.closings || 0),
          closing_amount: acc.closing_amount + (s.closing_amount || 0),
        }),
        { database_size: 0, dials_made: 0, conversations: 0, leads_contacted: 0, appointments_set: 0, appointments_held: 0, agreements_signed: 0, offers_made_accepted: 0, deals_closed: 0, closings: 0, closing_amount: 0 }
      );

      const n = data.length;
      return {
        avg_database_size: Math.round(totals.database_size / n),
        avg_dials_made: Math.round(totals.dials_made / n),
        avg_conversations: Math.round(totals.conversations / n),
        avg_leads_contacted: Math.round(totals.leads_contacted / n),
        avg_appointments_set: Math.round(totals.appointments_set / n),
        avg_appointments_held: Math.round(totals.appointments_held / n),
        avg_agreements_signed: Math.round(totals.agreements_signed / n),
        avg_offers_made_accepted: Math.round(totals.offers_made_accepted / n),
        avg_deals_closed: Math.round(totals.deals_closed / n),
        avg_closings: Math.round(totals.closings / n),
        avg_closing_amount: Math.round(totals.closing_amount / n),
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

      const currentWeekNumber = getCurrentWeekNumber();
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('*')
        .eq('agent_id', user.id)
        .eq('week_number', currentWeekNumber)
        .eq('year', currentYear)
        .maybeSingle();

      if (error) throw error;
      return data as CoachingSubmission | null;
    },
    enabled: !!user,
  });
};

export const useWeekSubmission = (weekNumber: number, year: number) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['week-submission', user?.id, weekNumber, year],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('*')
        .eq('agent_id', user.id)
        .eq('week_number', weekNumber)
        .eq('year', year)
        .maybeSingle();

      if (error) throw error;
      return data as CoachingSubmission | null;
    },
    enabled: !!user && !!weekNumber && !!year,
  });
};

// Weekly streak: count consecutive weeks with submissions (reverse chronological)
export const useWeeklyStreak = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['weekly-streak', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('week_number, year')
        .eq('agent_id', user.id)
        .order('year', { ascending: false })
        .order('week_number', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return 0;

      let streak = 0;
      let expectedWeek = getCurrentWeekNumber();
      let expectedYear = new Date().getFullYear();

      // Check if current week has submission; if not, start from previous week
      const hasCurrentWeek = data.some(d => d.week_number === expectedWeek && d.year === expectedYear);
      if (!hasCurrentWeek) {
        expectedWeek--;
        if (expectedWeek <= 0) {
          expectedWeek = 52;
          expectedYear--;
        }
      }

      for (const entry of data) {
        if (entry.week_number === expectedWeek && entry.year === expectedYear) {
          streak++;
          expectedWeek--;
          if (expectedWeek <= 0) {
            expectedWeek = 52;
            expectedYear--;
          }
        } else if (
          (entry.year < expectedYear) || 
          (entry.year === expectedYear && entry.week_number < expectedWeek)
        ) {
          break;
        }
      }

      return streak;
    },
    enabled: !!user,
  });
};

// Last 4 weeks of submissions for trend display
export const useLast4Weeks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['last-4-weeks', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('week_number, year, conversations, dials_made, appointments_set, leads_contacted, deals_closed')
        .eq('agent_id', user.id)
        .order('year', { ascending: false })
        .order('week_number', { ascending: false })
        .limit(4);

      if (error) throw error;
      return (data || []).reverse(); // oldest first
    },
    enabled: !!user,
  });
};

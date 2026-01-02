import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { toast } from 'sonner';
import type { CoachingSubmission, CoachingFormData } from './useCoaching';

export interface CoachingSubmissionWithAgent extends CoachingSubmission {
  agent_name: string;
  agent_email: string | null;
}

export const useAllCoachingSubmissions = () => {
  const { isAdmin } = useUserRole();

  return useQuery({
    queryKey: ['all-coaching-submissions'],
    queryFn: async () => {
      // Fetch all coaching submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from('coaching_submissions')
        .select('*')
        .order('year', { ascending: false })
        .order('week_number', { ascending: false });

      if (submissionsError) throw submissionsError;

      // Fetch profiles separately to get agent names
      const agentIds = [...new Set(submissions?.map(s => s.agent_id) || [])];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', agentIds);

      if (profilesError) throw profilesError;

      // Create lookup map for profiles
      const profilesMap: Record<string, { name: string; email: string | null }> = {};
      profiles?.forEach(p => {
        profilesMap[p.user_id] = {
          name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown Agent',
          email: p.email
        };
      });

      // Merge submissions with agent info
      const enrichedSubmissions: CoachingSubmissionWithAgent[] = (submissions || []).map(s => ({
        ...s,
        agent_name: profilesMap[s.agent_id]?.name || 'Unknown Agent',
        agent_email: profilesMap[s.agent_id]?.email || null
      }));

      return enrichedSubmissions;
    },
    enabled: isAdmin,
  });
};

export const useAgentsList = () => {
  const { isAdmin } = useUserRole();

  return useQuery({
    queryKey: ['coaching-agents-list'],
    queryFn: async () => {
      // Fetch agents from user_roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['agent', 'admin']);

      if (rolesError) throw rolesError;

      const userIds = roles?.map(r => r.user_id) || [];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      return profiles?.map(p => ({
        id: p.user_id,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown',
        email: p.email
      })) || [];
    },
    enabled: isAdmin,
  });
};

// Fetch a specific agent's submission for a given week/year
export const useAdminWeekSubmission = (agentId: string, weekNumber: number, year: number) => {
  return useQuery({
    queryKey: ['admin-week-submission', agentId, weekNumber, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaching_submissions')
        .select('*')
        .eq('agent_id', agentId)
        .eq('week_number', weekNumber)
        .eq('year', year)
        .maybeSingle();

      if (error) throw error;
      return data as CoachingSubmission | null;
    },
    enabled: !!agentId && !!weekNumber && !!year,
  });
};

// Submit coaching form data on behalf of an agent
export const useAdminSubmitCoachingForm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, formData }: { agentId: string; formData: CoachingFormData }) => {
      // Get the agent's contact count for database_size
      const { count: contactCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId);

      // Calculate week ending date (Saturday of that week)
      const getWeekEndingDate = (weekNum: number, year: number) => {
        const jan1 = new Date(year, 0, 1);
        const daysToSaturday = (6 - jan1.getDay() + 7) % 7;
        const firstSaturday = new Date(year, 0, 1 + daysToSaturday);
        const weekEnding = new Date(firstSaturday);
        weekEnding.setDate(firstSaturday.getDate() + (weekNum - 1) * 7);
        return weekEnding.toISOString().split('T')[0];
      };

      const weekEnding = getWeekEndingDate(formData.week_number, formData.year);

      // Check if submission exists
      const { data: existing } = await supabase
        .from('coaching_submissions')
        .select('id')
        .eq('agent_id', agentId)
        .eq('week_number', formData.week_number)
        .eq('year', formData.year)
        .maybeSingle();

      const submissionData = {
        agent_id: agentId,
        week_number: formData.week_number,
        year: formData.year,
        week_ending: weekEnding,
        dials_made: formData.dials_made,
        leads_contacted: formData.leads_contacted,
        appointments_set: formData.appointments_set,
        appointments_held: formData.appointments_held,
        agreements_signed: formData.agreements_signed,
        offers_made_accepted: formData.offers_made_accepted,
        closings: formData.closings,
        closing_amount: formData.closing_amount,
        challenges: formData.challenges,
        tasks: formData.tasks,
        coaching_notes: formData.coaching_notes,
        must_do_task: formData.must_do_task,
        database_size: contactCount || 0,
        deals_closed: formData.closings || 0,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('coaching_submissions')
          .update(submissionData)
          .eq('id', existing.id);

        if (error) throw error;
        return { updated: true };
      } else {
        const { error } = await supabase
          .from('coaching_submissions')
          .insert(submissionData);

        if (error) throw error;
        return { updated: false };
      }
    },
    onSuccess: (result) => {
      toast.success(result.updated ? 'Submission updated successfully' : 'Submission created successfully');
      queryClient.invalidateQueries({ queryKey: ['all-coaching-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-week-submission'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });
};

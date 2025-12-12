import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import type { CoachingSubmission } from './useCoaching';

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

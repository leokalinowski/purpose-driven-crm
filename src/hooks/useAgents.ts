import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Agent {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
}

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[useAgents] Starting agent fetch...');
      
      // Step 1: Fetch user_roles for agents and admins
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['agent', 'admin']);
      
      console.log('[useAgents] Step 1 - Roles fetched:', { 
        count: roles?.length || 0, 
        error: rolesError?.message,
        roles: roles 
      });
      
      if (rolesError) {
        throw rolesError;
      }

      const userIds = Array.from(new Set((roles || []).map(r => r.user_id)));
      
      console.log('[useAgents] Unique user IDs:', userIds.length);
      
      if (userIds.length === 0) {
        console.warn('[useAgents] No user_roles found for agents/admins');
        setAgents([]);
        setLoading(false);
        return;
      }

      // Step 2: Fetch profiles for those user_ids
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);
      
      console.log('[useAgents] Step 2 - Profiles fetched:', { 
        count: profiles?.length || 0, 
        error: profilesError?.message,
        profiles: profiles 
      });
      
      if (profilesError) {
        throw profilesError;
      }

      // Step 3: Merge data and choose highest-priority role per user (admin > agent)
      const roleByUser: Record<string, string> = {};
      for (const r of roles || []) {
        if (!roleByUser[r.user_id] || r.role === 'admin') {
          roleByUser[r.user_id] = r.role;
        }
      }

      const merged = (profiles || []).map(p => ({
        id: p.user_id,
        user_id: p.user_id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        role: roleByUser[p.user_id] || 'agent',
      }));

      // Sort by first name, then last name
      merged.sort((a, b) =>
        (a.first_name || '').localeCompare(b.first_name || '') ||
        (a.last_name || '').localeCompare(b.last_name || '')
      );

      console.log('[useAgents] Step 3 - Merged agents:', merged.length);
      setAgents(merged as Agent[]);
    } catch (error: any) {
      console.error('[useAgents] Error fetching agents:', error);
      setError(error.message || 'Failed to fetch agents');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch agents when explicitly called, not on mount
  // useEffect(() => {
  //   fetchAgents();
  // }, [fetchAgents]);

  const getAgentDisplayName = useCallback((agent: Agent) => {
    if (!agent) return 'Unknown Agent';
    if (agent.first_name || agent.last_name) {
      return `${agent.first_name || ''} ${agent.last_name || ''}`.trim();
    }
    return agent.email || 'Unknown Agent';
  }, []);

  const memoizedAgents = useMemo(() => agents, [agents]);

  return {
    agents: memoizedAgents,
    loading,
    error,
    fetchAgents,
    getAgentDisplayName,
  };
};
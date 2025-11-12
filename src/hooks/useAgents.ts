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
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id, 
          first_name, 
          last_name, 
          email,
          user_roles!inner(role)
        `)
        .in('user_roles.role', ['agent', 'admin'])
        .order('first_name', { ascending: true });

      if (error) {
        throw error;
      }
      
      // Add the id field as user_id for compatibility with Agent interface
      const agentsWithId = (data || []).map((agent: any) => ({
        ...agent,
        id: agent.user_id,
        role: agent.user_roles.role
      }));
      
      setAgents(agentsWithId as Agent[]);
    } catch (error: any) {
      console.error('Error fetching agents:', error);
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
import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching agents...');
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, role')
        .neq('role', 'admin')
        .order('first_name', { ascending: true });

      if (error) {
        console.error('❌ Error fetching agents:', error);
        throw error;
      }

      console.log('✅ Agents fetched:', data);
      
      // Add the id field as user_id for compatibility with Agent interface
      const agentsWithId = (data || []).map(agent => ({
        ...agent,
        id: agent.user_id
      }));
      
      setAgents(agentsWithId as Agent[]);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const getAgentDisplayName = (agent: Agent) => {
    if (agent.first_name || agent.last_name) {
      return `${agent.first_name || ''} ${agent.last_name || ''}`.trim();
    }
    return agent.email || 'Unknown Agent';
  };

  return {
    agents,
    loading,
    fetchAgents,
    getAgentDisplayName,
  };
};
import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

interface Agent {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface AgentSelectorProps {
  selectedAgentId: string | null;
  onAgentSelect: (agentId: string | null) => void;
}

export function AgentSelector({ selectedAgentId, onAgentSelect }: AgentSelectorProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const fetchAgents = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .eq('role', 'agent')
          .order('first_name');

        if (error) throw error;
        setAgents(data || []);
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [user, isAdmin]);

  if (loading) {
    return (
      <div className="w-64 h-10 bg-muted animate-pulse rounded-md" />
    );
  }

  const getAgentDisplayName = (agent: Agent) => {
    const name = `${agent.first_name || ''} ${agent.last_name || ''}`.trim();
    return name || agent.email || 'Unknown Agent';
  };

  return (
    <Select value={selectedAgentId || 'all'} onValueChange={(value) => onAgentSelect(value === 'all' ? null : value)}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select an agent to analyze" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Agents</SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.user_id} value={agent.user_id}>
            {getAgentDisplayName(agent)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAgents } from '@/hooks/useAgents';

interface AgentSelectorProps {
  selectedAgentId: string | null;
  onAgentSelect: (agentId: string | null) => void;
}

export function AgentSelector({ selectedAgentId, onAgentSelect }: AgentSelectorProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { agents, loading, fetchAgents, getAgentDisplayName } = useAgents();

  useEffect(() => {
    if (user && isAdmin) {
      fetchAgents();
    }
  }, [user, isAdmin, fetchAgents]);

  if (loading) {
    return (
      <div className="w-64 h-10 bg-muted animate-pulse rounded-md" />
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No profiles available. <a href="/admin/invitations" className="text-primary hover:underline">Invite team members</a>
      </div>
    );
  }

  return (
    <Select value={selectedAgentId || 'all'} onValueChange={(value) => {
      console.info('Agent selected:', value);
      onAgentSelect(value === 'all' ? null : value);
    }}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select a person" />
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
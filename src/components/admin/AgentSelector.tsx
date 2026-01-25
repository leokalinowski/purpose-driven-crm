import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgents } from '@/hooks/useAgents';

interface AgentSelectorProps {
  selectedAgentId: string | null;
  onAgentSelect: (agentId: string | null) => void;
  includeAllOption?: boolean;
  canManageAgents?: boolean;
}

export function AgentSelector({
  selectedAgentId,
  onAgentSelect,
  includeAllOption = true,
  canManageAgents = false,
}: AgentSelectorProps) {
  const { agents, loading, fetchAgents, getAgentDisplayName } = useAgents();

  useEffect(() => {
    if (canManageAgents) {
      fetchAgents();
    }
  }, [canManageAgents, fetchAgents]);

  if (loading) {
    return (
      <div className="w-64 h-10 bg-muted animate-pulse rounded-md" />
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No profiles available.
      </div>
    );
  }

  return (
    <Select value={selectedAgentId || (includeAllOption ? 'all' : '')} onValueChange={(value) => {
      console.info('Agent selected:', value);
      if (includeAllOption) {
        onAgentSelect(value === 'all' ? null : value);
        return;
      }
      onAgentSelect(value || null);
    }}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select a person" />
      </SelectTrigger>
      <SelectContent>
        {includeAllOption && <SelectItem value="all">All Agents</SelectItem>}
        {agents.map((agent) => (
          <SelectItem key={agent.user_id} value={agent.user_id}>
            {getAgentDisplayName(agent)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

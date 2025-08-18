import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';
import { formatDistanceToNow } from 'date-fns';

export function AgentPerformanceTable() {
  const { data, loading } = useAdminMetrics();

  if (loading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 w-full rounded bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPerformanceBadge = (rate: number) => {
    if (rate >= 80) return { variant: 'default' as const, label: 'Excellent' };
    if (rate >= 60) return { variant: 'secondary' as const, label: 'Good' };
    if (rate >= 40) return { variant: 'outline' as const, label: 'Average' };
    return { variant: 'destructive' as const, label: 'Needs Improvement' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Performance Comparison</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare all agents by key performance metrics
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Completion Rate</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">GCI</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead className="text-right">Coaching</TableHead>
                <TableHead>Member Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.agentPerformance.map((agent) => {
                const badge = getPerformanceBadge(agent.completion_rate);
                return (
                  <TableRow key={agent.agent_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{agent.agent_name}</div>
                        <div className="text-sm text-muted-foreground">{agent.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <div className="font-medium">{agent.total_contacts}</div>
                        <div className="text-sm text-muted-foreground">
                          +{agent.contacts_this_month} this month
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <div className="font-medium">
                          {agent.completed_tasks}/{agent.total_tasks}
                        </div>
                        <div className="text-sm text-muted-foreground">completed</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={badge.variant}>
                        {Math.round(agent.completion_rate)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <div className="font-medium">{agent.total_transactions}</div>
                        <div className="text-sm text-muted-foreground">
                          {agent.active_transactions} active
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Math.round(agent.total_gci).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <div className="font-medium">{agent.total_events}</div>
                        <div className="text-sm text-muted-foreground">
                          {agent.upcoming_events} upcoming
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{agent.coaching_sessions}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(agent.agent_since), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, AlertTriangle, Calendar, ArrowRight, Mail } from 'lucide-react';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';

export function TeamManagementWidget() {
  const { data } = useAdminMetrics();

  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-32 rounded bg-muted animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-20 rounded bg-muted animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Top performing agents
  const topPerformers = data.agentPerformance
    .filter(agent => agent.completion_rate > 0)
    .sort((a, b) => b.completion_rate - a.completion_rate)
    .slice(0, 3);

  // Agents needing coaching (low performance)
  const needsCoaching = data.agentPerformance
    .filter(agent => agent.completion_rate < 50 && agent.total_tasks > 0)
    .sort((a, b) => a.completion_rate - b.completion_rate)
    .slice(0, 3);

  // High-value transactions
  const topTransactions = data.agentPerformance
    .filter(agent => agent.total_gci > 0)
    .sort((a, b) => b.total_gci - a.total_gci)
    .slice(0, 3);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Top Performers
          </CardTitle>
          <CardDescription>Highest task completion rates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topPerformers.length > 0 ? (
            <>
              {topPerformers.map((agent, index) => (
                <div key={agent.agent_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-medium">{agent.agent_name}</span>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    {Math.round(agent.completion_rate)}%
                  </Badge>
                </div>
              ))}
              <Link to="/coaching">
                <Button variant="outline" size="sm" className="w-full">
                  View All Performance <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No performance data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Needs Coaching */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Needs Attention
          </CardTitle>
          <CardDescription>Agents requiring coaching support</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {needsCoaching.length > 0 ? (
            <>
              {needsCoaching.map((agent) => (
                <div key={agent.agent_id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{agent.agent_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.completed_tasks}/{agent.total_tasks} tasks completed
                    </p>
                  </div>
                  <Badge variant="destructive">
                    {Math.round(agent.completion_rate)}%
                  </Badge>
                </div>
              ))}
              <Link to="/admin/invitations">
                <Button variant="outline" size="sm" className="w-full">
                  Schedule Coaching <Calendar className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">All agents performing well</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Leaders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Revenue Leaders
          </CardTitle>
          <CardDescription>Top GCI producers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topTransactions.length > 0 ? (
            <>
              {topTransactions.map((agent, index) => (
                <div key={agent.agent_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-medium">{agent.agent_name}</span>
                  </div>
                  <Badge variant="outline">
                    ${Math.round(agent.total_gci).toLocaleString()}
                  </Badge>
                </div>
              ))}
              <Link to="/transactions">
                <Button variant="outline" size="sm" className="w-full">
                  View All Transactions <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No transaction data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
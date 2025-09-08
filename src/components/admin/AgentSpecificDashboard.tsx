import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSpecificAgentMetrics } from '@/hooks/useSpecificAgentMetrics';
import { TrendingUp, TrendingDown, Minus, Calendar, DollarSign, Users, CheckCircle, Target, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AgentSpecificDashboardProps {
  selectedAgentId: string | null;
}

export function AgentSpecificDashboard({ selectedAgentId }: AgentSpecificDashboardProps) {
  const { data, loading } = useSpecificAgentMetrics(selectedAgentId);

  if (!selectedAgentId) {
    return (
      <Card className="h-64">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Select an agent to view their performance metrics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="h-64">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <p>Failed to load agent data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral' | undefined) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const KPI_ICONS = {
    totalContacts: Users,
    taskCompletionRate: CheckCircle,
    activeTransactions: Target,
    totalGCI: DollarSign,
    upcomingEvents: Calendar,
    coachingSessions: MessageSquare
  };

  return (
    <div className="space-y-6">
      {/* Agent Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{data.agent.name}</CardTitle>
              <p className="text-muted-foreground">{data.agent.email}</p>
            </div>
            <Badge variant="secondary">
              Member since {formatDistanceToNow(new Date(data.agent.since), { addSuffix: true })}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(data.kpis).map(([key, kpi]) => {
          const Icon = KPI_ICONS[key as keyof typeof KPI_ICONS];
          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {getTrendIcon(kpi.trend)}
                  <span className="ml-1">{kpi.subtext}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contacts Added</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.charts.contactsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tasks Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.charts.tasksTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--secondary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transactions Started</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.charts.transactionsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--accent))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.activities.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent transactions</p>
              ) : (
                data.activities.recentTransactions.map((transaction, index) => (
                  <div key={index} className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{transaction.client_name || 'Unnamed Client'}</p>
                      <p className="text-xs text-muted-foreground">{transaction.property_address}</p>
                      <Badge variant="outline" className="text-xs">
                        {transaction.transaction_stage}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${transaction.gci?.toLocaleString() || '0'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.activities.upcomingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending tasks</p>
              ) : (
                data.activities.upcomingTasks.map((task, index) => (
                  <div key={index} className="space-y-1">
                    <p className="text-sm font-medium">{task.task_type}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Coaching */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Coaching</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.activities.recentCoaching.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent coaching sessions</p>
              ) : (
                data.activities.recentCoaching.map((session, index) => (
                  <div key={index} className="space-y-1">
                    <p className="text-sm font-medium">
                      {formatDistanceToNow(new Date(session.session_date), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.duration_minutes} minutes
                    </p>
                    {session.topics_covered && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {session.topics_covered}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
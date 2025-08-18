import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';

export function AdminCharts() {
  const { data, loading } = useAdminMetrics();

  if (loading || !data) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full rounded bg-muted animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Format data for charts
  const monthlyTrends = data.businessTrends.map(metric => ({
    month: new Date(metric.period).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    contacts: metric.new_contacts,
    tasks: metric.tasks_completed,
    transactions: metric.new_transactions,
    revenue: Math.round(metric.monthly_gci / 1000), // Convert to thousands
    events: metric.events_held,
  }));

  // Agent comparison data for bar chart
  const agentComparison = data.agentPerformance.slice(0, 8).map(agent => ({
    name: agent.agent_name.split(' ')[0], // First name only for space
    completionRate: Math.round(agent.completion_rate),
    contacts: agent.total_contacts,
    gci: Math.round(agent.total_gci / 1000), // Convert to thousands
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Business Trends (12 Months)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Company-wide performance over time
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'revenue') return [`$${value}k`, 'Revenue (GCI)'];
                  const nameStr = String(name);
                  return [value, nameStr.charAt(0).toUpperCase() + nameStr.slice(1)];
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="contacts" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="New Contacts"
              />
              <Line 
                type="monotone" 
                dataKey="tasks" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                name="Tasks Completed"
              />
              <Line 
                type="monotone" 
                dataKey="transactions" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                name="New Transactions"
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                name="Revenue ($k)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Performance Comparison</CardTitle>
          <p className="text-sm text-muted-foreground">
            Top 8 agents by task completion rate
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agentComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'gci') return [`$${value}k`, 'GCI'];
                  if (name === 'completionRate') return [`${value}%`, 'Task Completion'];
                  const nameStr = String(name);
                  return [value, nameStr.charAt(0).toUpperCase() + nameStr.slice(1)];
                }}
              />
              <Legend />
              <Bar 
                dataKey="completionRate" 
                fill="hsl(var(--primary))" 
                name="Task Completion %"
              />
              <Bar 
                dataKey="contacts" 
                fill="hsl(var(--secondary))" 
                name="Total Contacts"
              />
              <Bar 
                dataKey="gci" 
                fill="hsl(var(--accent))" 
                name="GCI ($k)"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Bar, BarChart, Area, AreaChart } from 'recharts';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';
import { useNewsletterAnalytics } from '@/hooks/useNewsletterAnalytics';

export function CompanyAnalyticsCharts() {
  const { data: adminData } = useAdminMetrics();
  const { monthlySeries: newsletterData } = useNewsletterAnalytics();

  const chartConfig = {
    revenue: { label: 'Revenue' },
    tasks: { label: 'Tasks' },
    contacts: { label: 'Contacts' },
    events: { label: 'Events' },
    newsletter: { label: 'Newsletter' },
  } as const;

  // Prepare agent performance comparison data
  const agentComparisonData = adminData?.agentPerformance.map(agent => ({
    name: agent.agent_name.split(' ')[0], // First name only for chart readability
    completion: agent.completion_rate,
    contacts: agent.total_contacts,
    gci: agent.total_gci,
    transactions: agent.total_transactions,
  })) || [];

  // Newsletter performance over time
  const newsletterTrendData = newsletterData.map(month => ({
    month: month.month,
    openRate: month.open_rate || 0,
    recipients: Math.round(month.recipients / 100), // Scale down for chart readability
  }));

  // Company growth metrics (simulated monthly data)
  const companyGrowthData = [
    { month: 'Jan', contacts: 450, tasks: 120, events: 8, revenue: 85000 },
    { month: 'Feb', contacts: 478, tasks: 135, events: 6, revenue: 92000 },
    { month: 'Mar', contacts: 502, tasks: 142, events: 10, revenue: 98000 },
    { month: 'Apr', contacts: 531, tasks: 158, events: 7, revenue: 105000 },
    { month: 'May', contacts: 559, tasks: 163, events: 9, revenue: 112000 },
    { month: 'Jun', contacts: 587, tasks: 171, events: 11, revenue: 128000 },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
      {/* Agent Performance Comparison */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-1">
        <CardHeader>
          <CardTitle>Agent Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentComparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                  <ChartTooltip 
                    content={<ChartTooltipContent formatter={(value, name) => [
                      name === 'completion' ? `${value}%` : value, 
                      name === 'completion' ? 'Completion Rate' : 
                      name === 'contacts' ? 'Total Contacts' : 
                      name === 'gci' ? 'Total GCI' : 'Transactions'
                    ]} />} 
                  />
                  <Bar dataKey="completion" fill="var(--color-tasks, currentColor)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Newsletter Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Newsletter Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={newsletterTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="openRate" stroke="var(--color-newsletter, currentColor)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Company Growth Trend */}
      <Card className="col-span-1 md:col-span-2">
        <CardHeader>
          <CardTitle>Company Growth Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={companyGrowthData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="contacts"
                    stackId="1"
                    stroke="var(--color-contacts, currentColor)"
                    fill="var(--color-contacts, currentColor)"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="tasks"
                    stackId="1"
                    stroke="var(--color-tasks, currentColor)"
                    fill="var(--color-tasks, currentColor)"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
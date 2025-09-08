import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Bar, BarChart, PieChart, Pie, Cell } from 'recharts';
import { usePersonalMetrics } from '@/hooks/useCoaching';
import { useTransactions } from '@/hooks/useTransactions';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';

export function AgentPerformanceCharts() {
  const { data: personalMetrics } = usePersonalMetrics();
  const { transactions } = useTransactions();
  const { historicalStats } = useSphereSyncTasks();

  const chartConfig = {
    performance: { label: 'Performance' },
    gci: { label: 'GCI' },
    tasks: { label: 'Tasks' },
    calls: { label: 'Calls' },
  } as const;

  // Prepare GCI trend data from transactions
  const gciTrendData = transactions
    .filter(t => t.transaction_stage === 'closed' && t.closing_date)
    .reduce((acc, t) => {
      const date = new Date(t.closing_date!);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, gci: 0, count: 0 };
      }
      acc[monthKey].gci += t.gci || 0;
      acc[monthKey].count += 1;
      return acc;
    }, {} as Record<string, { month: string; gci: number; count: number }>);

  const gciChartData = Object.values(gciTrendData)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  // Prepare activity trend data
  const activityTrendData = personalMetrics?.slice(-6).map(metric => ({
    week: `W${metric.week_number}`,
    dials: metric.dials_made,
    conversations: metric.conversations,
    appointments: metric.appointments_set,
  })) || [];

  // Prepare SphereSync completion data
  const sphereSyncData = historicalStats.slice(-6).map(stat => ({
    week: `W${stat.week}`,
    completion: stat.completionRate,
    calls: stat.completedCalls,
    texts: stat.completedTexts,
  }));

  // Pipeline distribution
  const pipelineData = [
    { name: 'Under Contract', value: transactions.filter(t => t.transaction_stage === 'under_contract').length, color: '#4f46e5' },
    { name: 'Pending', value: transactions.filter(t => t.transaction_stage === 'pending').length, color: '#f59e0b' },
    { name: 'Closed', value: transactions.filter(t => t.transaction_stage === 'closed').length, color: '#10b981' },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {/* GCI Trend */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-1">
        <CardHeader>
          <CardTitle>Monthly GCI Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gciChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                  <ChartTooltip 
                    content={<ChartTooltipContent formatter={(value) => [`$${value.toLocaleString()}`, 'GCI']} />} 
                  />
                  <Line type="monotone" dataKey="gci" stroke="var(--color-gci, currentColor)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="dials" fill="var(--color-calls, currentColor)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="conversations" fill="var(--color-performance, currentColor)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* SphereSync Progress */}
      <Card>
        <CardHeader>
          <CardTitle>SphereSync Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sphereSyncData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <ChartTooltip 
                    content={<ChartTooltipContent formatter={(value) => [`${value}%`, 'Completion Rate']} />} 
                  />
                  <Line type="monotone" dataKey="completion" stroke="var(--color-tasks, currentColor)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Pipeline */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>Transaction Pipeline Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80 flex items-center justify-center">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pipelineData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
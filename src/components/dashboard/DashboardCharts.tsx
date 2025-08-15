import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';

export function DashboardCharts() {
  const { data } = useDashboardMetrics();
  if (!data) return null;

  const config = {
    leads: { label: 'Leads' },
    tasks: { label: 'Tasks' },
    tx: { label: 'Transactions' },
  } as const;

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Leads (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config}>
            <LineChart data={data.charts.leadsTrend} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="value" stroke="var(--color-leads, currentColor)" dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completed Tasks (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config}>
            <LineChart data={data.charts.tasksTrend} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="value" stroke="var(--color-tasks, currentColor)" dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config}>
            <LineChart data={data.charts.transactionsTrend} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="value" stroke="var(--color-tx, currentColor)" dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

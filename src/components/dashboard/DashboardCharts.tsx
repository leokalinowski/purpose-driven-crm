import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useDashboardData } from '@/hooks/useDashboardData';

export function DashboardCharts() {
  const { data, isAgent } = useDashboardData();
  
  if (!data || !isAgent || !('charts' in data)) {
    return null;
  }

  const agentData = data as any; // Type assertion since we checked isAgent and charts existence
  
  const config = {
    leads: { label: 'Leads' },
    tasks: { label: 'Tasks' },
    tx: { label: 'Transactions' },
  } as const;

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Leads (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="w-full h-80">
            <ChartContainer config={config} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={agentData.charts.leadsTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-leads, currentColor)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Completed Tasks (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="w-full h-80">
            <ChartContainer config={config} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={agentData.charts.tasksTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-tasks, currentColor)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Transactions (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="w-full h-80">
            <ChartContainer config={config} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={agentData.charts.transactionsTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-tx, currentColor)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

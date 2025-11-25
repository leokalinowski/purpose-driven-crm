import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Bar, BarChart, Area, AreaChart } from 'recharts';
import { usePersonalMetrics } from '@/hooks/useCoaching';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { useDNCStats } from '@/hooks/useDNCStats';

export function AgentPerformanceCharts() {
  const { data: personalMetrics } = usePersonalMetrics();
  const { historicalStats } = useSphereSyncTasks();
  const { stats: dncStats } = useDNCStats();

  const chartConfig = {
    performance: { label: 'Performance' },
    tasks: { label: 'Tasks' },
    completion: { label: 'Completion Rate' },
    calls: { label: 'Calls' },
    texts: { label: 'Texts' },
    activity: { label: 'Activity' },
  } as const;

  // Prepare activity trend data (conversion funnel)
  const activityTrendData = personalMetrics?.slice(-6).map(metric => ({
    week: `W${metric.week_number}`,
    dials: metric.dials_made || 0,
    conversations: metric.conversations || 0,
    appointments: metric.appointments_set || 0,
    conversion: metric.dials_made > 0 ? Math.round((metric.conversations / metric.dials_made) * 100) : 0,
  })) || [];

  // Prepare SphereSync completion data with task breakdown
  const sphereSyncData = historicalStats.slice(-6).map(stat => ({
    week: `W${stat.week}`,
    completion: stat.completionRate,
    calls: stat.completedCalls,
    texts: stat.completedTexts,
    totalTasks: stat.totalTasks,
  }));

  // Prepare weekly task performance data
  const weeklyTaskData = historicalStats.slice(-8).map(stat => ({
    week: `W${stat.week}`,
    tasksCompleted: stat.completedTasks,
    tasksTotal: stat.totalTasks,
    completionRate: stat.completionRate,
  }));

  // DNC compliance trend (mock data for now - would need historical DNC stats)
  const dncTrendData = [
    { week: 'W1', compliance: 85, checked: 120, dnc: 15 },
    { week: 'W2', compliance: 88, checked: 125, dnc: 18 },
    { week: 'W3', compliance: 82, checked: 118, dnc: 12 },
    { week: 'W4', compliance: 91, checked: 130, dnc: 20 },
    { week: 'W5', compliance: 89, checked: 128, dnc: 17 },
    { week: 'W6', compliance: 94, checked: 135, dnc: 22 },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {/* Conversion Funnel */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-2">
        <CardHeader>
          <CardTitle>Weekly Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="dials" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="conversations" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="appointments" stackId="3" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.9} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Task Completion Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Task Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTaskData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => [`${value}%`, 'Completion Rate']} />}
                  />
                  <Line type="monotone" dataKey="completionRate" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* SphereSync Task Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>SphereSync Task Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sphereSyncData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="calls" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="texts" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* DNC Compliance Trend */}
      <Card>
        <CardHeader>
          <CardTitle>DNC Compliance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dncTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => [`${value}%`, 'Compliance Rate']} />}
                  />
                  <Line type="monotone" dataKey="compliance" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Task Volume */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-2">
        <CardHeader>
          <CardTitle>Weekly Task Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyTaskData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="tasksCompleted" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="tasksTotal" fill="#e5e7eb" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { BlockFourPerformance } from '@/hooks/useDashboardBlocks';

interface Props {
  data: BlockFourPerformance;
}

export function TaskPerformance({ data }: Props) {
  const { currentWeekPct, completedThisWeek, totalThisWeek, trend, bySystem } = data;
  const { hasAccess } = useFeatureAccess();

  const filteredBySystem = bySystem.filter(s => {
    if (s.label === 'Events' && !hasAccess('/events')) return false;
    if (s.label === 'Social' && !hasAccess('/social-scheduler')) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Task Execution Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current week summary */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className={`text-4xl font-bold ${currentWeekPct >= 70 ? 'text-green-600' : currentWeekPct >= 40 ? 'text-yellow-600' : 'text-destructive'}`}>
              {currentWeekPct}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">This Week</p>
          </div>
          <div className="text-sm text-muted-foreground">
            {completedThisWeek} of {totalThisWeek} tasks completed
          </div>
          <div className="flex gap-2 ml-auto flex-wrap">
            {filteredBySystem.map(s => (
              <Badge key={s.label} variant="outline" className="text-xs">
                {s.label}: {s.completed}/{s.total}
              </Badge>
            ))}
          </div>
        </div>

        {/* Trend chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(value: number) => [`${value}%`, 'Completion']} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

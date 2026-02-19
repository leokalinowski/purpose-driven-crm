import { CheckCircle2, Clock, AlertTriangle, CalendarClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ClickUpTaskStats } from '@/hooks/useClickUpTasks';

interface EventProgressStatsProps {
  stats: ClickUpTaskStats;
}

export function EventProgressStats({ stats }: EventProgressStatsProps) {
  const items = [
    {
      label: 'Completed',
      value: `${stats.completed}/${stats.total}`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      label: 'In Progress',
      value: stats.total - stats.completed - stats.overdue,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Overdue',
      value: stats.overdue,
      icon: AlertTriangle,
      color: stats.overdue > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: stats.overdue > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/50',
    },
    {
      label: 'Due This Week',
      value: stats.dueSoon,
      icon: CalendarClock,
      color: stats.dueSoon > 0 ? 'text-amber-600' : 'text-muted-foreground',
      bgColor: stats.dueSoon > 0 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-muted/50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label} className={item.bgColor}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            </div>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

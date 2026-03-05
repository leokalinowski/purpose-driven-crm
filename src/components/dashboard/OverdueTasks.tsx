import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { BlockFiveOverdue } from '@/hooks/useDashboardBlocks';

interface Props {
  data: BlockFiveOverdue;
}

const systemLabels: Record<string, string> = {
  spheresync: 'SphereSync',
  events: 'Events',
  coaching: 'Scoreboard',
};

export function OverdueTasks({ data }: Props) {
  const navigate = useNavigate();

  if (data.tasks.length === 0) {
    return null; // Don't render if nothing overdue
  }

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Overdue Tasks
          <Badge variant="destructive" className="ml-2">{data.tasks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {data.tasks.slice(0, 10).map(task => (
            <li key={task.id} className="flex items-center justify-between p-2 rounded-md bg-background border border-destructive/20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {systemLabels[task.system] || task.system}
                  </Badge>
                  <span className="text-sm truncate">{task.title}</span>
                </div>
                <p className="text-xs text-destructive mt-0.5">
                  {task.daysOverdue} day{task.daysOverdue !== 1 ? 's' : ''} overdue
                </p>
              </div>
              {task.navigateTo && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs h-7"
                  onClick={() => navigate(task.navigateTo!)}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
          {data.tasks.length > 10 && (
            <li className="text-xs text-muted-foreground text-center">
              +{data.tasks.length - 10} more overdue tasks
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

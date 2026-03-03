import { differenceInDays, format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface EventHeroCardProps {
  title: string;
  eventDate: string;
  location?: string | null;
  progressPct: number;
}

export function EventHeroCard({ title, eventDate, location, progressPct }: EventHeroCardProps) {
  const date = new Date(eventDate);
  const today = new Date();
  const daysUntil = differenceInDays(date, today);
  const isPast = daysUntil < 0;

  const progressColor =
    progressPct >= 75 ? 'text-green-600' : progressPct >= 40 ? 'text-amber-600' : 'text-destructive';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(date, 'EEEE, MMMM d, yyyy')}
              </span>
              {location && <span>{location}</span>}
            </div>
          </div>
          <div className="text-right">
            {isPast ? (
              <span className="text-sm font-medium text-green-600">Event Complete</span>
            ) : daysUntil === 0 ? (
              <span className="text-lg font-bold text-primary">Today!</span>
            ) : (
              <div>
                <span className="text-3xl font-bold text-foreground">{daysUntil}</span>
                <span className="text-sm text-muted-foreground ml-1">days left</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className={`font-bold ${progressColor}`}>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-3" />
        </div>
      </CardContent>
    </Card>
  );
}

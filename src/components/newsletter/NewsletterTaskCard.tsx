import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle2, Clock, CalendarDays } from 'lucide-react';
import { useNewsletterTaskSettings } from '@/hooks/useNewsletterTaskSettings';
import { startOfWeek, endOfWeek } from 'date-fns';

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function NewsletterTaskCard({ hasCampaignThisWeek }: { hasCampaignThisWeek?: boolean }) {
  const { settings, loading } = useNewsletterTaskSettings();

  if (loading) return null;

  const now = new Date();
  const frequency = settings?.frequency || 'monthly';
  const dayOfMonth = settings?.day_of_month || 15;
  const enabled = settings?.enabled !== false;

  if (!enabled) return null;

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const currentWeekNum = getISOWeekNumber(now);

  let isDue = false;
  let nextDueLabel = '';

  if (frequency === 'weekly') {
    isDue = true;
    nextDueLabel = 'Due every week';
  } else if (frequency === 'biweekly') {
    isDue = currentWeekNum % 2 === 1;
    nextDueLabel = isDue ? 'Due this week (every 2 weeks)' : `Next due: W${currentWeekNum + 1}`;
  } else {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
    isDue = targetDate >= weekStart && targetDate <= weekEnd;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (isDue) {
      nextDueLabel = `Due ${monthNames[now.getMonth()]} ${dayOfMonth}`;
    } else if (now.getDate() > dayOfMonth) {
      const nextMonth = now.getMonth() + 1;
      nextDueLabel = `Next due: ${monthNames[nextMonth % 12]} ${dayOfMonth}`;
    } else {
      nextDueLabel = `Due ${monthNames[now.getMonth()]} ${dayOfMonth}`;
    }
  }

  const isComplete = hasCampaignThisWeek === true;

  return (
    <Card className={`border-l-4 ${isDue && !isComplete ? 'border-l-primary bg-primary/5' : isComplete ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' : 'border-l-muted'}`}>
      <CardContent className="flex items-center gap-4 py-4">
        <div className={`rounded-full p-2 ${isComplete ? 'bg-green-100 dark:bg-green-900' : isDue ? 'bg-primary/10' : 'bg-muted'}`}>
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <Mail className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">
              {isComplete ? 'Newsletter sent this period ✓' : 'Write & schedule your newsletter'}
            </span>
            {isDue && !isComplete && (
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 text-xs">
                Due Now
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <CalendarDays className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{nextDueLabel}</span>
            <span className="text-xs text-muted-foreground mx-1">·</span>
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground capitalize">{frequency}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

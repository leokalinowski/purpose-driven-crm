import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Calendar, Mail, Share, TrendingUp, CheckCircle2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { BlockTwoTasks } from '@/hooks/useDashboardBlocks';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface Props {
  data: BlockTwoTasks;
}

function SystemSection({ 
  title, icon: Icon, tasks, emptyLabel, navigateTo, badgeColor 
}: { 
  title: string; 
  icon: React.ElementType; 
  tasks: { id: string; title: string; subtitle?: string; dueDate?: string; status?: string }[];
  emptyLabel: string;
  navigateTo: string;
  badgeColor?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(tasks.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{title}</span>
          <Badge variant={tasks.length > 0 ? 'default' : 'secondary'} className="text-xs">
            {tasks.length}
          </Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground pl-9 pb-2">{emptyLabel}</p>
        ) : (
          <ul className="space-y-1.5 pl-9 pb-2">
            {tasks.slice(0, 5).map(task => (
              <li key={task.id} className="flex items-center justify-between text-sm">
                <div className="flex-1 min-w-0">
                  <span className="truncate block">{task.title}</span>
                  {task.subtitle && <span className="text-xs text-muted-foreground">{task.subtitle}</span>}
                </div>
                {task.dueDate && (
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </li>
            ))}
            {tasks.length > 5 && (
              <li className="text-xs text-muted-foreground">+{tasks.length - 5} more</li>
            )}
          </ul>
        )}
        <Button variant="ghost" size="sm" className="ml-9 text-xs h-7" onClick={() => navigate(navigateTo)}>
          View All <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function WeeklyTasksBySystem({ data }: Props) {
  const { hasAccess } = useFeatureAccess();
  const navigate = useNavigate();
  const totalTasks = data.spheresync.length + data.events.length + data.newsletter.length + data.social.length + (data.scoreboard.submitted ? 0 : 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Tasks This Week
          <Badge variant="outline" className="ml-auto">{totalTasks} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <SystemSection
          title="SphereSync"
          icon={Phone}
          tasks={data.spheresync}
          emptyLabel="All calls & texts done! 🎉"
          navigateTo="/spheresync-tasks"
        />

        {hasAccess('/events') && (
          <SystemSection
            title="Events"
            icon={Calendar}
            tasks={data.events}
            emptyLabel="No event tasks this week"
            navigateTo="/events"
          />
        )}

        <SystemSection
          title="Newsletter"
          icon={Mail}
          tasks={data.newsletter}
          emptyLabel="No newsletter tasks this week"
          navigateTo="/newsletter"
        />

        {hasAccess('/social-scheduler') && (
          <SystemSection
            title="Social Media"
            icon={Share}
            tasks={data.social}
            emptyLabel="No social posts scheduled"
            navigateTo="/social-scheduler"
          />
        )}

        {/* Scoreboard */}
        <div className="flex items-center justify-between py-2 px-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Scoreboard</span>
            {data.scoreboard.submitted ? (
              <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">Done</Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">Missing</Badge>
            )}
          </div>
          {!data.scoreboard.submitted && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate('/coaching')}>
              Submit Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

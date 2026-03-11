import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Target, ExternalLink, ChevronDown, ChevronUp, Sparkles, CheckCircle2, AlertTriangle, Phone, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { BlockFiveOverdue, OverdueTask } from '@/hooks/useDashboardBlocks';

interface Props {
  data: BlockFiveOverdue;
}

const systemLabels: Record<string, string> = {
  spheresync: 'SphereSync',
  events: 'Events',
  coaching: 'Scoreboard',
};

function getScoreColor(score: number) {
  if (score >= 80) return { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', ring: 'text-emerald-500', track: 'text-emerald-500/20' };
  if (score >= 50) return { border: 'border-amber-500/30', bg: 'bg-amber-500/5', ring: 'text-amber-500', track: 'text-amber-500/20' };
  return { border: 'border-destructive/30', bg: 'bg-destructive/5', ring: 'text-destructive', track: 'text-destructive/20' };
}

function getNudgeText(score: number, overdueCount: number) {
  if (score >= 95) return "All caught up — your consistency is paying off!";
  if (score >= 80 && overdueCount === 0) return "Great momentum this week. Keep showing up for your sphere.";
  if (score >= 80) return `You're close — knock out these ${overdueCount} task${overdueCount !== 1 ? 's' : ''} to stay on track.`;
  if (score >= 50) return `You have ${overdueCount} people waiting to hear from you. A quick call today can make the difference.`;
  return "Your sphere needs you — start with just one call to build momentum.";
}

function ScoreGauge({ score }: { score: number }) {
  const colors = getScoreColor(score);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" strokeWidth="8" className={colors.track} stroke="currentColor" />
        <circle
          cx="60" cy="60" r="54" fill="none" strokeWidth="8"
          className={colors.ring}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${colors.ring}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

type WeekGroup = {
  weekNumber: number;
  system: string;
  tasks: OverdueTask[];
};

function groupByWeek(tasks: OverdueTask[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  tasks.forEach(t => {
    const wk = t.weekNumber || 0;
    const key = `${t.system}-${wk}`;
    if (!map.has(key)) {
      map.set(key, { weekNumber: wk, system: t.system, tasks: [] });
    }
    map.get(key)!.tasks.push(t);
  });
  return Array.from(map.values()).sort((a, b) => a.weekNumber - b.weekNumber);
}

function WeekGroupRow({ group }: { group: WeekGroup }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const label = systemLabels[group.system] || group.system;
  const weekLabel = group.weekNumber ? `W${group.weekNumber}` : '';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-2.5 rounded-md bg-background border text-sm hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs shrink-0">{label}</Badge>
            {weekLabel && <span className="text-muted-foreground text-xs">{weekLabel}</span>}
            <span className="font-medium">{group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}</span>
          </div>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 space-y-1 pl-3">
        {group.tasks.map(task => (
          <div key={task.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border text-sm">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {task.title.startsWith('Call') ? (
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : task.title.startsWith('Text') ? (
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : null}
              <span className="truncate">{task.title}</span>
            </div>
            {task.navigateTo && (
              <Button variant="ghost" size="sm" className="shrink-0 h-7" onClick={() => navigate(task.navigateTo!)}>
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function OverdueTasks({ data }: Props) {
  const { accountabilityScore, priorityTasks } = data;
  const { hasAccess } = useFeatureAccess();
  const colors = getScoreColor(accountabilityScore);

  // Filter out tasks for systems the user can't access
  const filteredTasks = priorityTasks.filter(t => {
    if (t.system === 'events' && !hasAccess('/events')) return false;
    return true;
  });

  const nudge = getNudgeText(accountabilityScore, filteredTasks.length);

  // Don't render if perfect score and nothing overdue
  if (accountabilityScore >= 100 && filteredTasks.length === 0) {
    return null;
  }

  // Group sphere tasks by week, keep events/coaching as-is
  const sphereTasks = filteredTasks.filter(t => t.system === 'spheresync');
  const otherTasks = filteredTasks.filter(t => t.system !== 'spheresync');
  const weekGroups = groupByWeek(sphereTasks);

  // Group other tasks too (events, coaching)
  const otherGroups = groupByWeek(otherTasks);

  return (
    <Card className={`${colors.border} ${colors.bg}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className={`h-5 w-5 ${colors.ring}`} />
          Accountability Center
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score */}
        <div className="text-center space-y-2">
          <ScoreGauge score={accountabilityScore} />
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            {accountabilityScore >= 80 ? <Sparkles className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {nudge}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Based on your last 4 weeks of task completion across SphereSync{hasAccess('/events') ? ', Events,' : ' and'} Scoreboard.
          </p>
        </div>

        {/* Priority Tasks grouped by week */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            Recent Overdue
            {filteredTasks.length > 0 && (
              <Badge variant="secondary" className="text-xs">{filteredTasks.length}</Badge>
            )}
          </h4>
          {filteredTasks.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-background border text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              No recent overdue tasks — nice work!
            </div>
          ) : (
            <div className="space-y-1.5">
              {weekGroups.map(g => (
                <WeekGroupRow key={`${g.system}-${g.weekNumber}`} group={g} />
              ))}
              {otherGroups.map(g => (
                <WeekGroupRow key={`${g.system}-${g.weekNumber}`} group={g} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

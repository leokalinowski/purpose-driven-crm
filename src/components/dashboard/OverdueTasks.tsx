import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Target, ExternalLink, ChevronDown, ChevronUp, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
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

const systemRoutes: Record<string, string> = {
  spheresync: '/spheresync-tasks',
  events: '/events',
  coaching: '/coaching',
};

function getScoreColor(score: number) {
  if (score >= 80) return { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', ring: 'text-emerald-500', track: 'text-emerald-500/20' };
  if (score >= 50) return { border: 'border-amber-500/30', bg: 'bg-amber-500/5', ring: 'text-amber-500', track: 'text-amber-500/20' };
  return { border: 'border-destructive/30', bg: 'bg-destructive/5', ring: 'text-destructive', track: 'text-destructive/20' };
}

function getNudgeText(score: number, milestone: { score: number; tasksNeeded: number }, priorityCount: number) {
  if (score >= 95) return "You're crushing it! 🔥";
  if (score >= 80 && priorityCount === 0) return "Strong week — keep the momentum! 💪";
  if (score >= 80) return `Complete ${milestone.tasksNeeded} more task${milestone.tasksNeeded !== 1 ? 's' : ''} to hit ${milestone.score}!`;
  if (score >= 50) return `${milestone.tasksNeeded} task${milestone.tasksNeeded !== 1 ? 's' : ''} away from ${milestone.score} — you've got this!`;
  return `Let's turn this around — start with ${milestone.tasksNeeded} task${milestone.tasksNeeded !== 1 ? 's' : ''} to reach ${milestone.score}.`;
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

export function OverdueTasks({ data }: Props) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const { accountabilityScore, priorityTasks, cleanupSummary, nextMilestone } = data;
  const colors = getScoreColor(accountabilityScore);
  const nudge = getNudgeText(accountabilityScore, nextMilestone, priorityTasks.length);
  const visiblePriority = showAll ? priorityTasks : priorityTasks.slice(0, 5);

  // Don't render if perfect score and nothing overdue
  if (accountabilityScore >= 100 && priorityTasks.length === 0 && cleanupSummary.total === 0) {
    return null;
  }

  return (
    <Card className={`${colors.border} ${colors.bg}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className={`h-5 w-5 ${colors.ring}`} />
          Accountability Center
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Section 1: Score */}
        <div className="text-center space-y-2">
          <ScoreGauge score={accountabilityScore} />
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            {accountabilityScore >= 80 ? <Sparkles className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {nudge}
          </p>
        </div>

        {/* Section 2: Priority Tasks */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            This Week's Priority
            {priorityTasks.length > 0 && (
              <Badge variant="secondary" className="text-xs">{priorityTasks.length}</Badge>
            )}
          </h4>
          {priorityTasks.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-background border text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              No recent overdue tasks — nice work!
            </div>
          ) : (
            <ul className="space-y-1.5">
              {visiblePriority.map(task => (
                <li key={task.id} className="flex items-center justify-between p-2 rounded-md bg-background border">
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
                    <Button variant="ghost" size="sm" className="shrink-0 h-7" onClick={() => navigate(task.navigateTo!)}>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {priorityTasks.length > 5 && (
            <Button variant="ghost" size="sm" className="w-full mt-1 text-xs" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show less' : `Show ${priorityTasks.length - 5} more`}
            </Button>
          )}
        </div>

        {/* Section 3: Cleanup Summary */}
        {cleanupSummary.total > 0 && (
          <Collapsible open={cleanupOpen} onOpenChange={setCleanupOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
                <span>{cleanupSummary.total} older task{cleanupSummary.total !== 1 ? 's' : ''} need attention</span>
                {cleanupOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1.5">
              {(['spheresync', 'events', 'coaching'] as const).map(sys => {
                const count = cleanupSummary[sys];
                if (count === 0) return null;
                return (
                  <div key={sys} className="flex items-center justify-between p-2 rounded-md bg-background border text-sm">
                    <span>
                      <span className="font-medium">{systemLabels[sys]}</span>
                      <span className="text-muted-foreground ml-1.5">({count})</span>
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(systemRoutes[sys])}>
                      Go to page <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

import { Brain, TrendingUp, TrendingDown, Minus, Target, Phone, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useAgentIntelligence } from '@/hooks/useAgentIntelligence';
import { cn } from '@/lib/utils';

export function AgentIntelligenceWidget() {
  const { snapshot, loading } = useAgentIntelligence();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!snapshot) {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardContent className="p-5 flex items-center gap-4">
          <Brain className="h-9 w-9 text-muted-foreground/30 shrink-0" />
          <div>
            <p className="font-medium text-sm">AI Weekly Intelligence</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your personalized insights — sphere health, priorities, and market signals — will appear here once your first snapshot is generated. It runs automatically every Monday morning.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { sphere_health, weekly_priorities, market_pulse, coaching_context, top_opportunities } = snapshot;

  const TrendIcon =
    coaching_context?.week_trend === 'improving' ? TrendingUp :
    coaching_context?.week_trend === 'declining' ? TrendingDown : Minus;

  const trendColor =
    coaching_context?.week_trend === 'improving' ? 'text-green-600' :
    coaching_context?.week_trend === 'declining' ? 'text-red-500' :
    'text-muted-foreground';

  const healthScore = sphere_health?.health_score ?? 0;
  const healthColor =
    healthScore >= 75 ? 'text-green-600' :
    healthScore >= 50 ? 'text-amber-600' :
    'text-red-500';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Brain className="h-4 w-4 text-primary" />
          AI Weekly Intelligence
          <Badge variant="secondary" className="ml-auto text-xs font-normal">
            Week {snapshot.week_number}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Sphere Health ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sphere Health</p>
            <div className="flex items-end gap-2">
              <span className={cn('text-3xl font-bold', healthColor)}>{healthScore}</span>
              <span className="text-sm text-muted-foreground mb-1">/100</span>
            </div>
            <Progress value={healthScore} className="h-1.5" />
            {sphere_health?.key_stat && (
              <p className="text-xs text-muted-foreground leading-snug">{sphere_health.key_stat}</p>
            )}
            {sphere_health?.summary && (
              <p className="text-xs text-muted-foreground/80 leading-snug">{sphere_health.summary}</p>
            )}
          </div>

          {/* ── Top Priorities ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" /> Top Priorities This Week
            </p>
            <div className="space-y-2">
              {(weekly_priorities ?? []).slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {p.priority_rank}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {p.task_type === 'call'
                        ? <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        : <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <span className="text-xs font-medium truncate">{p.contact_name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{p.reason}</p>
                  </div>
                </div>
              ))}
              {(!weekly_priorities || weekly_priorities.length === 0) && (
                <p className="text-xs text-muted-foreground">Priorities will appear after this week's tasks are scored.</p>
              )}
            </div>
          </div>

          {/* ── Market + Coaching ── */}
          <div className="space-y-4">
            {market_pulse?.summary && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Market Pulse
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{market_pulse.summary}</p>
              </div>
            )}

            {coaching_context?.observation && (
              <div className="space-y-1">
                <p className={cn('text-xs font-semibold uppercase tracking-wide flex items-center gap-1', trendColor)}>
                  <TrendIcon className="h-3 w-3" /> Performance
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{coaching_context.observation}</p>
              </div>
            )}

            {top_opportunities && top_opportunities.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline Nudge</p>
                <p className="text-xs text-muted-foreground leading-snug">
                  <span className="font-medium text-foreground">{top_opportunities[0].contact_name}</span>
                  {' — '}{top_opportunities[0].next_action}
                </p>
              </div>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

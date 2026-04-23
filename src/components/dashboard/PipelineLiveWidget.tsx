/**
 * PipelineLiveWidget — reads live from `opportunities`, never from the cached snapshot.
 * Shows: open deals, pipeline value, avg AI probability, stale count, top 3 deals with next step.
 * Placed on the main dashboard so the agent always sees real-time pipeline state.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  KanbanSquare, DollarSign, Zap, AlertCircle,
  ArrowRight, ChevronRight, Clock,
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';

interface LiveOpp {
  id: string;
  stage: string;
  deal_value: number | null;
  ai_deal_probability: number | null;
  ai_suggested_next_action: string | null;
  next_step_title: string | null;
  next_step_due_date: string | null;
  is_stale: boolean;
  contact: { first_name: string | null; last_name: string | null } | null;
  title: string | null;
}

interface Summary {
  openCount: number;
  pipelineValue: number;
  avgProbability: number | null;
  staleCount: number;
  topDeals: LiveOpp[];
}

function uselivePipeline() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    supabase
      .from('opportunities')
      .select('id, stage, deal_value, ai_deal_probability, ai_suggested_next_action, next_step_title, next_step_due_date, is_stale, title, contact:contacts(first_name, last_name)')
      .eq('agent_id', user.id)
      .is('actual_close_date', null)
      .or('outcome.is.null,outcome.not.in.(lost,withdrawn)')
      .order('ai_deal_probability', { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return; }
        const opps = data as unknown as LiveOpp[];
        const scored = opps.filter(o => o.ai_deal_probability != null);
        setSummary({
          openCount: opps.length,
          pipelineValue: opps.reduce((s, o) => s + (o.deal_value ?? 0), 0),
          avgProbability: scored.length > 0
            ? Math.round(scored.reduce((s, o) => s + (o.ai_deal_probability ?? 0), 0) / scored.length)
            : null,
          staleCount: opps.filter(o => o.is_stale).length,
          topDeals: opps.slice(0, 3),
        });
        setLoading(false);
      });
  }, [user?.id]);

  return { summary, loading };
}

function probColor(p: number) {
  if (p >= 70) return 'text-green-700 border-green-300 bg-green-50';
  if (p >= 40) return 'text-amber-700 border-amber-300 bg-amber-50';
  return 'text-red-700 border-red-300 bg-red-50';
}

function formatDue(d: string | null) {
  if (!d) return null;
  const dt = parseISO(d);
  if (isPast(dt) && !isToday(dt)) return { label: 'Overdue', urgent: true };
  if (isToday(dt)) return { label: 'Today', urgent: true };
  return { label: format(dt, 'MMM d'), urgent: false };
}

export function PipelineLiveWidget() {
  const { summary, loading } = uselivePipeline();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.openCount === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KanbanSquare className="h-4 w-4 text-muted-foreground" />
            Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No open deals.{' '}
            <Link to="/pipeline" className="text-primary underline-offset-2 hover:underline">Open Pipeline →</Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <KanbanSquare className="h-4 w-4 text-muted-foreground" />
            Pipeline
            <Badge variant="secondary" className="text-xs font-medium ml-1">Live</Badge>
          </CardTitle>
          <Link
            to="/pipeline"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-2xl font-bold">{summary.openCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Open Deals</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-2xl font-bold">
              {summary.pipelineValue >= 1_000_000
                ? `$${(summary.pipelineValue / 1_000_000).toFixed(1)}M`
                : `$${Math.round(summary.pipelineValue / 1000)}k`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Pipeline Value</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            {summary.avgProbability != null ? (
              <>
                <p className={cn('text-2xl font-bold',
                  summary.avgProbability >= 70 ? 'text-green-700' :
                  summary.avgProbability >= 40 ? 'text-amber-700' : 'text-red-700'
                )}>
                  {summary.avgProbability}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                  <Zap className="h-3 w-3" />Avg AI Score
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-0.5">Not scored</p>
              </>
            )}
          </div>
          <div className={cn('rounded-lg p-3 text-center', summary.staleCount > 0 ? 'bg-amber-50' : 'bg-muted/50')}>
            <p className={cn('text-2xl font-bold', summary.staleCount > 0 ? 'text-amber-700' : 'text-foreground')}>
              {summary.staleCount}
            </p>
            <p className={cn('text-xs mt-0.5 flex items-center justify-center gap-1',
              summary.staleCount > 0 ? 'text-amber-700' : 'text-muted-foreground'
            )}>
              <Clock className="h-3 w-3" />Stale
            </p>
          </div>
        </div>

        {/* Top deals */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Top Deals
          </p>
          {summary.topDeals.map(opp => {
            const name = opp.contact
              ? `${opp.contact.first_name ?? ''} ${opp.contact.last_name ?? ''}`.trim() || opp.title || 'Unknown'
              : opp.title ?? 'Unknown';
            const due = formatDue(opp.next_step_due_date);

            return (
              <Link key={opp.id} to="/pipeline">
                <div className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-border hover:border-foreground/20 hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {opp.next_step_title ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <ArrowRight className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{opp.next_step_title}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-orange-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 flex-shrink-0" />
                          No next step
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {due && (
                      <span className={cn('text-xs font-medium', due.urgent ? 'text-red-600' : 'text-muted-foreground')}>
                        {due.label}
                      </span>
                    )}
                    {opp.ai_deal_probability != null && (
                      <Badge variant="outline" className={cn('text-xs h-5 gap-0.5', probColor(opp.ai_deal_probability))}>
                        <Zap className="h-2.5 w-2.5" />{opp.ai_deal_probability}%
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

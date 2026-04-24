import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  AlertCircle, TrendingUp, Briefcase, Users, Shield, Award,
  RefreshCcw, ChevronRight, Sparkles,
} from 'lucide-react';
import { useCoachingState, ALERT_META } from '@/hooks/useCoachingState';
import { HeroCard } from '@/components/commander/HeroCard';
import { ActionCard } from '@/components/commander/ActionCard';

export default function Commander() {
  const { state, loading, error, refetch } = useCoachingState();

  const generatedRelative = state?.generated_at
    ? formatDistanceToNow(parseISO(state.generated_at), { addSuffix: true })
    : null;

  return (
    <>
      <Helmet><title>Today — Real Estate on Purpose</title></Helmet>
      <Layout>
        <div className="space-y-6 max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-500" />
                Today
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Who to talk to, what to say. Your SphereSync Coach at a glance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {generatedRelative && (
                <span className="text-xs text-muted-foreground">
                  Updated {generatedRelative}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 md:h-9 md:w-9"
                onClick={() => refetch()}
                aria-label="Refresh coaching state"
                title="Refresh"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Couldn't load your coaching state</p>
                  <p className="mt-1">{error.message}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Retry</Button>
                </div>
              </div>
            </div>
          )}

          {/* Hero — next hour. Only rendered once the state row exists.
              The outer "no state yet" empty state below covers the first-run case. */}
          {(loading || state) && (
            <HeroCard nextHour={state?.next_hour ?? null} loading={loading} />
          )}

          {/* Today list */}
          {!loading && state?.today_list && state.today_list.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Today's list
                </h2>
                <span className="text-xs text-muted-foreground">{state.today_list.length} items</span>
              </div>
              <div className="space-y-2">
                {state.today_list.map((item, i) => (
                  <ActionCard
                    key={`${item.contact_id}-${i}`}
                    item={item}
                    showCoachBadge
                    onCall={() => toast.info(`Dialling ${item.contact_name}…`)}
                    onText={() => toast.info(`Opening text to ${item.contact_name}…`)}
                    onLog={() => toast.info('Opening log modal…')}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Week narrative */}
          {!loading && state?.week_narrative && (
            <section className="space-y-3">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                This week's story
              </h2>
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
                <NarrativeLine icon={<TrendingUp className="h-4 w-4 text-green-600" />} label="GCI pace" text={state.week_narrative.gci_pace} />
                <NarrativeLine icon={<Briefcase className="h-4 w-4 text-orange-600" />} label="Pipeline" text={state.week_narrative.pipeline_story} />
                <NarrativeLine icon={<Users className="h-4 w-4 text-blue-600" />} label="Sphere" text={state.week_narrative.sphere_story} />
                {state.week_narrative.top_risk && (
                  <NarrativeLine icon={<Shield className="h-4 w-4 text-red-600" />} label="Top risk" text={state.week_narrative.top_risk} tone="risk" />
                )}
                {state.week_narrative.top_win && (
                  <NarrativeLine icon={<Award className="h-4 w-4 text-purple-600" />} label="Top win" text={state.week_narrative.top_win} tone="win" />
                )}
              </div>
            </section>
          )}

          {/* Alerts */}
          {!loading && state?.alerts && state.alerts.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Signals
              </h2>
              <div className="space-y-1.5">
                {state.alerts.map((alert, i) => {
                  const meta = ALERT_META[alert.level];
                  return (
                    <div key={i} className={cn('rounded-lg p-3 flex items-start gap-2.5', meta.bg)}>
                      <span className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', meta.dot)} />
                      <p className={cn('text-sm leading-snug flex-1', meta.text)}>{alert.message}</p>
                      {alert.contact_id && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty state — no coaching state yet */}
          {!loading && !state && !error && (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-base mb-1">Your Coach hasn't run yet</h3>
              <p className="text-sm text-muted-foreground">
                The first full tick runs automatically at 05:00 UTC. After that, your Today list
                populates here.
              </p>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}

function NarrativeLine({
  icon, label, text, tone,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  tone?: 'risk' | 'win';
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={cn(
        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
        tone === 'risk' ? 'bg-red-50' : tone === 'win' ? 'bg-purple-50' : 'bg-muted/50'
      )}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
          {label}
        </div>
        <p className="text-sm leading-snug">{text}</p>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  RefreshCw, Sparkles, TrendingUp, Briefcase, Users, Shield, Award,
  AlertCircle, ChevronRight, Phone, Mail, KanbanSquare, GraduationCap, Gift,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { buildAuthRedirectPath } from '@/utils/authRedirect';
import { useDashboardBlocks } from '@/hooks/useDashboardBlocks';
import { useCoachingState, ALERT_META } from '@/hooks/useCoachingState';
import { HeroCard } from '@/components/commander/HeroCard';
import { AgentIntelligenceWidget } from '@/components/dashboard/AgentIntelligenceWidget';
import { PipelineLiveWidget } from '@/components/dashboard/PipelineLiveWidget';
import { WeeklyTouchpoints } from '@/components/dashboard/WeeklyTouchpoints';
import { WeeklyTasksBySystem } from '@/components/dashboard/WeeklyTasksBySystem';
import { TransactionOpportunity } from '@/components/dashboard/TransactionOpportunity';
import { TaskPerformance } from '@/components/dashboard/TaskPerformance';
import { OverdueTasks } from '@/components/dashboard/OverdueTasks';
import { OnboardingWelcome } from '@/components/onboarding/OnboardingWelcome';
import { useUserProfile } from '@/hooks/useUserProfile';
import { cn } from '@/lib/utils';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useDashboardBlocks();
  const { profile } = useUserProfile();
  const { state: coachState, loading: coachLoading, refetch: refetchCoach } = useCoachingState();
  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    localStorage.getItem('reop_onboarding_dismissed') === 'true'
  );

  const isNewUser = data
    ? data.blockOne.totalTouchpoints === 0 && data.blockThree.databaseSize === 0
    : false;

  const showOnboarding = !onboardingDismissed && !loading && !!data && isNewUser;

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem('reop_onboarding_dismissed', 'true');
    setOnboardingDismissed(true);
  }, []);

  const coachUpdatedRelative = coachState?.generated_at
    ? formatDistanceToNow(parseISO(coachState.generated_at), { addSuffix: true })
    : null;

  const handleRefresh = useCallback(() => {
    refresh();
    refetchCoach();
  }, [refresh, refetchCoach]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(buildAuthRedirectPath(), { replace: true });
    } else if (user && !authLoading) {
      document.title = 'Dashboard | Real Estate on Purpose';
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-5 w-72" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent><Skeleton className="h-32 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  const firstName = profile?.first_name;
  const greeting = firstName ? `Good to see you, ${firstName}.` : 'Welcome back.';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Dark hero card */}
        <div
          className="relative overflow-hidden rounded-2xl p-7 sm:p-9"
          style={{ background: 'linear-gradient(135deg, hsl(188 100% 21%), hsl(189 100% 14%))' }}
        >
          {/* Radial glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full"
            style={{ background: 'radial-gradient(circle at top right, hsl(184 100% 34% / 0.25), transparent 65%)' }}
          />

          {/* Header row */}
          <div className="relative flex items-start justify-between gap-4 mb-7">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-reop-teal mb-1.5">
                Real Estate on Purpose
              </p>
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-white leading-tight">
                {greeting}
              </h1>
              <p className="text-sm text-white/60 mt-1">
                Here's how this month is landing.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {coachUpdatedRelative && (
                <span className="text-xs text-white/40 hidden sm:inline">
                  Coach {coachUpdatedRelative}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white bg-transparent"
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </div>

          {/* 4-stat strip */}
          {data && (
            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Touches this month',
                  value: data.blockOne.totalTouchpoints,
                  icon: <Phone className="h-4 w-4" />,
                  fmt: (v: number) => v.toLocaleString(),
                },
                {
                  label: 'Database contacts',
                  value: data.blockThree.databaseSize,
                  icon: <Users className="h-4 w-4" />,
                  fmt: (v: number) => v.toLocaleString(),
                },
                {
                  label: 'Closed this year',
                  value: data.blockThree.currentYearTransactions,
                  icon: <Award className="h-4 w-4" />,
                  fmt: (v: number) => v.toLocaleString(),
                },
                {
                  label: 'Potential GCI',
                  value: data.blockThree.potentialGCI,
                  icon: <TrendingUp className="h-4 w-4" />,
                  fmt: (v: number) =>
                    v >= 1_000_000
                      ? `$${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                      ? `$${Math.round(v / 1_000)}K`
                      : `$${v.toLocaleString()}`,
                },
              ].map(({ label, value, icon, fmt }) => (
                <div
                  key={label}
                  className="rounded-xl px-4 py-3.5"
                  style={{ background: 'hsl(184 100% 34% / 0.12)', border: '1px solid hsl(184 100% 34% / 0.2)' }}
                >
                  <div className="flex items-center gap-1.5 text-reop-teal mb-2 text-[11px] font-semibold uppercase tracking-[0.05em]">
                    {icon}
                    {label}
                  </div>
                  <div className="text-2xl font-semibold text-white leading-none">
                    {fmt(value)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <Card className="border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {showOnboarding && (
          <OnboardingWelcome
            userName={profile?.first_name}
            onDismiss={dismissOnboarding}
          />
        )}

        {/* AI-FIRST — the Coach leads the Dashboard */}
        <section className="space-y-4">
          <HeroCard nextHour={coachState?.next_hour ?? null} loading={coachLoading} />

          {/* Week narrative: how you're doing this week */}
          {!coachLoading && coachState?.week_narrative && (
            <div className="rounded-xl border border-border bg-card p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  This week's story
                </h2>
                <Sparkles className="h-3.5 w-3.5 text-purple-500" aria-hidden="true" />
              </div>
              <div className="space-y-3">
                <NarrativeLine
                  icon={<TrendingUp className="h-4 w-4 text-green-600" />}
                  label="GCI pace"
                  text={coachState.week_narrative.gci_pace}
                />
                <NarrativeLine
                  icon={<Briefcase className="h-4 w-4 text-orange-600" />}
                  label="Pipeline"
                  text={coachState.week_narrative.pipeline_story}
                />
                <NarrativeLine
                  icon={<Users className="h-4 w-4 text-blue-600" />}
                  label="Sphere"
                  text={coachState.week_narrative.sphere_story}
                />
                {coachState.week_narrative.top_risk && (
                  <NarrativeLine
                    icon={<Shield className="h-4 w-4 text-red-600" />}
                    label="Top risk"
                    text={coachState.week_narrative.top_risk}
                    tone="risk"
                  />
                )}
                {coachState.week_narrative.top_win && (
                  <NarrativeLine
                    icon={<Award className="h-4 w-4 text-purple-600" />}
                    label="Top win"
                    text={coachState.week_narrative.top_win}
                    tone="win"
                  />
                )}
              </div>
            </div>
          )}

          {/* Signals — Coach alerts */}
          {!coachLoading && coachState?.alerts && coachState.alerts.length > 0 && (
            <div className="space-y-1.5">
              <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Signals
              </h2>
              {coachState.alerts.slice(0, 4).map((alert, i) => {
                const meta = ALERT_META[alert.level] ?? ALERT_META['info'];
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
          )}

          {/* First-run empty state for Coach */}
          {!coachLoading && !coachState && (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                Your Coach hasn't run yet. The first full tick runs automatically at 05:00 UTC —
                come back tomorrow morning and this section will tell you who to talk to and how
                the week is pacing.
              </p>
            </div>
          )}
        </section>

        {/* This Month — existing Dashboard metrics */}
        {data && (
          <section className="space-y-6 pt-2">
            <div className="flex items-center gap-2 border-t border-border pt-6">
              <h2 className="text-lg font-semibold tracking-tight">This Month</h2>
              <span className="text-xs text-muted-foreground">Your metrics at a glance</span>
            </div>
            <AgentIntelligenceWidget />
            <PipelineLiveWidget />
            <WeeklyTouchpoints data={data.blockOne} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WeeklyTasksBySystem data={data.blockTwo} />
              <TransactionOpportunity data={data.blockThree} />
            </div>
            <TaskPerformance data={data.blockFour} />
            <OverdueTasks data={data.blockFive} />

            {/* Shortcuts panel */}
            <section className="pt-2">
              <div className="flex items-center gap-2 border-t border-border pt-6 mb-4">
                <h2 className="text-lg font-semibold tracking-tight">Quick access</h2>
                <span className="text-xs text-muted-foreground">Jump to key workflows</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'SphereSync', icon: <Sparkles className="h-5 w-5" />, to: '/spheresync-tasks' },
                  { label: 'Pipeline', icon: <KanbanSquare className="h-5 w-5" />, to: '/spheresync-tasks?tab=pipeline' },
                  { label: 'Database', icon: <Users className="h-5 w-5" />, to: '/database' },
                  { label: 'Transactions', icon: <Briefcase className="h-5 w-5" />, to: '/transactions' },
                  { label: 'Coaching', icon: <GraduationCap className="h-5 w-5" />, to: '/coaching' },
                  { label: 'Events', icon: <Gift className="h-5 w-5" />, to: '/events' },
                ].map(({ label, icon, to }) => (
                  <Link
                    key={label}
                    to={to}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary group"
                  >
                    <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>
                    <span className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors">{label}</span>
                  </Link>
                ))}
              </div>
            </section>
          </section>
        )}
      </div>
    </Layout>
  );
};

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

export default Index;

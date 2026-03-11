import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { buildAuthRedirectPath } from '@/utils/authRedirect';
import { useDashboardBlocks } from '@/hooks/useDashboardBlocks';
import { WeeklyTouchpoints } from '@/components/dashboard/WeeklyTouchpoints';
import { WeeklyTasksBySystem } from '@/components/dashboard/WeeklyTasksBySystem';
import { TransactionOpportunity } from '@/components/dashboard/TransactionOpportunity';
import { TaskPerformance } from '@/components/dashboard/TaskPerformance';
import { OverdueTasks } from '@/components/dashboard/OverdueTasks';
import { DashboardRefreshButton } from '@/components/dashboard/DashboardRefreshButton';
import { OnboardingWelcome } from '@/components/onboarding/OnboardingWelcome';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useDashboardBlocks();
  const { profile } = useUserProfile();
  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    localStorage.getItem('reop_onboarding_dismissed') === 'true'
  );

  const isNewUser = data
    ? data.blockOne.totalTouchpoints === 0 && data.blockThree.totalContacts === 0
    : false;

  const showOnboarding = !onboardingDismissed && !loading && !!data && isNewUser;

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem('reop_onboarding_dismissed', 'true');
    setOnboardingDismissed(true);
  }, []);

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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Your week at a glance — touchpoints, tasks, and opportunities.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} className="self-start">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {data && (
          <>
            {/* Block 1: Weekly Touchpoints */}
            <WeeklyTouchpoints data={data.blockOne} />

            {/* Block 2 + Block 3 side by side on large screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WeeklyTasksBySystem data={data.blockTwo} />
              <TransactionOpportunity data={data.blockThree} />
            </div>

            {/* Block 4: Performance */}
            <TaskPerformance data={data.blockFour} />

            {/* Block 5: Overdue */}
            <OverdueTasks data={data.blockFive} />
          </>
        )}
      </div>
    </Layout>
  );
};

export default Index;

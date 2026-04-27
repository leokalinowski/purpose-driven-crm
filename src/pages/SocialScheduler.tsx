import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { MetricoolIframe } from '@/components/metricool/MetricoolIframe';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';
import { useUserRole } from '@/hooks/useUserRole';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SocialScheduler() {
  const { isAdmin } = useUserRole();
  const { hasAccess, currentTier, getRequiredTier } = useFeatureAccess();

  if (!hasAccess('/social-scheduler')) {
    return (
      <Layout>
        <UpgradePrompt
          featureName="Social Media Management"
          requiredTier={getRequiredTier('/social-scheduler') || 'managed'}
          currentTier={currentTier}
          description="Access your social media dashboard to schedule posts, track analytics, and grow your real estate business online."
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <Helmet>
          <title>Social Media Management | Real Estate on Purpose</title>
          <meta
            name="description"
            content="Manage your social media presence. Schedule posts, track analytics, and grow your real estate business online."
          />
        </Helmet>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-primary">Social Media</span>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Show up where your clients are.</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Schedule posts, track analytics, and grow your presence.
            </p>
          </div>
        </div>

        {isAdmin && (
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              Looking to manage team social media settings?{' '}
              <Link to="/admin/social-scheduler" className="text-primary hover:underline font-medium">
                Go to Admin Social Media Management
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <MetricoolIframe />
      </div>
    </Layout>
  );
}
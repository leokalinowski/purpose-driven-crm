import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { MetricoolIframe } from '@/components/metricool/MetricoolIframe';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserRole } from '@/hooks/useUserRole';
import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SocialScheduler() {
  const { isAdmin } = useUserRole();

  return (
    <Layout>
      <div className="space-y-6">
        <Helmet>
          <title>Social Media Management | Real Estate on Purpose</title>
          <meta
            name="description"
            content="Manage your social media presence with Metricool. Schedule posts, track analytics, and grow your real estate business online."
          />
        </Helmet>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Social Media Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Access your Metricool dashboard to manage your social media accounts and campaigns
            </p>
          </div>
        </div>

        {isAdmin && (
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              Looking to manage team Metricool settings?{' '}
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
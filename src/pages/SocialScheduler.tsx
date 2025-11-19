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

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Social Media Management</h1>
            <p className="text-muted-foreground">
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
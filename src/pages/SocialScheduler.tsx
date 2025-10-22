import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { MetricoolIframe } from '@/components/metricool/MetricoolIframe';

export default function SocialScheduler() {
  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 space-y-6">
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

        <MetricoolIframe />
      </div>
    </Layout>
  );
}
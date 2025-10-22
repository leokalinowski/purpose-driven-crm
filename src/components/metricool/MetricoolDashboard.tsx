import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { useMetricoolLink } from '@/hooks/useMetricool';

interface MetricoolIframeProps {
  userId?: string;
}

export function MetricoolDashboard({ userId }: MetricoolIframeProps) {
  const { data: metricoolLink, isLoading } = useMetricoolLink(userId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Loading Metricool...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metricoolLink) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metricool Social Media Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No Metricool link has been configured for your account yet.
              Please contact your administrator to set up your Metricool integration.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metricool Social Media Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full">
          <iframe
            src={`/metricool-test.html?url=${encodeURIComponent(metricoolLink.iframe_url)}`}
            className="w-full h-[800px] border-0 rounded-lg"
            title="Metricool Dashboard"
            allow="clipboard-write; clipboard-read; fullscreen; encrypted-media; autoplay; picture-in-picture; camera; microphone; geolocation; payment"
            referrerPolicy="no-referrer"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-top-navigation allow-modals allow-downloads allow-pointer-lock allow-orientation-lock allow-popups-to-escape-sandbox"
          />
        </div>
      </CardContent>
    </Card>
  );
}

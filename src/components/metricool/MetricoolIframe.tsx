import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useMetricoolLink } from '@/hooks/useMetricool';

interface MetricoolIframeProps {
  userId?: string;
}

export function MetricoolIframe({ userId }: MetricoolIframeProps) {
  const { data: metricoolLink, isLoading } = useMetricoolLink(userId);
  const [key, setKey] = useState(0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  if (!metricoolLink) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No Metricool link found for this user.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">Metricool Dashboard</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(metricoolLink.iframe_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKey(prev => prev + 1)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Frame
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 h-[800px]">
        <iframe
          key={key}
          src={metricoolLink.iframe_url}
          className="w-full h-full border-0"
          title="Metricool Dashboard"
          allow="clipboard-write; clipboard-read; fullscreen; encrypted-media; autoplay; picture-in-picture; camera; microphone; geolocation; payment"
          sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-top-navigation"
          referrerPolicy="no-referrer"
        />
      </CardContent>
    </Card>
  );
}
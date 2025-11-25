import React, { useState, useEffect } from 'react';
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
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setIsLoadingIframe(true);
    setHasError(false);
  }, [userId, retryKey]);

  const handleLoad = () => {
    setIsLoadingIframe(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoadingIframe(false);
    setHasError(true);
  };

  const handleRetry = () => {
    setRetryKey(prev => prev + 1);
  };

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
              No Metricool link configured for this user.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const wrapperUrl = `/metricool-test.html?url=${encodeURIComponent(metricoolLink.iframe_url)}&t=${Date.now()}`;

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
          {hasError && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {hasError ? (
          <div className="p-6 text-center">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Unable to load Metricool</div>
                <div className="text-sm mb-4">
                  The dashboard cannot be embedded due to browser security restrictions.
                </div>
                <Button onClick={() => window.open(metricoolLink.iframe_url, '_blank')}>
                  Open in New Tab Instead
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="relative w-full h-[800px]">
            {isLoadingIframe && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading Metricool dashboard...</p>
                </div>
              </div>
            )}
            <iframe
              key={retryKey}
              src={wrapperUrl}
              className="w-full h-full border-0"
              title="Metricool Dashboard"
              allow="clipboard-write; clipboard-read; fullscreen; encrypted-media; autoplay; picture-in-picture; camera; microphone; geolocation; payment"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={handleLoad}
              onError={handleError}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
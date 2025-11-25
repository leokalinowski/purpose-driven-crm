import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useMetricoolLink } from '@/hooks/useMetricool';

interface MetricoolIframeProps {
  userId?: string;
}

export function MetricoolDashboard({ userId }: MetricoolIframeProps) {
  const { data: metricoolLink, isLoading } = useMetricoolLink(userId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);
  const [currentApproach, setCurrentApproach] = useState<1 | 2 | 3>(3);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Set up iframe source based on current approach
  // Reset state when userId changes
  useEffect(() => {
    if (!metricoolLink) {
      setIframeSrc('');
      setIsLoadingIframe(true);
      setLoadError(null);
      return;
    }

    // Always use Approach 3 (wrapper) directly
    if (currentApproach === 3) {
      // Approach 3: Enhanced wrapper HTML
      const wrapperUrl = `/metricool-test.html?url=${encodeURIComponent(metricoolLink.iframe_url)}`;
      console.log('[MetricoolDashboard] Approach 3 - Using wrapper URL for user:', userId, wrapperUrl);
      setIframeSrc(wrapperUrl);
    }
  }, [metricoolLink?.iframe_url, currentApproach, userId]);

  // Helper function to handle approach failure
  const handleApproachFailure = useCallback(() => {
    setIsLoadingIframe(false);

    // Since we're using Approach 3 directly, if it fails, show error
    setLoadError('Failed to load Metricool dashboard. The Metricool dashboard cannot be embedded due to browser security restrictions. Please use "Open in New Tab" instead.');

    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  // Set up iframe loading state
  useEffect(() => {
    if (!iframeSrc) {
      setIsLoadingIframe(false);
      return;
    }

    console.log(`[MetricoolDashboard] Approach ${currentApproach} - Setting up iframe with src:`, iframeSrc);
    setIsLoadingIframe(true);
    setLoadError(null);
  }, [iframeSrc, currentApproach]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Metricool Social Media Dashboard</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(metricoolLink.iframe_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </Button>
        </div>
      </CardHeader>
      <CardContent>
            {loadError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Failed to load Metricool embed</div>
                  <div className="text-sm mb-2">{loadError}</div>
                  <div className="text-xs text-muted-foreground mb-2">
                    This may be due to browser security restrictions or authentication issues.
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>Tip:</strong> If you see a 401 login page, try:
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Click "Open in New Tab" to authenticate in a new window</li>
                      <li>After logging in, return here and click "Retry"</li>
                      <li>Or use the Metricool dashboard directly in the new tab</li>
                    </ol>
                  </div>
                </AlertDescription>
              </Alert>
            )}
        {isLoadingIframe && !loadError && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Loading Metricool dashboard...</p>
            </div>
          </div>
        )}
        <div className="w-full">
          {currentApproach === 3 && (
            <div className="text-xs text-muted-foreground mb-2">
              Loading Metricool dashboard via wrapper...
            </div>
          )}
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                className={`w-full h-[800px] border-0 rounded-lg ${isLoadingIframe ? 'hidden' : ''}`}
                title="Metricool Dashboard"
                allow="clipboard-write; clipboard-read; fullscreen; encrypted-media; autoplay; picture-in-picture; camera; microphone; geolocation; payment"
                referrerPolicy="origin"
                loading="lazy"
                sandbox={currentApproach === 1 ? undefined : "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation allow-modals allow-downloads allow-pointer-lock allow-popups-to-escape-sandbox"}
            onLoad={() => {
              console.log(`[MetricoolDashboard] Approach ${currentApproach} - Iframe loaded`);
              setIsLoadingIframe(false);
              setLoadError(null);
            }}
            onError={(e) => {
              console.error(`[MetricoolDashboard] Approach ${currentApproach} - Iframe error event:`, e);
              handleApproachFailure();
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useMetricoolLink } from '@/hooks/useMetricool';

interface MetricoolIframeProps {
  userId?: string;
}

export function MetricoolDashboard({ userId }: MetricoolIframeProps) {
  const { data: metricoolLink, isLoading } = useMetricoolLink(userId);
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when userId changes (before setting new iframe source)
  useEffect(() => {
    setIframeSrc('');
    setIsLoadingIframe(true);
  }, [userId]);

  // Set up iframe source using Approach 3 (wrapper) directly
  useEffect(() => {
    if (!metricoolLink) {
      return;
    }

    // Always use Approach 3 (wrapper) directly
    const wrapperUrl = `/metricool-test.html?url=${encodeURIComponent(metricoolLink.iframe_url)}`;
    console.log('[MetricoolDashboard] Using wrapper URL for user:', userId, wrapperUrl);
    setIframeSrc(wrapperUrl);
  }, [metricoolLink?.iframe_url, userId]);

  // Set up timeout for iframe loading (just to hide loading spinner, not to show errors)
  useEffect(() => {
    if (!iframeSrc) {
      setIsLoadingIframe(false);
      return;
    }

    setIsLoadingIframe(true);
    setLoadError(null);
    
    // Clear any existing timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    
    // Set a generous timeout to hide loading spinner as fallback
    // Don't show error - just hide spinner and show iframe
    loadTimeoutRef.current = setTimeout(() => {
      console.log('[MetricoolDashboard] Hiding loading spinner after 30 seconds (fallback)');
      setIsLoadingIframe(false);
    }, 30000);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [iframeSrc]);

  // Define all callbacks before any early returns
  const handleIframeLoad = useCallback(() => {
    // Clear the timeout immediately when iframe loads
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    
    // Hide loading spinner after a short delay to ensure content is visible
    setTimeout(() => {
      setIsLoadingIframe(false);
    }, 500);
  }, []);

  const handleIframeError = useCallback(() => {
    // Silently handle errors - don't show error message
    // Just hide loading spinner and let iframe show what it can
    console.warn('[MetricoolDashboard] Iframe error event detected, hiding spinner');
    setIsLoadingIframe(false);
  }, []);

  // Early returns after all hooks
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
        <div className="flex items-center justify-between">
          <CardTitle>Metricool Social Media Dashboard</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newWindow = window.open(metricoolLink.iframe_url, '_blank');
                if (newWindow) {
                  setTimeout(() => {
                    if (iframeRef.current) {
                      iframeRef.current.src = iframeRef.current.src;
                    }
                  }, 2000);
                }
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (iframeRef.current) {
                  iframeRef.current.src = iframeRef.current.src;
                }
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingIframe && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Loading Metricool dashboard...</p>
            </div>
          </div>
        )}
        <div className="w-full">
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className={`w-full h-[800px] border-0 rounded-lg ${isLoadingIframe ? 'hidden' : ''}`}
            title="Metricool Dashboard"
            allow="clipboard-write; clipboard-read; fullscreen; encrypted-media; autoplay; picture-in-picture; camera; microphone; geolocation; payment"
            referrerPolicy="origin"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation allow-modals allow-downloads allow-pointer-lock allow-popups-to-escape-sandbox"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </div>
      </CardContent>
    </Card>
  );
}

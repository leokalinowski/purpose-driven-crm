import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);
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

  // Set up iframe source using wrapper
  useEffect(() => {
    if (!metricoolLink) {
      setIframeSrc('');
      setIsLoadingIframe(true);
      setLoadError(null);
      return;
    }

    const wrapperUrl = `/metricool-test.html?url=${encodeURIComponent(metricoolLink.iframe_url)}`;
    setIframeSrc(wrapperUrl);
  }, [metricoolLink?.iframe_url, userId]);

  // Handle iframe load timeout
  const handleLoadTimeout = useCallback(() => {
    setIsLoadingIframe(false);
    setLoadError('Failed to load Metricool dashboard. Please try opening in a new tab instead.');
    
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  // Set up timeout for iframe loading
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
    
    // Set timeout to detect if iframe never loads
    loadTimeoutRef.current = setTimeout(() => {
      handleLoadTimeout();
    }, 15000);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [iframeSrc, handleLoadTimeout]);

  const handleIframeLoad = useCallback(() => {
    // Simple timeout to hide loading spinner after iframe loads
    setTimeout(() => {
      setIsLoadingIframe(false);
      setLoadError(null);
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    }, 1000);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoadingIframe(false);
    setLoadError('Failed to load Metricool dashboard. Please use "Open in New Tab" instead.');
    
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

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

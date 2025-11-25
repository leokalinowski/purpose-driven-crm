import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useMetricoolLink } from '@/hooks/useMetricool';

interface MetricoolIframeProps {
  userId?: string;
}

export function MetricoolIframe({ userId }: MetricoolIframeProps) {
  const { data: metricoolLink, isLoading } = useMetricoolLink(userId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);
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

  // Set up timeout for iframe loading
  useEffect(() => {
    if (metricoolLink && iframeRef.current) {
      console.log('[MetricoolIframe] Approach 1 - Setting up direct iframe with URL:', metricoolLink.iframe_url);
      setIsLoadingIframe(true);
      setLoadError(null);
      
      // Set timeout to detect if iframe never loads (30 seconds)
      loadTimeoutRef.current = setTimeout(() => {
        console.warn('[MetricoolIframe] Approach 1 - Iframe load timeout after 30 seconds');
        setIsLoadingIframe(false);
        setLoadError('Iframe took too long to load. This may indicate the embed is blocked by browser security policies. Will try proxy approach next.');
      }, 30000);

      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
      };
    }
  }, [metricoolLink, isLoadingIframe]);

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
              <div className="text-xs text-muted-foreground">
                This may be due to browser security restrictions. Try opening in a new tab instead.
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
          {/* Approach 1: Direct iframe embedding - testing without wrapper */}
          <iframe
            ref={iframeRef}
            src={metricoolLink.iframe_url}
            className={`w-full h-[800px] border-0 rounded-lg ${isLoadingIframe ? 'hidden' : ''}`}
            title="Metricool Dashboard"
            allow="clipboard-write; clipboard-read; fullscreen; encrypted-media; autoplay; picture-in-picture; camera; microphone; geolocation; payment"
            referrerPolicy="origin"
            loading="lazy"
            onLoad={() => {
              console.log('[MetricoolIframe] Approach 1 - Direct iframe loaded successfully');
              setIsLoadingIframe(false);
              setLoadError(null);
              if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
              }
            }}
            onError={(e) => {
              console.error('[MetricoolIframe] Approach 1 - Direct iframe error:', e);
              setLoadError('Direct iframe embedding failed. This may be due to X-Frame-Options or Content Security Policy restrictions. Trying alternative approaches...');
              setIsLoadingIframe(false);
              if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

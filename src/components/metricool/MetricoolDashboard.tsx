import { useState, useRef, useEffect } from 'react';
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
  const [currentApproach, setCurrentApproach] = useState<1 | 2 | 3>(1);
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
  useEffect(() => {
    if (!metricoolLink) return;

    const setupIframe = async () => {
      if (currentApproach === 1) {
        // Approach 1: Direct iframe embedding
        console.log('[MetricoolDashboard] Approach 1 - Using direct iframe URL:', metricoolLink.iframe_url);
        setIframeSrc(metricoolLink.iframe_url);
      } else if (currentApproach === 2) {
        // Approach 2: Use Supabase proxy function
        try {
          // Get Supabase URL from the client
          const supabaseUrl = 'https://cguoaokqwgqvzkqqezcq.supabase.co';
          const proxyUrl = `${supabaseUrl}/functions/v1/metricool-proxy?url=${encodeURIComponent(metricoolLink.iframe_url)}`;
          console.log('[MetricoolDashboard] Approach 2 - Using proxy URL:', proxyUrl);
          setIframeSrc(proxyUrl);
        } catch (error) {
          console.error('[MetricoolDashboard] Approach 2 - Failed to create proxy URL:', error);
          setCurrentApproach(3);
        }
      } else if (currentApproach === 3) {
        // Approach 3: Enhanced wrapper HTML
        const wrapperUrl = `/metricool-test.html?url=${encodeURIComponent(metricoolLink.iframe_url)}`;
        console.log('[MetricoolDashboard] Approach 3 - Using wrapper URL:', wrapperUrl);
        setIframeSrc(wrapperUrl);
      }
    };

    setupIframe();
  }, [metricoolLink, currentApproach]);

  // Set up timeout for iframe loading
  useEffect(() => {
    if (metricoolLink && iframeSrc && iframeRef.current) {
      console.log(`[MetricoolDashboard] Approach ${currentApproach} - Setting up iframe with src:`, iframeSrc);
      setIsLoadingIframe(true);
      setLoadError(null);
      
      // Set timeout to detect if iframe never loads (30 seconds)
      loadTimeoutRef.current = setTimeout(() => {
        console.warn(`[MetricoolDashboard] Approach ${currentApproach} - Iframe load timeout after 30 seconds`);
        setIsLoadingIframe(false);
        
        // Try next approach if current one failed
        if (currentApproach === 1) {
          console.log('[MetricoolDashboard] Approach 1 failed, trying Approach 2 (proxy)...');
          setCurrentApproach(2);
        } else if (currentApproach === 2) {
          console.log('[MetricoolDashboard] Approach 2 failed, trying Approach 3 (wrapper)...');
          setCurrentApproach(3);
        } else {
          setLoadError('All embedding approaches failed. The Metricool dashboard cannot be embedded due to browser security restrictions. Please use "Open in New Tab" instead.');
        }
      }, 30000);

      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
      };
    }
  }, [metricoolLink, iframeSrc, currentApproach]);

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
          {currentApproach === 1 && (
            <div className="text-xs text-muted-foreground mb-2">
              Trying Approach 1: Direct iframe embedding...
            </div>
          )}
          {currentApproach === 2 && (
            <div className="text-xs text-muted-foreground mb-2">
              Approach 1 failed. Trying Approach 2: Proxy function...
            </div>
          )}
          {currentApproach === 3 && (
            <div className="text-xs text-muted-foreground mb-2">
              Approach 2 failed. Trying Approach 3: Enhanced wrapper...
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className={`w-full h-[800px] border-0 rounded-lg ${isLoadingIframe ? 'hidden' : ''}`}
            title="Metricool Dashboard"
            allow="clipboard-write; clipboard-read; fullscreen; encrypted-media; autoplay; picture-in-picture; camera; microphone; geolocation; payment"
            referrerPolicy={currentApproach === 1 ? "origin" : "no-referrer"}
            loading="lazy"
            sandbox={currentApproach === 1 ? undefined : "allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-top-navigation allow-modals allow-downloads allow-pointer-lock allow-orientation-lock allow-popups-to-escape-sandbox"}
            onLoad={() => {
              console.log(`[MetricoolDashboard] Approach ${currentApproach} - Iframe loaded successfully`);
              setIsLoadingIframe(false);
              setLoadError(null);
              if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
              }
            }}
            onError={(e) => {
              console.error(`[MetricoolDashboard] Approach ${currentApproach} - Iframe error:`, e);
              setIsLoadingIframe(false);
              
              // Try next approach
              if (currentApproach === 1) {
                console.log('[MetricoolDashboard] Approach 1 failed, trying Approach 2 (proxy)...');
                setCurrentApproach(2);
              } else if (currentApproach === 2) {
                console.log('[MetricoolDashboard] Approach 2 failed, trying Approach 3 (wrapper)...');
                setCurrentApproach(3);
              } else {
                setLoadError('All embedding approaches failed. The Metricool dashboard cannot be embedded due to browser security restrictions. Please use "Open in New Tab" instead.');
              }
              
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

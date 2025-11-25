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
  const [currentApproach, setCurrentApproach] = useState<1 | 2 | 3>(3);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      console.log('[MetricoolIframe] Approach 3 - Using wrapper URL for user:', userId, wrapperUrl);
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

  // Set up timeout for iframe loading - only when iframeSrc changes
  useEffect(() => {
    if (!iframeSrc) {
      setIsLoadingIframe(false);
      return;
    }

    console.log(`[MetricoolIframe] Approach ${currentApproach} - Setting up iframe with src:`, iframeSrc);
    setIsLoadingIframe(true);
    setLoadError(null);
    
    // Clear any existing timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    
    // Set timeout to detect if iframe never loads (15 seconds - reduced from 30)
    loadTimeoutRef.current = setTimeout(() => {
      console.warn(`[MetricoolIframe] Approach ${currentApproach} - Iframe load timeout after 15 seconds`);
      handleApproachFailure();
    }, 15000);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [iframeSrc, currentApproach, handleApproachFailure]);

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
          {currentApproach === 1 && (
            <div className="text-xs text-muted-foreground mb-2">
              Trying Approach 1: Direct iframe embedding...
            </div>
          )}
          {currentApproach === 3 && (
            <div className="text-xs text-muted-foreground mb-2">
              Approach 1 failed. Trying Approach 3: Enhanced wrapper...
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
              console.log(`[MetricoolIframe] Approach ${currentApproach} - Iframe loaded`);
              
              // Check if the iframe actually loaded valid content (not an error page)
              // This is a best-effort check - we can't always access iframe content due to CORS
              try {
                const iframe = iframeRef.current;
                if (iframe && iframe.contentWindow) {
                  // Try to detect if it's an error page by checking the URL or content
                  // If we can't access it, assume it loaded successfully
                  setTimeout(() => {
                    try {
                      // Check if iframe document is accessible and not an error
                      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                      if (iframeDoc) {
                        const bodyText = iframeDoc.body?.innerText || '';
                        // Check for common error indicators
                        if (bodyText.includes('401') || bodyText.includes('Missing authorization') || 
                            bodyText.includes('{"code":401') || bodyText.includes('error')) {
                          console.warn(`[MetricoolIframe] Approach ${currentApproach} - Detected error page in iframe`);
                          handleApproachFailure();
                          return;
                        }
                      }
                    } catch (e) {
                      // CORS - can't access iframe content, assume it's working
                      console.log(`[MetricoolIframe] Approach ${currentApproach} - Cannot access iframe content (CORS), assuming success`);
                    }
                    
                    // If we get here, assume it loaded successfully
                    setIsLoadingIframe(false);
                    setLoadError(null);
                    if (loadTimeoutRef.current) {
                      clearTimeout(loadTimeoutRef.current);
                      loadTimeoutRef.current = null;
                    }
                  }, 2000); // Wait 2 seconds to check content
                } else {
                  setIsLoadingIframe(false);
                  setLoadError(null);
                  if (loadTimeoutRef.current) {
                    clearTimeout(loadTimeoutRef.current);
                    loadTimeoutRef.current = null;
                  }
                }
              } catch (e) {
                console.error(`[MetricoolIframe] Error checking iframe content:`, e);
                // Assume it loaded if we can't check
                setIsLoadingIframe(false);
                setLoadError(null);
                if (loadTimeoutRef.current) {
                  clearTimeout(loadTimeoutRef.current);
                  loadTimeoutRef.current = null;
                }
              }
            }}
            onError={(e) => {
              console.error(`[MetricoolIframe] Approach ${currentApproach} - Iframe error event:`, e);
              handleApproachFailure();
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

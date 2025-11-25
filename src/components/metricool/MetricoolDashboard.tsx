import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink, Monitor, Maximize2 } from 'lucide-react';
import { useMetricoolLink } from '@/hooks/useMetricool';

interface MetricoolIframeProps {
  userId?: string;
}

export function MetricoolDashboard({ userId }: MetricoolIframeProps) {
  const { data: metricoolLink, isLoading } = useMetricoolLink(userId);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const openPopup = () => {
    if (!metricoolLink) return;

    const width = 1400;
    const height = 900;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      metricoolLink.iframe_url,
      'metricool-dashboard',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,status=yes,toolbar=no,menubar=no,location=no`
    );

    if (popup) {
      setPopupWindow(popup);
      setIsPopupOpen(true);

      // Check if popup is closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          setPopupWindow(null);
          setIsPopupOpen(false);
          clearInterval(checkClosed);
        }
      }, 1000);

      // Focus the popup
      popup.focus();
    }
  };

  const closePopup = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    setPopupWindow(null);
    setIsPopupOpen(false);
  };

  const toggleFullscreen = () => {
    if (!popupWindow || popupWindow.closed) {
      openPopup();
      setIsFullscreen(true);
      return;
    }

    if (isFullscreen) {
      // Restore to normal size
      popupWindow.resizeTo(1400, 900);
      popupWindow.moveTo((window.screen.width - 1400) / 2, (window.screen.height - 900) / 2);
      setIsFullscreen(false);
    } else {
      // Make fullscreen
      popupWindow.moveTo(0, 0);
      popupWindow.resizeTo(window.screen.width, window.screen.height);
      setIsFullscreen(true);
    }
    popupWindow.focus();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
    };
  }, [popupWindow]);

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
    <Card className="h-full" ref={containerRef}>
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
            variant="outline"
            size="sm"
            onClick={isPopupOpen ? closePopup : openPopup}
          >
            <Monitor className="h-4 w-4 mr-2" />
            {isPopupOpen ? 'Close Popup' : 'Open in Popup'}
          </Button>
          {isPopupOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              {isFullscreen ? 'Restore' : 'Fullscreen'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="text-lg font-medium">Social Media Management</div>
          <p className="text-muted-foreground">
            Access your Metricool dashboard to manage your social media accounts and campaigns.
          </p>

          {isPopupOpen ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Monitor className="h-5 w-5" />
                <span className="font-medium">Metricool dashboard is open in popup window</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The popup window provides full access to Metricool's features with proper authentication.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Button onClick={openPopup} size="lg" className="px-8">
                <Monitor className="h-5 w-5 mr-2" />
                Launch Metricool Dashboard
              </Button>
              <p className="text-sm text-muted-foreground">
                Click to open Metricool in a popup window with full functionality.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
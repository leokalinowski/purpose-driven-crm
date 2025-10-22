import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink, RefreshCw, Settings } from 'lucide-react';
import { useMetricoolLink } from '@/hooks/useMetricool';

interface MetricoolIframeProps {
  userId?: string;
}

export function MetricoolIframe({ userId }: MetricoolIframeProps) {
  const { data: metricoolLink, isLoading } = useMetricoolLink(userId);
  const [embedMode, setEmbedMode] = useState<'proxy' | 'direct'>('proxy');
  const [showDebug, setShowDebug] = useState(false);

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

  // Different embedding approaches
  const proxyUrl = `https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/metricool-proxy?url=${encodeURIComponent(metricoolLink.iframe_url)}`

  const getEmbedUrl = () => {
    switch (embedMode) {
      case 'proxy': return proxyUrl
      case 'direct': return metricoolLink.iframe_url
      default: return proxyUrl
    }
  }

  const getModeDescription = () => {
    switch (embedMode) {
      case 'proxy': return 'Uses Supabase Edge Function to bypass iframe restrictions'
      case 'direct': return 'Direct iframe embedding (likely blocked by Metricool)'
      default: return 'Proxy mode for best compatibility'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Metricool Dashboard</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Debug
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(metricoolLink.iframe_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Direct Link
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showDebug && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Embedding Test Modes</h4>
            <div className="flex gap-2 mb-2">
              <Button
                size="sm"
                variant={embedMode === 'proxy' ? 'default' : 'outline'}
                onClick={() => setEmbedMode('proxy')}
              >
                Proxy Mode
              </Button>
              <Button
                size="sm"
                variant={embedMode === 'direct' ? 'default' : 'outline'}
                onClick={() => setEmbedMode('direct')}
              >
                Direct Mode
              </Button>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{embedMode === 'proxy' ? 'Proxy Mode' : 'Direct Mode'}</strong>: {getModeDescription()}
            </p>
            <p className="text-xs text-gray-500 font-mono break-all">
              URL: {getEmbedUrl()}
            </p>
          </div>
        )}

        {/* Main iframe */}
        <div className="w-full">
          {embedMode === 'proxy' && (
            <div className="mb-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
              🔄 Using Supabase proxy to bypass Metricool's iframe restrictions
            </div>
          )}
          {embedMode === 'direct' && (
            <div className="mb-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
              ⚠️ Direct mode likely blocked by Metricool's security policies
            </div>
          )}
          <iframe
            key={embedMode} // Force reload when mode changes
            src={getEmbedUrl()}
            className="w-full h-[800px] border-0 rounded-lg"
            title="Metricool Dashboard"
            allow="clipboard-write; fullscreen; encrypted-media; autoplay; picture-in-picture"
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={(e) => {
              // Check if iframe loaded successfully
              try {
                const iframe = e.target as HTMLIFrameElement;
                console.log('Iframe loaded:', embedMode, iframe.src);
              } catch (error) {
                console.error('Iframe load error:', error);
              }
            }}
            onError={(e) => {
              console.error('Iframe failed to load:', embedMode, getEmbedUrl());
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

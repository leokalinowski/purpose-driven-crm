import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Webhook, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

interface WebhookStatus {
  isRegistered: boolean;
  webhookId?: string;
  lastSync?: string;
}

export function SupportWebhookManager() {
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  const checkWebhookStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('clickup_webhooks')
        .select('webhook_id, active, updated_at')
        .is('event_id', null)
        .eq('active', true)
        .maybeSingle();

      if (error) {
        console.error('Error checking webhook status:', error);
        setStatus({ isRegistered: false });
        return;
      }

      if (data) {
        setStatus({
          isRegistered: true,
          webhookId: data.webhook_id || undefined,
          lastSync: data.updated_at,
        });
      } else {
        setStatus({ isRegistered: false });
      }
    } catch (error) {
      console.error('Error checking webhook status:', error);
      setStatus({ isRegistered: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkWebhookStatus();
  }, []);

  const handleRegisterWebhook = async () => {
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-support-webhook');

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Webhook registered',
        description: data.already_exists 
          ? 'The webhook was already registered.' 
          : 'ClickUp webhook registered successfully. Status updates will now sync automatically.',
      });

      await checkWebhookStatus();
    } catch (error: any) {
      console.error('Failed to register webhook:', error);
      toast({
        title: 'Registration failed',
        description: error.message || 'Failed to register webhook with ClickUp',
        variant: 'destructive',
      });
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Support Ticket Webhook
        </CardTitle>
        <CardDescription>
          Sync status updates from ClickUp back to the Hub automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status?.isRegistered ? (
              <>
                <div className="p-2 rounded-full bg-primary/10">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Webhook Active</p>
                  <p className="text-sm text-muted-foreground">
                    Status changes in ClickUp will sync to the Hub
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 rounded-full bg-secondary">
                  <XCircle className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium">Webhook Not Registered</p>
                  <p className="text-sm text-muted-foreground">
                    Register to enable automatic status sync from ClickUp
                  </p>
                </div>
              </>
            )}
          </div>

          <Badge variant={status?.isRegistered ? 'default' : 'secondary'}>
            {status?.isRegistered ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {status?.isRegistered && status.lastSync && (
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date(status.lastSync).toLocaleString()}
          </div>
        )}

        <div className="flex gap-2">
          {!status?.isRegistered && (
            <Button 
              onClick={handleRegisterWebhook} 
              disabled={registering}
              className="gap-2"
            >
              {registering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Webhook className="h-4 w-4" />
                  Register Webhook
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={checkWebhookStatus}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Status
          </Button>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-4 mt-4">
          <p className="font-medium mb-1">How it works:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>When you change a ticket status in ClickUp, it updates here automatically</li>
            <li>Supported statuses: To Do → Open, In Progress → In Progress, Done/Complete → Resolved</li>
            <li>Assignee changes are also synced</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

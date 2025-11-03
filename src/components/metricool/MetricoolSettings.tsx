import { useState, useEffect } from 'react';
import { ExternalLink, Trash2, Save, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useMetricoolLink } from '@/hooks/useMetricool';
import { useMetricoolManagement } from '@/hooks/useMetricoolManagement';
import { toast } from '@/hooks/use-toast';

interface MetricoolSettingsProps {
  userId?: string;
  agentName?: string;
}

export function MetricoolSettings({ userId, agentName }: MetricoolSettingsProps) {
  const [iframeUrl, setIframeUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const { data: metricoolLink, isLoading } = useMetricoolLink(userId);
  const {
    createMetricoolLink,
    updateMetricoolLink,
    toggleMetricoolLinkStatus,
    deleteMetricoolLink,
  } = useMetricoolManagement();

  // Update local state when data loads
  useEffect(() => {
    if (metricoolLink) {
      setIframeUrl(metricoolLink.iframe_url);
      setIsEditing(false);
    } else {
      setIframeUrl('');
      setIsEditing(true);
    }
  }, [metricoolLink]);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      toast({
        title: "Validation Error",
        description: "URL cannot be empty",
        variant: "destructive",
      });
      return false;
    }

    if (!url.startsWith('https://app.metricool.com/')) {
      toast({
        title: "Validation Error",
        description: "URL must start with https://app.metricool.com/",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "No agent selected",
        variant: "destructive",
      });
      return;
    }

    if (!validateUrl(iframeUrl)) return;

    if (metricoolLink) {
      await updateMetricoolLink.mutateAsync({
        linkId: metricoolLink.id,
        iframeUrl: iframeUrl.trim(),
      });
    } else {
      await createMetricoolLink.mutateAsync({
        userId,
        iframeUrl: iframeUrl.trim(),
      });
    }
    setIsEditing(false);
  };

  const handleToggleStatus = async () => {
    if (!metricoolLink) return;

    await toggleMetricoolLinkStatus.mutateAsync({
      linkId: metricoolLink.id,
      isActive: !metricoolLink.is_active,
    });
  };

  const handleDelete = async () => {
    if (!metricoolLink) return;

    await deleteMetricoolLink.mutateAsync(metricoolLink.id);
    setIframeUrl('');
    setIsEditing(true);
  };

  const handleTestLink = () => {
    if (!validateUrl(iframeUrl)) return;
    window.open(iframeUrl, '_blank');
  };

  if (!userId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metricool Settings</CardTitle>
          <CardDescription>Select an agent to manage their Metricool integration</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metricool Settings</CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isSaving = createMetricoolLink.isPending || updateMetricoolLink.isPending;
  const isDeleting = deleteMetricoolLink.isPending;
  const isToggling = toggleMetricoolLinkStatus.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Metricool Settings</CardTitle>
            <CardDescription>
              Manage Metricool integration for {agentName || 'selected agent'}
            </CardDescription>
          </div>
          {metricoolLink && (
            <Badge variant={metricoolLink.is_active ? "default" : "secondary"}>
              {metricoolLink.is_active ? "Active" : "Inactive"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {metricoolLink && !isEditing ? (
          // View Mode
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current iframe URL</Label>
              <div className="flex items-center space-x-2">
                <Input
                  value={metricoolLink.iframe_url}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleTestLink}
                  title="Test link"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Link Status</Label>
                <p className="text-sm text-muted-foreground">
                  {metricoolLink.is_active ? 'Link is active and visible' : 'Link is inactive'}
                </p>
              </div>
              <Switch
                checked={metricoolLink.is_active}
                onCheckedChange={handleToggleStatus}
                disabled={isToggling}
              />
            </div>

            <div className="text-xs text-muted-foreground">
              Last updated: {new Date(metricoolLink.updated_at).toLocaleString()}
            </div>

            <div className="flex space-x-2">
              <Button onClick={() => setIsEditing(true)} className="flex-1">
                Edit URL
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Metricool Link?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the Metricool integration for this agent.
                      The agent will no longer see their dashboard or analytics.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          // Edit/Create Mode
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="iframe-url">
                Metricool iframe URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="iframe-url"
                value={iframeUrl}
                onChange={(e) => setIframeUrl(e.target.value)}
                placeholder="https://app.metricool.com/autoin/..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Must start with https://app.metricool.com/
              </p>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleTestLink}
                disabled={!iframeUrl.trim()}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Test Link
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !iframeUrl.trim()}
                className="flex-1"
              >
                {metricoolLink ? (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Link
                  </>
                )}
              </Button>
              {metricoolLink && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIframeUrl(metricoolLink.iframe_url);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

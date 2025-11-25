import { useState } from 'react';
import { Settings, ExternalLink, Edit, Trash2, Plus, Users, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAllMetricoolLinks, useMetricoolManagement } from '@/hooks/useMetricoolManagement';
import { useAgents } from '@/hooks/useAgents';
import { toast } from '@/hooks/use-toast';

export function MetricoolGlobalSettings() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: metricoolLinks, isLoading: linksLoading } = useAllMetricoolLinks();
  const { agents, getAgentDisplayName } = useAgents();
  const { createMetricoolLink, toggleMetricoolLinkStatus, deleteMetricoolLink } = useMetricoolManagement();

  const handleCreateLink = async () => {
    if (!selectedAgentId || !newUrl.trim()) return;

    if (!newUrl.startsWith('https://app.metricool.com/')) {
      toast({
        title: "Validation Error",
        description: "URL must start with https://app.metricool.com/",
        variant: "destructive",
      });
      return;
    }

    await createMetricoolLink.mutateAsync({
      userId: selectedAgentId,
      iframeUrl: newUrl.trim(),
    });

    setNewUrl('');
    setSelectedAgentId(null);
    setIsDialogOpen(false);
  };

  const handleToggleStatus = async (linkId: string, currentStatus: boolean) => {
    await toggleMetricoolLinkStatus.mutateAsync({
      linkId,
      isActive: !currentStatus,
    });
  };

  const handleDelete = async (linkId: string) => {
    await deleteMetricoolLink.mutateAsync(linkId);
  };

  const handleTestLink = (url: string) => {
    window.open(url, '_blank');
  };

  // Create a map of agent data for easy lookup
  const agentMap = new Map(agents.map(agent => [agent.user_id, agent]));

  // Create a comprehensive list of all agents with their Metricool status
  const agentLinks = agents.map(agent => {
    const link = metricoolLinks?.find(link => link.user_id === agent.user_id);
    return {
      agent,
      link,
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Global Metricool Settings
            </CardTitle>
            <CardDescription>
              Manage Metricool integrations for all agents
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Metricool Link</DialogTitle>
                <DialogDescription>
                  Create a new Metricool integration for an agent.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Agent</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={selectedAgentId || ''}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                  >
                    <option value="">Choose an agent...</option>
                    {agents
                      .filter(agent => !metricoolLinks?.some(link => link.user_id === agent.user_id))
                      .map(agent => (
                        <option key={agent.user_id} value={agent.user_id}>
                          {getAgentDisplayName(agent)}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metricool-url">Metricool iframe URL</Label>
                  <Input
                    id="metricool-url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://app.metricool.com/autoin/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Must start with https://app.metricool.com/
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateLink}
                  disabled={!selectedAgentId || !newUrl.trim() || createMetricoolLink.isPending}
                >
                  {createMetricoolLink.isPending ? 'Creating...' : 'Create Link'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {linksLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading Metricool links...</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentLinks.map(({ agent, link }) => (
                <TableRow key={agent.user_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {getAgentDisplayName(agent)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {link ? (
                      <Badge variant={link.is_active ? "default" : "secondary"}>
                        {link.is_active ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not Configured</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {link ? (
                      <div className="font-mono text-xs max-w-xs truncate">
                        {link.iframe_url}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {link ? (
                      <span className="text-xs text-muted-foreground">
                        {new Date(link.updated_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {link && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestLink(link.iframe_url)}
                            title="Test link"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(link.id, link.is_active)}
                            disabled={toggleMetricoolLinkStatus.isPending}
                            title={link.is_active ? "Deactivate" : "Activate"}
                          >
                            {link.is_active ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Metricool Link?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the Metricool integration for {getAgentDisplayName(agent)}.
                                  The agent will no longer see their dashboard or analytics.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(link.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                      {!link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAgentId(agent.user_id);
                            setIsDialogOpen(true);
                          }}
                          title="Add link"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {agentLinks.length === 0 && !linksLoading && (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No Agents Found</h3>
            <p className="text-muted-foreground">
              There are no agents configured in the system yet.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

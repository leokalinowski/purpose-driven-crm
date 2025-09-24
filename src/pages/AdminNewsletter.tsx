import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useAdminNewsletter } from "@/hooks/useAdminNewsletter";
import { NewsletterCostTracking } from "@/components/admin/NewsletterCostTracking";
import { CSVUploadManager } from "@/components/admin/CSVUploadManager";
import { AdminNewsletterPreview } from "@/components/admin/AdminNewsletterPreview";
import { NewsletterSendManager } from "@/components/admin/NewsletterSendManager";
import { formatDistanceToNow } from "date-fns";
import { CalendarDays, Send, Settings, TestTube, Users, DollarSign, Upload, FileText, Mail } from "lucide-react";
import { useState } from "react";
export default function AdminNewsletter() {
  const {
    agents,
    settings,
    runs,
    isLoading,
    isDryRun,
    setIsDryRun,
    updateSettings,
    triggerNewsletter,
    isUpdating,
    isTriggering,
  } = useAdminNewsletter();

  const [agentSettings, setAgentSettings] = useState<Record<string, { enabled: boolean; day: number; hour: number }>>({});

  const getAgentSettings = (agentId: string) => {
    const existing = settings.find(s => s.agent_id === agentId);
    const local = agentSettings[agentId];
    
    return {
      enabled: local?.enabled ?? existing?.enabled ?? false,
      day: local?.day ?? existing?.schedule_day ?? 1,
      hour: local?.hour ?? existing?.schedule_hour ?? 9,
    };
  };

  const updateAgentSettings = (agentId: string, updates: Partial<{ enabled: boolean; day: number; hour: number }>) => {
    setAgentSettings(prev => ({
      ...prev,
      [agentId]: { ...getAgentSettings(agentId), ...updates }
    }));
  };

  const saveAgentSettings = (agentId: string) => {
    const settings = getAgentSettings(agentId);
    updateSettings({
      agentId,
      enabled: settings.enabled,
      scheduleDay: settings.day,
      scheduleHour: settings.hour,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      running: "default",
      completed: "default",
      failed: "destructive",
    } as const;
    
    return <Badge variant={variants[status as keyof typeof variants] || "secondary"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading newsletter management...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Newsletter Management - Admin</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Newsletter Management</h1>
            <p className="text-muted-foreground">
              Manage monthly newsletter campaigns for agents
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              <Label htmlFor="dry-run">Test Mode</Label>
              <Switch
                id="dry-run"
                checked={isDryRun}
                onCheckedChange={setIsDryRun}
              />
            </div>
          </div>
        </div>

        <Tabs defaultValue="csv-upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="csv-upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              CSV Upload
            </TabsTrigger>
            <TabsTrigger value="test-preview" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Test Preview
            </TabsTrigger>
            <TabsTrigger value="send-newsletter" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Send Newsletter
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agent Settings
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Campaign History
            </TabsTrigger>
            <TabsTrigger value="costs" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv-upload" className="space-y-4">
            <CSVUploadManager />
          </TabsContent>

          <TabsContent value="test-preview" className="space-y-4">
            <AdminNewsletterPreview />
          </TabsContent>

          <TabsContent value="send-newsletter" className="space-y-4">
            <NewsletterSendManager />
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            {isDryRun && (
              <Card className="border-warning bg-warning/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-warning">
                    <TestTube className="h-4 w-4" />
                    <span className="font-medium">Test Mode Active</span>
                  </div>
                  <p className="text-sm text-warning/80 mt-1">
                    Test mode processes one ZIP code with full Grok research and sends only to your admin email with [TEST] prefix.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4">
              {agents.map((agent) => {
                const settings = getAgentSettings(agent.user_id);
                const displayName = agent.first_name && agent.last_name 
                  ? `${agent.first_name} ${agent.last_name}` 
                  : agent.email || 'Unknown Agent';

                return (
                  <Card key={agent.user_id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{displayName}</CardTitle>
                          <CardDescription>{agent.email}</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                disabled={isTriggering}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                {isDryRun ? 'Test Run' : 'Send Now'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {isDryRun ? 'Test Newsletter' : 'Send Newsletter'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {isDryRun 
                                    ? `This will run a test newsletter for ${displayName}. It processes only one ZIP code, makes full Grok API calls for research, generates the complete HTML email, and sends it only to you (the admin) with a [TEST] prefix.`
                                    : `This will send the monthly newsletter to all contacts for ${displayName}. This action cannot be undone.`
                                  }
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => triggerNewsletter({ agentId: agent.user_id })}
                                  className={isDryRun ? "bg-primary" : "bg-destructive hover:bg-destructive/90"}
                                >
                                  {isDryRun ? 'Run Test' : 'Send Newsletter'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`enabled-${agent.user_id}`}>Enable Monthly Newsletter</Label>
                        <Switch
                          id={`enabled-${agent.user_id}`}
                          checked={settings.enabled}
                          onCheckedChange={(enabled) => updateAgentSettings(agent.user_id, { enabled })}
                        />
                      </div>

                      {settings.enabled && (
                        <>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`day-${agent.user_id}`}>Day of Month</Label>
                              <Input
                                id={`day-${agent.user_id}`}
                                type="number"
                                min="1"
                                max="31"
                                value={settings.day}
                                onChange={(e) => updateAgentSettings(agent.user_id, { day: parseInt(e.target.value) || 1 })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`hour-${agent.user_id}`}>Hour (24h format)</Label>
                              <Input
                                id={`hour-${agent.user_id}`}
                                type="number"
                                min="0"
                                max="23"
                                value={settings.hour}
                                onChange={(e) => updateAgentSettings(agent.user_id, { hour: parseInt(e.target.value) || 9 })}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => saveAgentSettings(agent.user_id)}
                          disabled={isUpdating}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Save Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Campaign Runs</CardTitle>
                <CardDescription>
                  View the history of newsletter campaigns and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No newsletter campaigns have been run yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {runs.map((run) => {
                      const agent = agents.find(a => a.user_id === run.agent_id);
                      const displayName = agent?.first_name && agent?.last_name 
                        ? `${agent.first_name} ${agent.last_name}` 
                        : agent?.email || 'Unknown Agent';

                      return (
                        <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{displayName}</span>
                              {run.dry_run && (
                                <Badge variant="outline" className="text-xs">
                                  <TestTube className="h-3 w-3 mr-1" />
                                  Test
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {run.run_date} • {formatDistanceToNow(new Date(run.created_at))} ago
                            </div>
                            {run.error && (
                              <div className="text-sm text-destructive">{run.error}</div>
                            )}
                          </div>
                          <div className="text-right space-y-1">
                            {getStatusBadge(run.status)}
                            <div className="text-sm text-muted-foreground">
                              {run.emails_sent} emails • {run.contacts_processed} contacts
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            <NewsletterCostTracking />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
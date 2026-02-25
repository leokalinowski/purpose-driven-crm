import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAdminNewsletter } from "@/hooks/useAdminNewsletter";
import { AdminNewsletterTemplates } from "@/components/admin/AdminNewsletterTemplates";
import { AdminNewsletterCampaigns } from "@/components/admin/AdminNewsletterCampaigns";
import { CSVUploadManager } from "@/components/admin/CSVUploadManager";
import { AdminNewsletterPreview } from "@/components/admin/AdminNewsletterPreview";
import { FileText, BarChart3, Settings, Database, Users } from "lucide-react";
import { useState } from "react";

export default function AdminNewsletter() {
  const {
    agents,
    settings,
    templates,
    campaigns,
    isLoading,
    updateSettings,
    isUpdating,
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
    const s = getAgentSettings(agentId);
    updateSettings({ agentId, enabled: s.enabled, scheduleDay: s.day, scheduleHour: s.hour });
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
        <div>
          <h1 className="text-3xl font-bold">Newsletter Management</h1>
          <p className="text-muted-foreground">
            Manage templates, campaigns, and agent settings
          </p>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="agent-settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Agent Settings
            </TabsTrigger>
            <TabsTrigger value="market-data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Market Data
            </TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <AdminNewsletterTemplates templates={templates} agents={agents} />
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns">
            <AdminNewsletterCampaigns campaigns={campaigns} />
          </TabsContent>

          {/* Agent Settings Tab */}
          <TabsContent value="agent-settings" className="space-y-4">
            <div className="grid gap-4">
              {agents.map((agent) => {
                const s = getAgentSettings(agent.user_id);
                const displayName = agent.first_name && agent.last_name
                  ? `${agent.first_name} ${agent.last_name}`
                  : agent.email || 'Unknown Agent';

                return (
                  <Card key={agent.user_id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{displayName}</CardTitle>
                          <CardDescription>{agent.email}</CardDescription>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {agent.contact_count || 0} contacts
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              {agent.template_count || 0} templates
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`enabled-${agent.user_id}`} className="text-sm">Enabled</Label>
                          <Switch
                            id={`enabled-${agent.user_id}`}
                            checked={s.enabled}
                            onCheckedChange={(enabled) => updateAgentSettings(agent.user_id, { enabled })}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    {s.enabled && (
                      <CardContent className="space-y-4">
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`day-${agent.user_id}`}>Day of Month</Label>
                            <Input
                              id={`day-${agent.user_id}`}
                              type="number" min="1" max="31"
                              value={s.day}
                              onChange={(e) => updateAgentSettings(agent.user_id, { day: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`hour-${agent.user_id}`}>Hour (24h)</Label>
                            <Input
                              id={`hour-${agent.user_id}`}
                              type="number" min="0" max="23"
                              value={s.hour}
                              onChange={(e) => updateAgentSettings(agent.user_id, { hour: parseInt(e.target.value) || 9 })}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => saveAgentSettings(agent.user_id)} disabled={isUpdating}>
                            <Settings className="h-4 w-4 mr-2" />
                            Save Settings
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Market Data Tab */}
          <TabsContent value="market-data" className="space-y-6">
            <CSVUploadManager />
            <Card>
              <CardHeader>
                <CardTitle>Newsletter Preview</CardTitle>
                <CardDescription>Test AI-generated newsletter with a ZIP code (legacy pipeline)</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminNewsletterPreview />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

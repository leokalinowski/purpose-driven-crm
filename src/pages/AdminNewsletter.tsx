import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAdminNewsletter } from "@/hooks/useAdminNewsletter";
import { AdminNewsletterTemplates } from "@/components/admin/AdminNewsletterTemplates";
import { AdminNewsletterCampaigns } from "@/components/admin/AdminNewsletterCampaigns";
import { FileText, BarChart3, Settings, Users } from "lucide-react";

export default function AdminNewsletter() {
  const {
    agents,
    settings,
    templates,
    campaigns,
    isLoading,
    updateSettings,
    isUpdating,
    deleteTemplate,
    duplicateTemplate,
  } = useAdminNewsletter();

  const getAgentEnabled = (agentId: string) => {
    const existing = settings.find(s => s.agent_id === agentId);
    return existing?.enabled ?? false;
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
          <TabsList className="grid w-full grid-cols-3">
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
          </TabsList>

          <TabsContent value="templates">
            <AdminNewsletterTemplates templates={templates} agents={agents} onDelete={deleteTemplate} onDuplicate={duplicateTemplate} />
          </TabsContent>

          <TabsContent value="campaigns">
            <AdminNewsletterCampaigns campaigns={campaigns} />
          </TabsContent>

          <TabsContent value="agent-settings" className="space-y-4">
            <div className="grid gap-4">
              {agents.map((agent) => {
                const enabled = getAgentEnabled(agent.user_id);
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
                        <div className="flex items-center gap-3">
                          <Badge variant={enabled ? 'default' : 'secondary'} className="text-xs">
                            {enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          <Switch
                            id={`enabled-${agent.user_id}`}
                            checked={enabled}
                            disabled={isUpdating}
                            onCheckedChange={(checked) => updateSettings({ agentId: agent.user_id, enabled: checked })}
                          />
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

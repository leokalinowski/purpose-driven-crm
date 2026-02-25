import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminNewsletter } from "@/hooks/useAdminNewsletter";
import { AdminNewsletterTemplates } from "@/components/admin/AdminNewsletterTemplates";
import { AdminNewsletterCampaigns } from "@/components/admin/AdminNewsletterCampaigns";
import { FileText, BarChart3, Users, Plus, Eye, Mail, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function AdminNewsletter() {
  const navigate = useNavigate();
  const {
    agents,
    templates,
    campaigns,
    isLoading,
    deleteTemplate,
    duplicateTemplate,
  } = useAdminNewsletter();

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
            Manage templates, campaigns, and agent readiness
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
            <TabsTrigger value="agent-overview" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agent Overview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <AdminNewsletterTemplates templates={templates} agents={agents} onDelete={deleteTemplate} onDuplicate={duplicateTemplate} />
          </TabsContent>

          <TabsContent value="campaigns">
            <AdminNewsletterCampaigns campaigns={campaigns} />
          </TabsContent>

          <TabsContent value="agent-overview" className="space-y-4">
            <div className="grid gap-4">
              {agents.map((agent) => {
                const displayName = agent.first_name && agent.last_name
                  ? `${agent.first_name} ${agent.last_name}`
                  : agent.email || 'Unknown Agent';
                const lc = agent.last_campaign;

                return (
                  <Card key={agent.user_id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{displayName}</CardTitle>
                          <CardDescription>{agent.email}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/newsletter-builder?agent=${agent.user_id}`)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Create Template
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const el = document.querySelector('[value="templates"]') as HTMLElement;
                              el?.click();
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View Templates
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{agent.contact_count || 0}</div>
                            <div className="text-muted-foreground text-xs">Contacts with email</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{agent.template_count || 0}</div>
                            <div className="text-muted-foreground text-xs">Templates</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {lc?.send_date
                                ? format(new Date(lc.send_date), 'MMM d, yyyy')
                                : 'Never'}
                            </div>
                            <div className="text-muted-foreground text-xs">Last sent</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {lc ? (
                                <>
                                  {lc.recipient_count ?? 0} sent
                                  {lc.open_rate != null && (
                                    <span className="text-muted-foreground ml-1">
                                      · {(lc.open_rate * 100).toFixed(0)}% opens
                                    </span>
                                  )}
                                </>
                              ) : (
                                '—'
                              )}
                            </div>
                            <div className="text-muted-foreground text-xs">Last campaign</div>
                          </div>
                        </div>
                      </div>
                      {lc && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant={lc.status === 'sent' ? 'default' : 'secondary'} className="text-xs">
                            {lc.status || 'unknown'}
                          </Badge>
                          <span>{lc.campaign_name}</span>
                        </div>
                      )}
                    </CardContent>
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

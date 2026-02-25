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
import { FileText, BarChart3, Users, Plus, Eye, Mail, Calendar, TrendingUp, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AdminNewsletter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    agents,
    templates,
    campaigns,
    isLoading,
    deleteTemplate,
    duplicateTemplate,
  } = useAdminNewsletter();

  const [aiDialogAgent, setAiDialogAgent] = useState<{ user_id: string; name: string } | null>(null);
  const [topicHint, setTopicHint] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAI = async () => {
    if (!aiDialogAgent) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-newsletter', {
        body: { agent_id: aiDialogAgent.user_id, topic_hint: topicHint || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'AI Newsletter Generated', description: `Draft created with ${data.block_count} blocks. Redirecting to editor...` });
      setAiDialogAgent(null);
      setTopicHint('');
      navigate(`/newsletter-builder/${data.template_id}`);
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
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
                            variant="default"
                            size="sm"
                            onClick={() => setAiDialogAgent({ user_id: agent.user_id, name: displayName })}
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            AI Newsletter
                          </Button>
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
                            <div className="text-muted-foreground text-xs">Total contacts</div>
                            <div className="text-muted-foreground text-xs">{agent.email_contact_count || 0} with email</div>
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

      {/* AI Newsletter Generation Dialog */}
      <Dialog open={!!aiDialogAgent} onOpenChange={(open) => { if (!open) { setAiDialogAgent(null); setTopicHint(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate AI Newsletter
            </DialogTitle>
            <DialogDescription>
              Create an AI-generated newsletter draft for {aiDialogAgent?.name}. The AI will use their branding, tone guidelines, and content preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="topic-hint">Topic or Theme (optional)</Label>
              <Input
                id="topic-hint"
                placeholder="e.g. Summer market update, Home maintenance tips..."
                value={topicHint}
                onChange={(e) => setTopicHint(e.target.value)}
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for a general market update newsletter.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAiDialogAgent(null); setTopicHint(''); }} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerateAI} disabled={isGenerating}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

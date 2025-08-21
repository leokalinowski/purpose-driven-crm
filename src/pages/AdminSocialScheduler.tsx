import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Calendar, BarChart3, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/layout/Layout';
import { SocialPostForm } from '@/components/social/SocialPostForm';
import { SocialCalendar } from '@/components/social/SocialCalendar';
import { SocialAnalytics } from '@/components/social/SocialAnalytics';
import { SocialCSVUpload } from '@/components/social/SocialCSVUpload';
import { ConnectSocialAccounts } from '@/components/social/ConnectSocialAccounts';
import { useSocialAccounts } from '@/hooks/useSocialScheduler';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Agent {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export default function AdminSocialScheduler() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false);
  const [isCSVDialogOpen, setIsCSVDialogOpen] = useState(false);

  // Fetch all agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, email')
        .eq('role', 'agent')
        .order('first_name');

      if (error) throw error;
      return data as Agent[];
    },
  });

  const { data: accounts = [] } = useSocialAccounts(selectedAgentId);

  const selectedAgent = agents.find(agent => agent.user_id === selectedAgentId);

  const handlePostSuccess = () => {
    setIsPostDialogOpen(false);
  };

  const getAgentDisplayName = (agent: Agent) => {
    if (agent.first_name || agent.last_name) {
      return `${agent.first_name || ''} ${agent.last_name || ''}`.trim();
    }
    return agent.email || 'Unknown Agent';
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 space-y-6">
      <Helmet>
        <title>Admin Social Media Scheduler | Real Estate on Purpose</title>
        <meta
          name="description"
          content="Manage social media scheduling and analytics for all agents. Monitor performance across the team."
        />
      </Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Media Management</h1>
          <p className="text-muted-foreground">
            Manage social media content and analytics for all agents
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Dialog open={isCSVDialogOpen} onOpenChange={setIsCSVDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!selectedAgentId}>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Bulk Upload Posts
                  {selectedAgent && ` - ${getAgentDisplayName(selectedAgent)}`}
                </DialogTitle>
              </DialogHeader>
              <SocialCSVUpload agentId={selectedAgentId} />
            </DialogContent>
          </Dialog>
          
          <Dialog open={isPostDialogOpen} onOpenChange={setIsPostDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedAgentId}>
                <Plus className="mr-2 h-4 w-4" />
                New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Create New Post
                  {selectedAgent && ` - ${getAgentDisplayName(selectedAgent)}`}
                </DialogTitle>
              </DialogHeader>
              <SocialPostForm agentId={selectedAgentId} onSuccess={handlePostSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <Label htmlFor="agent-select">Select Agent:</Label>
          </div>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger id="agent-select" className="w-64">
              <SelectValue placeholder="Choose an agent..." />
            </SelectTrigger>
            <SelectContent>
              {agentsLoading ? (
                <SelectItem value="loading" disabled>
                  Loading agents...
                </SelectItem>
              ) : agents.length === 0 ? (
                <SelectItem value="no-agents" disabled>
                  No agents found
                </SelectItem>
              ) : (
                agents.map((agent) => (
                  <SelectItem key={agent.user_id} value={agent.user_id}>
                    {getAgentDisplayName(agent)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedAgentId && accounts.length === 0 && (
          <ConnectSocialAccounts agentId={selectedAgentId} connectedAccounts={accounts} />
        )}
      </div>

      {selectedAgentId ? (
        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Accounts ({accounts.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <SocialCalendar agentId={selectedAgentId} />
          </TabsContent>

          <TabsContent value="analytics">
            <SocialAnalytics agentId={selectedAgentId} />
          </TabsContent>

          <TabsContent value="accounts">
            <ConnectSocialAccounts agentId={selectedAgentId} connectedAccounts={accounts} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Select an Agent</h3>
          <p className="text-muted-foreground">
            Choose an agent from the dropdown above to view and manage their social media content.
          </p>
        </div>
      )}
      </div>
    </Layout>
  );
}
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { BarChart3, Settings, Users, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/layout/Layout';
import { MetricoolDashboard } from '@/components/metricool/MetricoolDashboard';
import { MetricoolAnalytics } from '@/components/metricool/MetricoolAnalytics';
import { MetricoolSettings } from '@/components/metricool/MetricoolSettings';
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
  const [activeTab, setActiveTab] = useState('dashboard');

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

  const selectedAgent = agents.find(agent => agent.user_id === selectedAgentId);

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
          <title>Admin Social Media Management | Real Estate on Purpose</title>
          <meta
            name="description"
            content="Manage social media accounts and analytics for all agents. Monitor performance across the team."
          />
        </Helmet>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Social Media Management</h1>
            <p className="text-muted-foreground">
              Manage Metricool accounts and analytics for all agents
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Global Settings
            </Button>
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

          {selectedAgentId ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center space-x-2">
                  <Wrench className="h-4 w-4" />
                  <span>Settings</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <MetricoolDashboard userId={selectedAgentId} />
              </TabsContent>

              <TabsContent value="analytics">
                <MetricoolAnalytics agentId={selectedAgentId} />
              </TabsContent>

              <TabsContent value="settings">
                <MetricoolSettings 
                  userId={selectedAgentId} 
                  agentName={selectedAgent ? getAgentDisplayName(selectedAgent) : undefined}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Select an Agent</h3>
              <p className="text-muted-foreground">
                Choose an agent from the dropdown above to view and manage their Metricool account.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
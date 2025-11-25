import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Settings, Users, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/layout/Layout';
import { MetricoolDashboard } from '@/components/metricool/MetricoolDashboard';
import { MetricoolSettings } from '@/components/metricool/MetricoolSettings';
import { AgentSelector } from '@/components/admin/AgentSelector';
import { useAgents } from '@/hooks/useAgents';

export default function AdminSocialScheduler() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { agents, getAgentDisplayName, fetchAgents } = useAgents();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const selectedAgent = agents.find(agent => agent.user_id === selectedAgentId);

  return (
    <Layout>
      <div className="space-y-6">
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
              <Label>Select Person:</Label>
            </div>
            <AgentSelector 
              selectedAgentId={selectedAgentId} 
              onAgentSelect={setSelectedAgentId}
            />
          </div>

          {selectedAgentId ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center space-x-2">
                  <Wrench className="h-4 w-4" />
                  <span>Settings</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <MetricoolDashboard key={selectedAgentId} userId={selectedAgentId} />
              </TabsContent>

              <TabsContent value="settings">
                <MetricoolSettings 
                  key={selectedAgentId}
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
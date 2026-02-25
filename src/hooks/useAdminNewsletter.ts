import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { NewsletterBlock, GlobalStyles } from '@/components/newsletter/builder/types';
import { DEFAULT_GLOBAL_STYLES } from '@/components/newsletter/builder/types';

export interface AgentProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  contact_count?: number;
  email_contact_count?: number;
  template_count?: number;
  last_campaign?: {
    campaign_name: string;
    send_date: string | null;
    recipient_count: number | null;
    open_rate: number | null;
    status: string | null;
  } | null;
}

export interface AdminTemplate {
  id: string;
  agent_id: string;
  name: string;
  blocks_json: NewsletterBlock[];
  global_styles: GlobalStyles;
  thumbnail_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  agent_name?: string;
}

export interface AdminCampaign {
  id: string;
  campaign_name: string;
  send_date: string | null;
  recipient_count: number | null;
  open_rate: number | null;
  click_through_rate: number | null;
  status: string | null;
  created_at: string;
  created_by: string | null;
  agent_name?: string;
}

export function useAdminNewsletter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all agents (agents + admins)
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['agent', 'admin']);
      if (rolesError) throw rolesError;

      const userIds = Array.from(new Set((roles || []).map(r => r.user_id)));
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds)
        .order('first_name');
      if (profilesError) throw profilesError;

      return profiles as AgentProfile[];
    },
  });

  // Fetch total + email contact counts per agent
  const { data: contactCounts = {} } = useQuery({
    queryKey: ['agent-contact-counts-all', agents.map(a => a.user_id)],
    queryFn: async () => {
      const counts: Record<string, { total: number; withEmail: number }> = {};
      const results = await Promise.all(
        agents.map(async (agent) => {
          const [totalRes, emailRes] = await Promise.all([
            supabase
              .from('contacts')
              .select('id', { count: 'exact', head: true })
              .eq('agent_id', agent.user_id),
            supabase
              .from('contacts')
              .select('id', { count: 'exact', head: true })
              .eq('agent_id', agent.user_id)
              .not('email', 'is', null)
              .neq('email', ''),
          ]);
          return {
            agentId: agent.user_id,
            total: totalRes.count || 0,
            withEmail: emailRes.count || 0,
          };
        })
      );
      results.forEach(r => { counts[r.agentId] = { total: r.total, withEmail: r.withEmail }; });
      return counts;
    },
    enabled: agents.length > 0,
  });

  // Fetch last campaign per agent
  const { data: lastCampaigns = {} } = useQuery({
    queryKey: ['agent-last-campaigns', agents.map(a => a.user_id)],
    queryFn: async () => {
      const map: Record<string, AgentProfile['last_campaign']> = {};
      // Fetch recent campaigns, grouped by created_by
      const { data, error } = await supabase
        .from('newsletter_campaigns')
        .select('campaign_name,send_date,recipient_count,open_rate,status,created_by')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      // Pick the first (most recent) campaign per created_by
      for (const row of data || []) {
        if (row.created_by && !map[row.created_by]) {
          map[row.created_by] = {
            campaign_name: row.campaign_name,
            send_date: row.send_date,
            recipient_count: row.recipient_count,
            open_rate: row.open_rate,
            status: row.status,
          };
        }
      }
      return map;
    },
    enabled: agents.length > 0,
  });

  // Fetch ALL templates across agents (admin view)
  const { data: allTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['admin-all-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        blocks_json: (t.blocks_json || []) as NewsletterBlock[],
        global_styles: { ...DEFAULT_GLOBAL_STYLES, ...(t.global_styles || {}) } as GlobalStyles,
      })) as AdminTemplate[];
    },
  });

  // Fetch newsletter_campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['admin-newsletter-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_campaigns')
        .select('id,campaign_name,send_date,recipient_count,open_rate,click_through_rate,status,created_at,created_by')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const rows = (data || []) as AdminCampaign[];

      const creatorIds = [...new Set(rows.map(c => c.created_by).filter(Boolean))] as string[];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', creatorIds);
        const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
        for (const c of rows) {
          if (c.created_by) c.agent_name = profileMap.get(c.created_by) || undefined;
        }
      }
      return rows;
    },
  });

  // Merge templates with agent names
  const templatesWithAgents: AdminTemplate[] = allTemplates.map(t => {
    const agent = agents.find(a => a.user_id === t.agent_id);
    return {
      ...t,
      agent_name: agent ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email || 'Unknown' : 'Unknown',
    };
  });

  // Template counts per agent
  const templateCounts: Record<string, number> = {};
  allTemplates.forEach(t => { templateCounts[t.agent_id] = (templateCounts[t.agent_id] || 0) + 1; });

  // Merge contact counts + template counts + last campaign with agents
  const agentsWithCounts: AgentProfile[] = agents.map(agent => ({
    ...agent,
    contact_count: contactCounts[agent.user_id]?.total || 0,
    email_contact_count: contactCounts[agent.user_id]?.withEmail || 0,
    template_count: templateCounts[agent.user_id] || 0,
    last_campaign: lastCampaigns[agent.user_id] || null,
  }));

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('newsletter_templates').delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-templates'] });
      toast({ title: "Template deleted" });
    },
    onError: (error) => {
      toast({ title: "Error deleting template", description: error.message, variant: "destructive" });
    },
  });

  // Duplicate template to another agent
  const duplicateTemplateMutation = useMutation({
    mutationFn: async ({ templateId, targetAgentId }: { templateId: string; targetAgentId: string }) => {
      const source = allTemplates.find(t => t.id === templateId);
      if (!source) throw new Error('Template not found');
      const { error } = await supabase.from('newsletter_templates').insert({
        agent_id: targetAgentId,
        name: `${source.name} (Copy)`,
        blocks_json: source.blocks_json as any,
        global_styles: source.global_styles as any,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-templates'] });
      toast({ title: "Template copied" });
    },
    onError: (error) => {
      toast({ title: "Error copying template", description: error.message, variant: "destructive" });
    },
  });

  return {
    agents: agentsWithCounts,
    templates: templatesWithAgents,
    campaigns,
    isLoading: agentsLoading || templatesLoading || campaignsLoading,
    deleteTemplate: deleteTemplateMutation.mutate,
    duplicateTemplate: duplicateTemplateMutation.mutate,
  };
}

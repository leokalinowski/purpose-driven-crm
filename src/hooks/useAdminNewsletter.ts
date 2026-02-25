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
  template_count?: number;
}

export interface NewsletterSettings {
  id: string;
  agent_id: string;
  enabled: boolean;
  schedule_day: number | null;
  schedule_hour: number | null;
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

  // Fetch newsletter settings
  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ['newsletter-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('newsletter_settings').select('*');
      if (error) throw error;
      return data as NewsletterSettings[];
    },
  });

  // Fetch contact counts per agent
  const { data: contactCounts = {} } = useQuery({
    queryKey: ['agent-contact-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('agent_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((c) => { counts[c.agent_id] = (counts[c.agent_id] || 0) + 1; });
      return counts;
    },
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

      // Resolve agent names
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

  // Merge contact counts + template counts with agents
  const agentsWithCounts: AgentProfile[] = agents.map(agent => ({
    ...agent,
    contact_count: contactCounts[agent.user_id] || 0,
    template_count: templateCounts[agent.user_id] || 0,
  }));

  // Update newsletter settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async ({ agentId, enabled }: { agentId: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from('newsletter_settings')
        .upsert({ agent_id: agentId, enabled }, { onConflict: 'agent_id' })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-settings'] });
      toast({ title: "Settings updated" });
    },
    onError: (error) => {
      toast({ title: "Error updating settings", description: error.message, variant: "destructive" });
    },
  });

  return {
    agents: agentsWithCounts,
    settings,
    templates: templatesWithAgents,
    campaigns,
    isLoading: agentsLoading || settingsLoading || templatesLoading || campaignsLoading,
    updateSettings: updateSettingsMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
  };
}

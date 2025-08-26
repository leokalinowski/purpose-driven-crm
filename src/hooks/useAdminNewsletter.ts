import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AgentProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface NewsletterSettings {
  id: string;
  agent_id: string;
  enabled: boolean;
  schedule_day: number | null;
  schedule_hour: number | null;
}

export interface MonthlyRun {
  id: string;
  agent_id: string;
  run_date: string;
  status: string;
  emails_sent: number;
  contacts_processed: number;
  zip_codes_processed: number;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  dry_run: boolean;
  created_at: string;
}

export function useAdminNewsletter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDryRun, setIsDryRun] = useState(true);

  // Fetch all agents (including admin users for testing)
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('role', ['agent', 'admin']);
      
      if (error) throw error;
      return data as AgentProfile[];
    },
  });

  // Fetch newsletter settings
  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ['newsletter-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_settings')
        .select('*');
      
      if (error) throw error;
      return data as NewsletterSettings[];
    },
  });

  // Fetch monthly runs
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['monthly-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as MonthlyRun[];
    },
  });

  // Update newsletter settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async ({ 
      agentId, 
      enabled, 
      scheduleDay, 
      scheduleHour 
    }: {
      agentId: string;
      enabled: boolean;
      scheduleDay?: number;
      scheduleHour?: number;
    }) => {
      const { data, error } = await supabase
        .from('newsletter_settings')
        .upsert({
          agent_id: agentId,
          enabled,
          schedule_day: scheduleDay,
          schedule_hour: scheduleHour,
        }, {
          onConflict: 'agent_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-settings'] });
      toast({
        title: "Settings updated",
        description: "Newsletter settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manual trigger mutation
  const triggerNewsletterMutation = useMutation({
    mutationFn: async ({ agentId }: { agentId: string }) => {
      const { data, error } = await supabase.functions.invoke('newsletter-monthly', {
        body: {
          mode: 'user',
          user_id: agentId,
          dry_run: isDryRun,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-runs'] });
      toast({
        title: "Newsletter triggered",
        description: `Newsletter ${isDryRun ? 'test' : 'send'} has been initiated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error triggering newsletter",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    agents,
    settings,
    runs,
    isLoading: agentsLoading || settingsLoading || runsLoading,
    isDryRun,
    setIsDryRun,
    updateSettings: updateSettingsMutation.mutate,
    triggerNewsletter: triggerNewsletterMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
    isTriggering: triggerNewsletterMutation.isPending,
  };
}
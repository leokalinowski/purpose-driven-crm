import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface AgentMarketingSettings {
  id: string;
  user_id: string;
  // Branding
  primary_color: string | null;
  secondary_color: string | null;
  headshot_url: string | null;
  logo_colored_url: string | null;
  logo_white_url: string | null;
  // Content Guidelines
  gpt_prompt: string | null;
  brand_guidelines: string | null;
  example_copy: string | null;
  target_audience: string | null;
  tone_guidelines: string | null;
  what_not_to_say: string | null;
  thumbnail_guidelines: string | null;
  // Integration IDs
  metricool_brand_id: string | null;
  metricool_creds: Json | null;
  clickup_editing_task_list_id: string | null;
  clickup_video_deliverables_list_id: string | null;
  shade_folder_id: string | null;
  editors: string[] | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type AgentMarketingSettingsInput = Partial<Omit<AgentMarketingSettings, 'id' | 'created_at' | 'updated_at' | 'user_id'>>;

export const useAgentMarketingSettings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSettings = useCallback(async (userId: string): Promise<AgentMarketingSettings | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('agent_marketing_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      return data as AgentMarketingSettings | null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch marketing settings';
      console.error('[useAgentMarketingSettings] fetchSettings error:', err);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createSettings = useCallback(async (userId: string, data?: AgentMarketingSettingsInput): Promise<AgentMarketingSettings | null> => {
    try {
      setLoading(true);
      setError(null);

      const insertData = { user_id: userId, ...data };

      const { data: created, error: createError } = await supabase
        .from('agent_marketing_settings')
        .insert(insertData)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      toast({
        title: 'Settings created',
        description: 'Marketing settings have been initialized.',
      });

      return created as AgentMarketingSettings;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create marketing settings';
      console.error('[useAgentMarketingSettings] createSettings error:', err);
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateSettings = useCallback(async (userId: string, data: AgentMarketingSettingsInput): Promise<AgentMarketingSettings | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: updated, error: updateError } = await supabase
        .from('agent_marketing_settings')
        .update(data)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      toast({
        title: 'Settings updated',
        description: 'Marketing settings have been saved.',
      });

      return updated as AgentMarketingSettings;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update marketing settings';
      console.error('[useAgentMarketingSettings] updateSettings error:', err);
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const upsertSettings = useCallback(async (userId: string, data: AgentMarketingSettingsInput): Promise<AgentMarketingSettings | null> => {
    try {
      setLoading(true);
      setError(null);

      const upsertData = { user_id: userId, ...data };

      const { data: upserted, error: upsertError } = await supabase
        .from('agent_marketing_settings')
        .upsert(upsertData, { onConflict: 'user_id' })
        .select()
        .single();

      if (upsertError) {
        throw upsertError;
      }

      toast({
        title: 'Settings saved',
        description: 'Marketing settings have been saved.',
      });

      return upserted as AgentMarketingSettings;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save marketing settings';
      console.error('[useAgentMarketingSettings] upsertSettings error:', err);
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    error,
    fetchSettings,
    createSettings,
    updateSettings,
    upsertSettings,
  };
};

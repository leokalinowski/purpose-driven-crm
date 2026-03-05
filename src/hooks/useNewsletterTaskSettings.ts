import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type NewsletterFrequency = 'weekly' | 'biweekly' | 'monthly';

export type NewsletterTaskSettings = {
  id: string;
  agent_id: string;
  frequency: NewsletterFrequency;
  day_of_month: number;
  enabled: boolean;
};

const DEFAULTS: Omit<NewsletterTaskSettings, 'id' | 'agent_id'> = {
  frequency: 'monthly',
  day_of_month: 15,
  enabled: true,
};

export function useNewsletterTaskSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NewsletterTaskSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('newsletter_task_settings' as any)
      .select('*')
      .eq('agent_id', user.id)
      .maybeSingle();
    setSettings(data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async (updates: Partial<Pick<NewsletterTaskSettings, 'frequency' | 'day_of_month' | 'enabled'>>) => {
    if (!user) return;
    const payload = {
      agent_id: user.id,
      frequency: updates.frequency ?? settings?.frequency ?? DEFAULTS.frequency,
      day_of_month: updates.day_of_month ?? settings?.day_of_month ?? DEFAULTS.day_of_month,
      enabled: updates.enabled ?? settings?.enabled ?? DEFAULTS.enabled,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase as any)
      .from('newsletter_task_settings')
      .upsert(payload, { onConflict: 'agent_id' })
      .select()
      .single();

    if (error) {
      toast.error('Failed to save newsletter settings');
      console.error(error);
      return;
    }
    setSettings(data);
    toast.success('Newsletter schedule saved');
  };

  return {
    settings,
    defaults: DEFAULTS,
    loading,
    save,
    refresh: fetch,
  };
}

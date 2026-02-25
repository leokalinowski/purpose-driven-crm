import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { NewsletterBlock, GlobalStyles, DEFAULT_GLOBAL_STYLES } from '@/components/newsletter/builder/types';

export interface NewsletterTemplate {
  id: string;
  agent_id: string;
  name: string;
  blocks_json: NewsletterBlock[];
  global_styles: GlobalStyles;
  thumbnail_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useNewsletterTemplates(agentId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const effectiveAgentId = agentId || user?.id;

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['newsletter-templates', effectiveAgentId],
    queryFn: async () => {
      let query = supabase.from('newsletter_templates').select('*').order('updated_at', { ascending: false });
      if (effectiveAgentId) query = query.eq('agent_id', effectiveAgentId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        blocks_json: (t.blocks_json || []) as NewsletterBlock[],
        global_styles: { ...DEFAULT_GLOBAL_STYLES, ...(t.global_styles || {}) } as GlobalStyles,
      })) as NewsletterTemplate[];
    },
    enabled: !!effectiveAgentId,
  });

  const saveMutation = useMutation({
    mutationFn: async (template: Partial<NewsletterTemplate> & { id?: string; agent_id: string }) => {
      const payload = {
        agent_id: template.agent_id,
        name: template.name || 'Untitled Template',
        blocks_json: JSON.parse(JSON.stringify(template.blocks_json || [])) as Json,
        global_styles: JSON.parse(JSON.stringify(template.global_styles || DEFAULT_GLOBAL_STYLES)) as Json,
        is_active: template.is_active ?? true,
        created_by: template.created_by || user?.id,
        updated_at: new Date().toISOString(),
      };
      if (template.id) {
        const { data, error } = await supabase.from('newsletter_templates').update(payload).eq('id', template.id).select().single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('newsletter_templates').insert(payload).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['newsletter-templates'] });
      toast({ title: 'Template saved' });
    },
    onError: (e: any) => {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('newsletter_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['newsletter-templates'] });
      toast({ title: 'Template deleted' });
    },
  });

  return {
    templates,
    isLoading,
    saveTemplate: saveMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}

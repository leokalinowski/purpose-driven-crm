import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Background {
  id: string;
  name: string;
  background_url: string;
  prompt: string | null;
  category: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackgroundAgentLink {
  id: string;
  background_id: string;
  user_id: string;
  created_at: string;
}

export interface BackgroundInput {
  name: string;
  background_url: string;
  prompt?: string;
  category?: string;
  notes?: string;
}

export const useBackgrounds = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBackgrounds = useCallback(async (): Promise<Background[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('backgrounds')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      return (data || []) as Background[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch backgrounds';
      console.error('[useBackgrounds] fetchBackgrounds error:', err);
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgentLinks = useCallback(async (userId: string): Promise<BackgroundAgentLink[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('background_agent_links')
        .select('*')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      return (data || []) as BackgroundAgentLink[];
    } catch (err: unknown) {
      console.error('[useBackgrounds] fetchAgentLinks error:', err);
      return [];
    }
  }, []);

  const fetchAllLinks = useCallback(async (): Promise<BackgroundAgentLink[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('background_agent_links')
        .select('*');

      if (fetchError) throw fetchError;

      return (data || []) as BackgroundAgentLink[];
    } catch (err: unknown) {
      console.error('[useBackgrounds] fetchAllLinks error:', err);
      return [];
    }
  }, []);

  const uploadBackground = useCallback(async (
    file: File,
    input: Omit<BackgroundInput, 'background_url'>
  ): Promise<Background | null> => {
    try {
      setLoading(true);
      setError(null);

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert record
      const { data: bgData, error: insertError } = await supabase
        .from('backgrounds')
        .insert({
          ...input,
          background_url: urlData.publicUrl,
          created_by: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: 'Background added',
        description: 'Background has been uploaded successfully.',
      });

      return bgData as Background;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload background';
      console.error('[useBackgrounds] uploadBackground error:', err);
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

  const updateBackground = useCallback(async (
    backgroundId: string,
    updates: Partial<BackgroundInput>
  ): Promise<Background | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from('backgrounds')
        .update(updates)
        .eq('id', backgroundId)
        .select()
        .single();

      if (updateError) throw updateError;

      toast({
        title: 'Background updated',
        description: 'Background details have been saved.',
      });

      return data as Background;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update background';
      console.error('[useBackgrounds] updateBackground error:', err);
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

  const deleteBackground = useCallback(async (backgroundId: string, backgroundUrl: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Extract path from URL for storage deletion
      const urlParts = backgroundUrl.split('/backgrounds/');
      if (urlParts.length > 1) {
        const storagePath = urlParts[1];
        await supabase.storage.from('backgrounds').remove([storagePath]);
      }

      const { error: deleteError } = await supabase
        .from('backgrounds')
        .delete()
        .eq('id', backgroundId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Background deleted',
        description: 'Background has been removed.',
      });

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete background';
      console.error('[useBackgrounds] deleteBackground error:', err);
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const linkBackground = useCallback(async (backgroundId: string, userId: string): Promise<boolean> => {
    try {
      const { error: linkError } = await supabase
        .from('background_agent_links')
        .insert({ background_id: backgroundId, user_id: userId });

      if (linkError) throw linkError;

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to link background';
      console.error('[useBackgrounds] linkBackground error:', err);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const unlinkBackground = useCallback(async (backgroundId: string, userId: string): Promise<boolean> => {
    try {
      const { error: unlinkError } = await supabase
        .from('background_agent_links')
        .delete()
        .eq('background_id', backgroundId)
        .eq('user_id', userId);

      if (unlinkError) throw unlinkError;

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to unlink background';
      console.error('[useBackgrounds] unlinkBackground error:', err);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    loading,
    error,
    fetchBackgrounds,
    fetchAgentLinks,
    fetchAllLinks,
    uploadBackground,
    updateBackground,
    deleteBackground,
    linkBackground,
    unlinkBackground,
  };
};

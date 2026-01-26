import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AgentImage {
  id: string;
  user_id: string;
  image_url: string;
  image_type: string;
  name: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AgentImageInput {
  image_url: string;
  image_type?: string;
  name?: string;
  notes?: string;
  sort_order?: number;
}

export const useAgentImages = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchImages = useCallback(async (userId: string): Promise<AgentImage[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('agent_images')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;

      return (data || []) as AgentImage[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch images';
      console.error('[useAgentImages] fetchImages error:', err);
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadImage = useCallback(async (
    userId: string,
    file: File,
    imageType: string = 'other',
    name?: string
  ): Promise<AgentImage | null> => {
    try {
      setLoading(true);
      setError(null);

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('agent-assets')
        .getPublicUrl(fileName);

      // Insert record
      const { data: imageData, error: insertError } = await supabase
        .from('agent_images')
        .insert({
          user_id: userId,
          image_url: urlData.publicUrl,
          image_type: imageType,
          name: name || file.name,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: 'Image uploaded',
        description: 'Image has been added successfully.',
      });

      return imageData as AgentImage;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload image';
      console.error('[useAgentImages] uploadImage error:', err);
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

  const updateImage = useCallback(async (
    imageId: string,
    updates: Partial<AgentImageInput>
  ): Promise<AgentImage | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from('agent_images')
        .update(updates)
        .eq('id', imageId)
        .select()
        .single();

      if (updateError) throw updateError;

      toast({
        title: 'Image updated',
        description: 'Image details have been saved.',
      });

      return data as AgentImage;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update image';
      console.error('[useAgentImages] updateImage error:', err);
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

  const deleteImage = useCallback(async (imageId: string, imageUrl: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Extract path from URL for storage deletion
      const urlParts = imageUrl.split('/agent-assets/');
      if (urlParts.length > 1) {
        const storagePath = urlParts[1];
        await supabase.storage.from('agent-assets').remove([storagePath]);
      }

      const { error: deleteError } = await supabase
        .from('agent_images')
        .delete()
        .eq('id', imageId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Image deleted',
        description: 'Image has been removed.',
      });

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete image';
      console.error('[useAgentImages] deleteImage error:', err);
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

  return {
    loading,
    error,
    fetchImages,
    uploadImage,
    updateImage,
    deleteImage,
  };
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const RESOURCE_CATEGORIES = [
  'Contracts & Forms',
  'Marketing Templates',
  'Scripts & Guides',
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export function useResources(category?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['resources', category],
    queryFn: async () => {
      let q = supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (category) {
        q = q.eq('category', category);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Resource[];
    },
  });

  const uploadResource = useMutation({
    mutationFn: async ({
      title,
      description,
      category,
      file,
    }: {
      title: string;
      description: string;
      category: string;
      file: File;
    }) => {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('resources')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: userData } = await supabase.auth.getUser();

      const { error: insertError } = await supabase.from('resources').insert({
        title,
        description: description || null,
        category,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: userData.user?.id ?? null,
      });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast({ title: 'Resource uploaded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });

  const deleteResource = useMutation({
    mutationFn: async (resource: Resource) => {
      const { error: storageError } = await supabase.storage
        .from('resources')
        .remove([resource.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('resources')
        .delete()
        .eq('id', resource.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast({ title: 'Resource deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('resources').getPublicUrl(filePath);
    return data.publicUrl;
  };

  return {
    resources: query.data ?? [],
    isLoading: query.isLoading,
    uploadResource,
    deleteResource,
    getPublicUrl,
  };
}

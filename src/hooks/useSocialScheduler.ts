import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface SocialAccount {
  id: string;
  agent_id: string;
  platform: string;
  account_name?: string;
  account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  agent_id: string;
  platform: string;
  content: string;
  media_url?: string;
  media_type?: string;
  schedule_time: string;
  status: 'scheduled' | 'posted' | 'failed' | 'draft';
  posted_at?: string;
  postiz_post_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface SocialAnalytics {
  id: string;
  post_id?: string;
  agent_id: string;
  platform: string;
  metric_date: string;
  reach: number;
  impressions: number;
  followers: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

export interface NewPost {
  content: string;
  platforms: string[];
  schedule_time: string;
  media_file?: File;
  agent_id?: string; // For admin use
}

export interface CSVPost {
  content: string;
  media_file?: string;
  schedule_time: string;
  platform: string;
}

export const useSocialAccounts = (agentId?: string) => {
  const { user } = useAuth();
  const actualAgentId = agentId || user?.id;

  return useQuery({
    queryKey: ['social-accounts', actualAgentId],
    queryFn: async () => {
      if (!actualAgentId) return [];

      const { data, error } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('agent_id', actualAgentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SocialAccount[];
    },
    enabled: !!actualAgentId,
  });
};

export const useSocialPosts = (agentId?: string) => {
  const { user } = useAuth();
  const actualAgentId = agentId || user?.id;

  return useQuery({
    queryKey: ['social-posts', actualAgentId],
    queryFn: async () => {
      if (!actualAgentId) return [];

      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .eq('agent_id', actualAgentId)
        .order('schedule_time', { ascending: true });

      if (error) throw error;
      return data as SocialPost[];
    },
    enabled: !!actualAgentId,
  });
};

export const useSocialAnalytics = (agentId?: string, startDate?: string, endDate?: string) => {
  const { user } = useAuth();
  const actualAgentId = agentId || user?.id;

  return useQuery({
    queryKey: ['social-analytics', actualAgentId, startDate, endDate],
    queryFn: async () => {
      if (!actualAgentId) return [];

      let query = supabase
        .from('social_analytics')
        .select('*')
        .eq('agent_id', actualAgentId);

      if (startDate) {
        query = query.gte('metric_date', startDate);
      }
      if (endDate) {
        query = query.lte('metric_date', endDate);
      }

      const { data, error } = await query.order('metric_date', { ascending: false });

      if (error) throw error;
      return data as SocialAnalytics[];
    },
    enabled: !!actualAgentId,
  });
};

export const useSchedulePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (newPost: NewPost) => {
      let mediaUrl = null;

      // Upload media file if provided
      if (newPost.media_file) {
        const fileName = `${Date.now()}-${newPost.media_file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('social-media')
          .upload(`${newPost.agent_id || 'temp'}/${fileName}`, newPost.media_file);

        if (uploadError) throw uploadError;
        mediaUrl = uploadData.path;
      }

      // Call edge function to schedule via Postiz
      const { data, error } = await supabase.functions.invoke('social-schedule', {
        body: {
          ...newPost,
          media_url: mediaUrl,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast({
        title: "Post scheduled successfully",
        description: "Your post has been scheduled for publishing.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to schedule post",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useCSVUpload = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ file, agentId }: { file: File; agentId?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (agentId) formData.append('agent_id', agentId);

      const { data, error } = await supabase.functions.invoke('social-csv-process', {
        body: formData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast({
        title: "CSV processed successfully",
        description: `${data.success_count} posts scheduled, ${data.error_count} errors.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to process CSV",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useConnectSocialAccount = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ platform, agentId }: { platform: string; agentId?: string }) => {
      const { data, error } = await supabase.functions.invoke('social-oauth', {
        body: { platform, agent_id: agentId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
      toast({
        title: "Account connected successfully",
        description: "Your social media account has been connected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to connect account",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useRefreshAnalytics = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (agentId?: string) => {
      const { data, error } = await supabase.functions.invoke('social-analytics', {
        body: { agent_id: agentId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-analytics'] });
      toast({
        title: "Analytics refreshed",
        description: "Social media analytics have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to refresh analytics",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
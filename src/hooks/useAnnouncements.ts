import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

export interface AnnouncementSlide {
  title: string;
  content: string;
  image_url?: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  image_url: string | null;
  action_url: string | null;
  action_label: string | null;
  is_active: boolean;
  priority: number;
  target_role: string | null;
  created_at: string;
  expires_at: string | null;
  created_by: string;
  slides: AnnouncementSlide[] | null;
  display_position: string;
  display_style: string;
}

export function useAnnouncements() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements', 'active', user?.id, role],
    queryFn: async () => {
      if (!user) return [];

      const { data: dismissals } = await supabase
        .from('announcement_dismissals')
        .select('announcement_id')
        .eq('user_id', user.id);

      const dismissedIds = (dismissals || []).map(d => d.announcement_id);

      let query = supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (dismissedIds.length > 0) {
        query = query.not('id', 'in', `(${dismissedIds.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const now = new Date().toISOString();
      return (data as unknown as Announcement[]).filter(a => {
        if (a.expires_at && a.expires_at < now) return false;
        if (a.target_role && a.target_role !== role) return false;
        return true;
      });
    },
    enabled: !!user,
  });

  const dismissAnnouncement = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('announcement_dismissals')
        .insert({ announcement_id: announcementId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', 'active'] });
    },
  });

  const dismissAllAnnouncements = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('Not authenticated');
      const rows = ids.map(id => ({ announcement_id: id, user_id: user.id }));
      const { error } = await supabase
        .from('announcement_dismissals')
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', 'active'] });
    },
  });

  return { announcements, isLoading, dismissAnnouncement, dismissAllAnnouncements };
}

// Admin hook for managing all announcements
export function useAdminAnnouncements() {
  const queryClient = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Announcement[];
    },
  });

  const { data: dismissalCounts = {} } = useQuery({
    queryKey: ['announcements', 'dismissal-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcement_dismissals')
        .select('announcement_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(d => {
        counts[d.announcement_id] = (counts[d.announcement_id] || 0) + 1;
      });
      return counts;
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: async (announcement: any) => {
      const { error } = await supabase.from('announcements').insert(announcement);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const updateAnnouncement = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Announcement> & { id: string }) => {
      const { error } = await supabase.from('announcements').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  return { announcements, isLoading, dismissalCounts, createAnnouncement, updateAnnouncement, deleteAnnouncement };
}

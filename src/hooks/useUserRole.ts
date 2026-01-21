import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'admin' | 'editor' | 'agent' | string;

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        // Source of truth: SECURITY DEFINER DB function based on user_roles table.
        const { data, error } = await supabase.rpc('get_current_user_role');
        if (error) throw error;
        setRole(data || 'agent');
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('agent');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';

  return {
    role,
    isAdmin,
    isEditor,
    loading,
  };
};
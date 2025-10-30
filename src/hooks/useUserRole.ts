import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        // Query the new user_roles table
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .order('role', { ascending: true }) // Admin comes before agent alphabetically
          .limit(1)
          .single();

        if (rolesError) {
          // Fallback to profiles.role for backwards compatibility
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

          if (profileError) {
            console.error('Error fetching user role:', profileError);
            setRole('agent'); // Default to agent
          } else {
            setRole(profileData?.role || 'agent');
          }
        } else {
          setRole(rolesData?.role || 'agent');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('agent'); // Default to agent
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  const isAdmin = role === 'admin';

  return {
    role,
    isAdmin,
    loading,
  };
};
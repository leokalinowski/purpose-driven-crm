/**
 * useUserProfile — read + persist the identity/contact portion of the
 * agent's profile.
 *
 * Brand / colors / headshot / logos / AI-tone / vendor IDs live on
 * `agent_marketing_settings` (see useAgentMarketingSettings). This hook is
 * narrowly scoped to identity + contact + license + brokerage + privacy
 * fields that only `profiles` owns. Annual coaching goals also live on
 * profiles but are owned by useCoachingGoals — keep them out of here.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserProfile {
  user_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  office_number?: string | null;
  office_address?: string | null;
  website?: string | null;
  team_name?: string | null;
  brokerage?: string | null;
  brokerage_info?: string | null;
  license_number?: string | null;
  state_licenses?: string[] | null;
  privacy_policy_url?: string | null;
  can_email_marketing?: boolean | null;
}

/** Subset of UserProfile that the user can edit through Settings. */
export type UserProfilePatch = Partial<Omit<UserProfile, 'user_id' | 'email'>>;

const PROFILE_COLUMNS =
  'user_id, first_name, last_name, email, phone_number, office_number, office_address, website, team_name, brokerage, brokerage_info, license_number, state_licenses, privacy_policy_url, can_email_marketing';

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('user_id', user.id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      setProfile(data ?? { email: user.email });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[useUserProfile] fetch error:', err);
      setError(message);
      setProfile({ email: user.email });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /**
   * Persist a patch to the user's row in `profiles`. Returns true on
   * success. The hook's local `profile` state is updated optimistically
   * with the patch on success.
   */
  const save = useCallback(
    async (patch: UserProfilePatch): Promise<boolean> => {
      if (!user?.id) return false;
      setError(null);
      try {
        const { error: updErr } = await supabase
          .from('profiles')
          .update(patch)
          .eq('user_id', user.id);
        if (updErr) throw updErr;
        setProfile((prev) => ({ ...(prev ?? {}), ...patch }));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[useUserProfile] save error:', err);
        setError(message);
        return false;
      }
    },
    [user?.id],
  );

  const getDisplayName = useCallback(() => {
    if (!profile) return '';
    if (profile.first_name || profile.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return profile.email || '';
  }, [profile]);

  return {
    profile,
    loading,
    error,
    refresh: fetchProfile,
    save,
    getDisplayName,
  };
};

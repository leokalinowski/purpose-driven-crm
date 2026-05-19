/**
 * useTermsAcceptance — reads the current user's accepted T&C version
 * and exposes `needsAcceptance` + an `accept()` mutation.
 *
 * The gate logic:
 *   - signed out                            → needsAcceptance = false (gate is silent until login)
 *   - profile loading                       → needsAcceptance = false (don't pop the modal before we know)
 *   - terms_version IS NULL                 → needsAcceptance = true  (first-time consent)
 *   - terms_version != current TERMS_VERSION → needsAcceptance = true (re-consent after T&C bump)
 *   - terms_version == current TERMS_VERSION → needsAcceptance = false
 *
 * The current version + last-updated date live in
 * `src/content/legal/index.ts`. Bump TERMS_VERSION there to re-prompt
 * every user on their next page load.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TERMS_VERSION } from '@/content/legal';

interface TermsRow {
  terms_version: string | null;
  terms_accepted_at: string | null;
}

export function useTermsAcceptance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery<TermsRow | null>({
    queryKey: ['terms-acceptance', userId],
    enabled: !!userId,
    // Don't cache long — the gate state is tied to the user record;
    // a one-minute stale window is fine since we explicitly invalidate
    // on accept().
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('terms_version, terms_accepted_at')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          terms_version: TERMS_VERSION,
          terms_accepted_at: nowIso,
        })
        .eq('user_id', userId);
      if (error) throw error;
      return { version: TERMS_VERSION, acceptedAt: nowIso };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms-acceptance', userId] });
    },
  });

  const accept = useCallback(() => acceptMutation.mutateAsync(), [acceptMutation]);

  // Decide whether to prompt. Default to false (silent) when:
  //   - the user isn't loaded yet (avoid flash)
  //   - the query is loading or errored (avoid prompt on a transient issue)
  //   - the user has no profile row yet (signup race — wait for it)
  const profile = query.data;
  const needsAcceptance =
    !!userId &&
    !query.isLoading &&
    !query.isError &&
    profile !== undefined &&
    (profile === null || profile.terms_version !== TERMS_VERSION);

  return {
    needsAcceptance,
    accept,
    accepting: acceptMutation.isPending,
    error: (acceptMutation.error ?? query.error ?? null) as Error | null,
    /** The version the user previously accepted, if any. Useful for showing "what changed since." */
    previousVersion: profile?.terms_version ?? null,
  };
}

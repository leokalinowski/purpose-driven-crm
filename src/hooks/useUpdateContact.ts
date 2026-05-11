/**
 * useUpdateContact — single mutation hook for editing any field on `contacts`.
 *
 * Powers per-section inline editing in ContactQuickSheet. Optimistically
 * updates the `['contact', id]` cache, then invalidates the contact list and
 * the priority queue so any change that affects band placement reflects
 * immediately.
 *
 * Pattern mirrors the activity-log pattern in src/lib/comm.ts — toast on
 * success/failure, console.warn on background errors.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UpdateContactInput {
  id: string;
  // Open-shaped — every column on `contacts` is fair game except agent_id /
  // created_at / id. The component is responsible for sending only the
  // dirty fields.
  updates: Record<string, unknown>;
}

export function useUpdateContact() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: UpdateContactInput) => {
      if (!user?.id) throw new Error('Not signed in');
      if (!id) throw new Error('Missing contact id');
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .eq('agent_id', user.id) // RLS belt-and-suspenders
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any in-flight refetch so it doesn't clobber the optimistic state.
      await qc.cancelQueries({ queryKey: ['contact', id] });
      const previous = qc.getQueryData<Record<string, unknown> | undefined>(['contact', id]);
      qc.setQueryData(['contact', id], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, ...updates } : old,
      );
      return { previous };
    },
    onError: (err, vars, ctx) => {
      // Roll back the optimistic write.
      if (ctx?.previous !== undefined) {
        qc.setQueryData(['contact', vars.id], ctx.previous);
      }
      toast.error('Save failed', {
        description: err instanceof Error ? err.message : 'Try again in a moment.',
      });
    },
    onSuccess: () => {
      toast.success('Saved');
    },
    onSettled: (_data, _err, vars) => {
      // Re-fetch the canonical contact + any list views that reflect the change.
      qc.invalidateQueries({ queryKey: ['contact', vars.id] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['priority-queue'] });
      qc.invalidateQueries({ queryKey: ['prioritized-contacts'] });
    },
  });
}

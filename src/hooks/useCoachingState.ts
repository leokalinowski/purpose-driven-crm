import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

/**
 * useCoachingState — the single hook every SphereSync surface reads from.
 *
 * The Coach (`ai-coach-agent` edge function) writes one row per agent into
 * `agent_coaching_state` on a tick cadence (nightly-full + workday-quick +
 * event-driven). This hook reads that row. All derived UIs (Commander home,
 * Pipeline lens, Sphere lens, contact detail, chat) consume this — no
 * parallel scoring logic in the client.
 */

// ─── Types (mirror the edge-function output shape) ───────────────────────────

export type CoachAction =
  | 'call' | 'text' | 'email' | 'meet' | 'send_listing' | 'follow_up' | 'write_note';

export type CoachUrgency = 'overdue' | 'timely' | 'proactive';

export type AlertLevel = 'info' | 'warning' | 'urgent';

export type AlertType =
  | 'overdue_touch' | 'stuck_deal' | 'life_event'
  | 'high_priority_ignored' | 'opportunity_no_next_step';

export interface NextHour {
  contact_id: string;
  contact_name: string;
  opportunity_id?: string | null;
  action: CoachAction;
  urgency: CoachUrgency;
  reasoning: string;
  first_sentence: string;
  context_chips: string[];
}

export interface TodayItem {
  contact_id: string;
  contact_name: string;
  opportunity_id?: string | null;
  priority_score: number | null;
  action: CoachAction;
  reasoning: string;
  quick_actions: string[];
}

export interface WeekNarrative {
  gci_pace: string;
  pipeline_story: string;
  sphere_story: string;
  top_risk: string | null;
  top_win: string | null;
}

export interface CoachAlert {
  level: AlertLevel;
  type: AlertType;
  message: string;
  contact_id?: string;
  opportunity_id?: string;
  count?: number;
  created_at: string;
}

export interface CoachingState {
  agent_id: string;
  version: number;
  generated_at: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  run_ms: number | null;
  next_hour: NextHour | null;
  today_list: TodayItem[];
  week_narrative: WeekNarrative | null;
  alerts: CoachAlert[];
  chat_context: Record<string, unknown> | null;
  dirty: boolean;
  updated_at: string;
}

// ─── Hook: read the current agent's coaching state ───────────────────────────

export function useCoachingState() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['coaching-state', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,              // 1 min — the Coach writes on a tick cadence
    refetchOnWindowFocus: true,     // agents switch tabs a lot
    queryFn: async (): Promise<CoachingState | null> => {
      const { data, error } = await supabase
        .from('agent_coaching_state')
        .select('*')
        .eq('agent_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      return {
        agent_id: data.agent_id,
        version: data.version ?? 1,
        generated_at: data.generated_at,
        model: data.model,
        tokens_in: data.tokens_in,
        tokens_out: data.tokens_out,
        run_ms: data.run_ms,
        next_hour: (data.next_hour as NextHour | null) ?? null,
        today_list: (data.today_list as TodayItem[] | null) ?? [],
        week_narrative: (data.week_narrative as WeekNarrative | null) ?? null,
        alerts: (data.alerts as CoachAlert[] | null) ?? [],
        chat_context: (data.chat_context as Record<string, unknown> | null) ?? null,
        dirty: !!data.dirty,
        updated_at: data.updated_at,
      };
    },
  });

  return {
    state: query.data,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

// ─── Hook: read Coach-created tasks for an agent (active only, newest first) ─

export interface CoachTask {
  id: string;
  table: 'spheresync_tasks' | 'pipeline_tasks';
  agent_id: string;
  contact_id: string | null;
  opportunity_id?: string | null;
  task_type: string;
  title: string | null;
  coach_reasoning: string | null;
  coach_created_at: string | null;
  due_date: string | null;
  completed: boolean;
  priority: number | null;
}

export function useCoachTasks() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['coach-tasks', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<CoachTask[]> => {
      // Query both task tables in parallel, filter to Coach-created non-dismissed
      // active tasks, merge + sort by created_at desc.
      const [sphereRes, pipeRes] = await Promise.all([
        supabase.from('spheresync_tasks')
          .select('id, agent_id, lead_id, task_type, notes, coach_reasoning, coach_created_at, completed')
          .eq('agent_id', user!.id)
          .eq('source', 'coach')
          .is('coach_dismissed_at', null)
          .order('coach_created_at', { ascending: false })
          .limit(50),
        supabase.from('pipeline_tasks')
          .select('id, agent_id, contact_id, opportunity_id, task_type, title, coach_reasoning, coach_created_at, completed, priority, due_date')
          .eq('agent_id', user!.id)
          .eq('source', 'coach')
          .is('coach_dismissed_at', null)
          .order('coach_created_at', { ascending: false })
          .limit(50),
      ]);

      if (sphereRes.error) throw sphereRes.error;
      if (pipeRes.error) throw pipeRes.error;

      const tasks: CoachTask[] = [
        ...(sphereRes.data ?? []).map(t => ({
          id: t.id, table: 'spheresync_tasks' as const, agent_id: t.agent_id,
          contact_id: t.lead_id ?? null, opportunity_id: null,
          task_type: t.task_type, title: t.notes,
          coach_reasoning: t.coach_reasoning, coach_created_at: t.coach_created_at,
          due_date: null, completed: !!t.completed, priority: null,
        })),
        ...(pipeRes.data ?? []).map(t => ({
          id: t.id, table: 'pipeline_tasks' as const, agent_id: t.agent_id,
          contact_id: t.contact_id ?? null, opportunity_id: t.opportunity_id ?? null,
          task_type: t.task_type, title: t.title,
          coach_reasoning: t.coach_reasoning, coach_created_at: t.coach_created_at,
          due_date: t.due_date, completed: !!t.completed, priority: t.priority,
        })),
      ];

      return tasks.sort((a, b) => {
        const ta = a.coach_created_at ? new Date(a.coach_created_at).getTime() : 0;
        const tb = b.coach_created_at ? new Date(b.coach_created_at).getTime() : 0;
        return tb - ta;
      });
    },
  });

  return {
    tasks: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

// ─── Mutation: dismiss a Coach suggestion (optimistic, reversible by re-query)

export function useDismissCoachTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ task }: { task: CoachTask }) => {
      const { error } = await supabase
        .from(task.table)
        .update({ coach_dismissed_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) throw error;
      return task.id;
    },
    onMutate: async ({ task }) => {
      await queryClient.cancelQueries({ queryKey: ['coach-tasks'] });
      const previous = queryClient.getQueryData<CoachTask[]>(['coach-tasks', task.agent_id]);
      queryClient.setQueriesData<CoachTask[] | undefined>(
        { queryKey: ['coach-tasks'] },
        (old) => (old ? old.filter(t => t.id !== task.id) : old),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueriesData({ queryKey: ['coach-tasks'] }, ctx.previous);
      }
      toast({ title: 'Could not dismiss Coach task', variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-tasks'] });
    },
  });
}

// ─── Helper: tier a priority_score into a visible bucket ─────────────────────

export type PriorityTier = 'urgent' | 'hot' | 'warm' | 'cool' | 'cold' | 'unscored';

export function tierFor(score: number | null | undefined): PriorityTier {
  if (score == null) return 'unscored';
  if (score >= 80) return 'urgent';
  if (score >= 60) return 'hot';
  if (score >= 40) return 'warm';
  if (score >= 20) return 'cool';
  return 'cold';
}

export const URGENCY_META: Record<CoachUrgency, { label: string; className: string }> = {
  overdue:   { label: 'Overdue',   className: 'bg-red-50 text-red-700 border-red-200' },
  timely:    { label: 'Timely',    className: 'bg-orange-50 text-orange-700 border-orange-200' },
  proactive: { label: 'Proactive', className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export const ALERT_META: Record<AlertLevel, { dot: string; text: string; bg: string }> = {
  urgent:  { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50' },
  warning: { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' },
  info:    { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50' },
};

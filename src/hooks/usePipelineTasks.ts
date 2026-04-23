import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface PipelineTask {
  id: string;
  opportunity_id: string;
  agent_id: string;
  contact_id: string | null;
  task_type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: number;
  completed: boolean;
  completed_at: string | null;
  auto_generated: boolean;
  playbook_stage: string | null;
  ai_suggested: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function usePipelineTasks(opportunityId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<PipelineTask[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!opportunityId) { setTasks([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pipeline_tasks')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('completed', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setTasks((data ?? []) as PipelineTask[]);
    } catch (err: any) {
      console.error('usePipelineTasks fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = async (task: Partial<PipelineTask>) => {
    if (!user || !opportunityId) return null;
    try {
      const { data, error } = await supabase
        .from('pipeline_tasks')
        .insert({ ...task, opportunity_id: opportunityId, agent_id: user.id })
        .select()
        .single();
      if (error) throw error;
      await fetchTasks();
      toast({ title: 'Task added' });
      return data as PipelineTask;
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<PipelineTask>) => {
    try {
      const { error } = await supabase.from('pipeline_tasks').update(updates).eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const completeTask = async (taskId: string) => {
    await updateTask(taskId, { completed: true, completed_at: new Date().toISOString() });
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('pipeline_tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast({ title: 'Task deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const generatePlaybookTasks = async (newStage: string, pipelineType: string, agentId: string) => {
    if (!opportunityId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('pipeline-stage-tasks', {
        body: { opportunity_id: opportunityId, new_stage: newStage, pipeline_type: pipelineType, agent_id: agentId },
      });
      if (resp.error) throw resp.error;
      await fetchTasks();
      const count = resp.data?.tasks_created ?? 0;
      if (count > 0) toast({ title: `${count} task${count > 1 ? 's' : ''} added from playbook` });
    } catch (err: any) {
      console.warn('Playbook task generation failed (non-fatal):', err.message);
    }
  };

  const openTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const overdueTasks = openTasks.filter(t => t.due_date && t.due_date < new Date().toISOString().split('T')[0]);

  return { tasks, openTasks, completedTasks, overdueTasks, loading, addTask, updateTask, completeTask, deleteTask, generatePlaybookTasks, refresh: fetchTasks };
}

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClickUpTask {
  id: string;
  event_id: string;
  clickup_task_id: string;
  task_name: string;
  status: string | null;
  due_date: string | null;
  responsible_person: string | null;
  completed_at: string | null;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClickUpTaskStats {
  total: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  progressPct: number;
}

export interface TasksByResponsible {
  responsible: string;
  total: number;
  completed: number;
  progressPct: number;
}

export const useClickUpTasks = (eventId?: string) => {
  const [tasks, setTasks] = useState<ClickUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!eventId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('clickup_tasks')
        .select('*')
        .eq('event_id', eventId)
        .order('due_date', { ascending: true });

      if (queryError) throw queryError;
      setTasks((data || []) as ClickUpTask[]);
    } catch (err: any) {
      console.error('Error fetching clickup tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    if (!eventId) return;

    const channel = supabase
      .channel(`clickup-tasks-${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clickup_tasks',
        filter: `event_id=eq.${eventId}`,
      }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const stats: ClickUpTaskStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed_at !== null).length;
    const overdue = tasks.filter(t => {
      if (t.completed_at) return false;
      if (!t.due_date) return false;
      return new Date(t.due_date) < today;
    }).length;
    const dueSoon = tasks.filter(t => {
      if (t.completed_at) return false;
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d >= today && d <= weekFromNow;
    }).length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, overdue, dueSoon, progressPct };
  }, [tasks]);

  const tasksByResponsible: TasksByResponsible[] = useMemo(() => {
    const groups: Record<string, { total: number; completed: number }> = {};
    tasks.forEach(t => {
      const key = t.responsible_person || 'Unassigned';
      if (!groups[key]) groups[key] = { total: 0, completed: 0 };
      groups[key].total++;
      if (t.completed_at) groups[key].completed++;
    });
    return Object.entries(groups).map(([responsible, data]) => ({
      responsible,
      total: data.total,
      completed: data.completed,
      progressPct: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    })).sort((a, b) => a.progressPct - b.progressPct);
  }, [tasks]);

  return { tasks, stats, tasksByResponsible, loading, error, refetch: fetchTasks };
};

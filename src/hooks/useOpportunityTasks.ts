import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface OpportunityTask {
  id: string;
  opportunity_id: string;
  agent_id: string;
  task_name: string;
  description?: string;
  due_date?: string;
  status: string;
  priority: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export const useOpportunityTasks = (opportunityId: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<OpportunityTask[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    if (!user || !opportunityId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunity_tasks')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (taskData: {
    task_name: string;
    description?: string;
    due_date?: string;
    priority?: string;
  }) => {
    if (!user || !opportunityId) return false;

    try {
      const { data, error } = await supabase
        .from('opportunity_tasks')
        .insert({
          opportunity_id: opportunityId,
          agent_id: user.id,
          ...taskData
        })
        .select()
        .single();

      if (error) throw error;

      setTasks(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Task created successfully"
      });
      return true;
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive"
      });
      return false;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<OpportunityTask>) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('opportunity_tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('agent_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setTasks(prev => 
        prev.map(task => task.id === taskId ? data : task)
      );
      toast({
        title: "Success",
        description: "Task updated successfully"
      });
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive"
      });
      return false;
    }
  };

  const completeTask = async (taskId: string) => {
    return updateTask(taskId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('opportunity_tasks')
        .delete()
        .eq('id', taskId)
        .eq('agent_id', user.id);

      if (error) throw error;

      setTasks(prev => prev.filter(task => task.id !== taskId));
      toast({
        title: "Success",
        description: "Task deleted successfully"
      });
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user, opportunityId]);

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    completeTask,
    deleteTask,
    refetch: fetchTasks
  };
};
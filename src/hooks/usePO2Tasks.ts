import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentWeekTasks } from '@/utils/po2Logic';
import { useToast } from '@/hooks/use-toast';

export interface Lead {
  id: string;
  name: string;
  first_name?: string;
  last_name: string;
  phone_number?: string;
  category: string;
}

export interface PO2Task {
  id: string;
  task_type: 'call' | 'text';
  lead_id: string;
  completed: boolean;
  notes?: string;
  lead: Lead;
}

export function usePO2Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<PO2Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  const currentWeek = getCurrentWeekTasks();

  // Load existing tasks and leads
  useEffect(() => {
    if (user) {
      loadTasksAndLeads();
    }
  }, [user]);

  const loadTasksAndLeads = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load existing tasks for current week
      const { data: tasksData, error: tasksError } = await supabase
        .from('po2_tasks')
        .select(`
          *,
          lead:leads(*)
        `)
        .eq('agent_id', user.id)
        .eq('week_number', currentWeek.weekNumber)
        .eq('year', new Date().getFullYear());

      if (tasksError) throw tasksError;

      // Load all leads for the agent
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('agent_id', user.id);

      if (leadsError) throw leadsError;

      setTasks((tasksData || []) as PO2Task[]);
      setLeads(leadsData || []);
    } catch (error) {
      console.error('Error loading tasks and leads:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks and leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentWeek.weekNumber, toast]);

  const generateWeeklyTasks = useCallback(async () => {
    if (!user) return;

    try {
      setGeneratingTasks(true);

      // Get leads for call categories
      const callLeads = leads.filter(lead => 
        currentWeek.callCategories.includes(lead.category)
      );

      // Get leads for text category
      const textLeads = leads.filter(lead => 
        lead.category === currentWeek.textCategory
      );

      // Create call tasks
      const callTasks = callLeads.map(lead => ({
        task_type: 'call' as const,
        lead_id: lead.id,
        agent_id: user.id,
        week_number: currentWeek.weekNumber,
        year: new Date().getFullYear()
      }));

      // Create text tasks
      const textTasks = textLeads.map(lead => ({
        task_type: 'text' as const,
        lead_id: lead.id,
        agent_id: user.id,
        week_number: currentWeek.weekNumber,
        year: new Date().getFullYear()
      }));

      const allTasks = [...callTasks, ...textTasks];

      if (allTasks.length > 0) {
        const { error } = await supabase
          .from('po2_tasks')
          .upsert(allTasks, { 
            onConflict: 'lead_id,agent_id,task_type,week_number,year',
            ignoreDuplicates: true 
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: `Generated ${allTasks.length} tasks for week ${currentWeek.weekNumber}`,
        });

        // Reload tasks
        await loadTasksAndLeads();
      } else {
        toast({
          title: "No Tasks",
          description: "No leads found for this week's categories",
        });
      }
    } catch (error) {
      console.error('Error generating tasks:', error);
      toast({
        title: "Error",
        description: "Failed to generate weekly tasks",
        variant: "destructive",
      });
    } finally {
      setGeneratingTasks(false);
    }
  }, [user, leads, currentWeek, toast, loadTasksAndLeads]);

  const updateTask = async (taskId: string, updates: Partial<PO2Task>) => {
    try {
      const { error } = await supabase
        .from('po2_tasks')
        .update({
          ...updates,
          completed_at: updates.completed ? new Date().toISOString() : null
        })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      ));

      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const callTasks = tasks.filter(task => task.task_type === 'call');
  const textTasks = tasks.filter(task => task.task_type === 'text');

  return {
    tasks,
    callTasks,
    textTasks,
    leads,
    loading,
    generatingTasks,
    currentWeek,
    generateWeeklyTasks,
    updateTask,
    refreshTasks: loadTasksAndLeads
  };
}
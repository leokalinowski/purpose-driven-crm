import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/components/ui/use-toast';
import { getCurrentWeekTasks } from '@/utils/sphereSyncLogic';

export interface Contact {
  id: string;
  first_name?: string;
  last_name: string;
  phone?: string;
  category: string;
  agent_id: string;
  dnc: boolean;
}

export interface SphereSyncTask {
  id: string;
  agent_id: string;
  lead_id: string;
  task_type: 'call' | 'text';
  week_number: number;
  year: number;
  completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  lead: Contact;
}

export interface WeeklyStats {
  week: number;
  year: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  callTasks: number;
  textTasks: number;
  completedCalls: number;
  completedTexts: number;
}

export function useSphereSyncTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<SphereSyncTask[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [historicalStats, setHistoricalStats] = useState<WeeklyStats[]>([]);
  const currentWeek = getCurrentWeekTasks();

  const loadTasksAndContacts = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone, category, agent_id, dnc')
        .eq('agent_id', user.id)
        .order('last_name');

      if (contactsError) throw contactsError;

      // Auto-assign categories to contacts without them
      const contactsToUpdate = contactsData?.filter(contact => !contact.category) || [];
      
      if (contactsToUpdate.length > 0) {
        const updates = contactsToUpdate.map(contact => ({
          ...contact,
          category: contact.last_name?.charAt(0).toUpperCase() || 'A'
        }));

        const { error: updateError } = await supabase
          .from('contacts')
          .upsert(updates);

        if (updateError) throw updateError;
      }

      const updatedContacts = contactsData?.map(contact => ({
        ...contact,
        category: contact.category || contact.last_name?.charAt(0).toUpperCase() || 'A'
      })) || [];

      setContacts(updatedContacts);

      // Load tasks (without join first, then match contacts manually)
      const { data: tasksData, error: tasksError } = await supabase
        .from('spheresync_tasks')
        .select('*')
        .eq('agent_id', user.id)
        .eq('week_number', currentWeek.weekNumber)
        .eq('year', new Date().getFullYear())
        .order('created_at');

      if (tasksError) throw tasksError;

      // Match tasks with contacts manually
      const tasksWithLeads = tasksData?.map(task => {
        const matchingContact = updatedContacts.find(contact => contact.id === task.lead_id);
        return {
          ...task,
          task_type: task.task_type as 'call' | 'text', // Type cast for proper typing
          lead: matchingContact || {
            id: task.lead_id || '',
            last_name: 'Unknown Contact',
            category: 'A',
            agent_id: user.id,
            dnc: false
          }
        };
      }) || [];

      setTasks(tasksWithLeads);

      // Auto-generate tasks if none exist for current week
      if (tasksWithLeads.length === 0 && updatedContacts.length > 0) {
        await generateWeeklyTasksInternal();
      }

      // Load historical stats
      await loadHistoricalStats();

    } catch (error) {
      console.error('Error loading tasks and contacts:', error);
      toast({
        title: "Error",
        description: "Failed to load SphereSync tasks",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentWeek.weekNumber]);

  const generateWeeklyTasksInternal = async () => {
    if (!user) return;

    try {
      const { callCategories, textCategory } = currentWeek;
      const currentYear = new Date().getFullYear();

      // Filter contacts by categories
      const callContacts = contacts.filter(contact => 
        callCategories.includes(contact.category)
      );
      const textContacts = contacts.filter(contact => 
        contact.category === textCategory
      );

      // Create tasks
      const tasksToInsert = [
        ...callContacts.map(contact => ({
          agent_id: user.id,
          lead_id: contact.id,
          task_type: 'call' as const,
          week_number: currentWeek.weekNumber,
          year: currentYear,
          completed: false
        })),
        ...textContacts.map(contact => ({
          agent_id: user.id,
          lead_id: contact.id,
          task_type: 'text' as const,
          week_number: currentWeek.weekNumber,
          year: currentYear,
          completed: false
        }))
      ];

      if (tasksToInsert.length > 0) {
        // Delete existing tasks for this week/year
        await supabase
          .from('spheresync_tasks')
          .delete()
          .eq('agent_id', user.id)
          .eq('week_number', currentWeek.weekNumber)
          .eq('year', currentYear);

        // Insert new tasks
        const { error: insertError } = await supabase
          .from('spheresync_tasks')
          .insert(tasksToInsert);

        if (insertError) throw insertError;
      }

    } catch (error) {
      console.error('Error generating weekly tasks:', error);
      throw error;
    }
  };

  const generateWeeklyTasks = async () => {
    if (!user) return;

    try {
      setGenerating(true);
      await generateWeeklyTasksInternal();
      await loadTasksAndContacts();
      
      toast({
        title: "Success",
        description: "SphereSync tasks generated successfully"
      });
    } catch (error) {
      console.error('Error generating tasks:', error);
      toast({
        title: "Error",
        description: "Failed to generate SphereSync tasks",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<SphereSyncTask>) => {
    try {
      const { error } = await supabase
        .from('spheresync_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      ));

      toast({
        title: "Success",
        description: "Task updated successfully"
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive"
      });
    }
  };

  const loadHistoricalStats = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('spheresync_tasks')
        .select('*')
        .eq('agent_id', user.id);

      if (error) throw error;

      // Group tasks by week/year and calculate stats
      const statsMap = new Map<string, WeeklyStats>();

      data?.forEach(task => {
        const key = `${task.year}-${task.week_number}`;
        const existing = statsMap.get(key);

        if (existing) {
          existing.totalTasks++;
          if (task.completed) existing.completedTasks++;
          if (task.task_type === 'call') {
            existing.callTasks++;
            if (task.completed) existing.completedCalls++;
          } else {
            existing.textTasks++;
            if (task.completed) existing.completedTexts++;
          }
        } else {
          statsMap.set(key, {
            week: task.week_number,
            year: task.year,
            totalTasks: 1,
            completedTasks: task.completed ? 1 : 0,
            completionRate: 0,
            callTasks: task.task_type === 'call' ? 1 : 0,
            textTasks: task.task_type === 'text' ? 1 : 0,
            completedCalls: task.task_type === 'call' && task.completed ? 1 : 0,
            completedTexts: task.task_type === 'text' && task.completed ? 1 : 0,
          });
        }
      });

      // Calculate completion rates and sort by week
      const stats = Array.from(statsMap.values())
        .map(stat => ({
          ...stat,
          completionRate: stat.totalTasks > 0 ? (stat.completedTasks / stat.totalTasks) * 100 : 0
        }))
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.week - a.week;
        })
        .slice(0, 12); // Last 12 weeks

      setHistoricalStats(stats);
    } catch (error) {
      console.error('Error loading historical stats:', error);
    }
  };

  const refreshTasks = loadTasksAndContacts;

  useEffect(() => {
    if (user) {
      loadTasksAndContacts();
    }
  }, [user, loadTasksAndContacts]);

  const callTasks = tasks.filter(task => task.task_type === 'call');
  const textTasks = tasks.filter(task => task.task_type === 'text');

  return {
    tasks,
    callTasks,
    textTasks,
    contacts,
    loading,
    generating,
    currentWeek,
    historicalStats,
    generateWeeklyTasks,
    updateTask,
    refreshTasks
  };
}
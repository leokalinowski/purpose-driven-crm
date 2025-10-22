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
  const [lastGeneratedWeek, setLastGeneratedWeek] = useState<string | null>(null);
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
        await generateWeeklyTasksInternal(updatedContacts);
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

  const generateWeeklyTasksInternal = async (contactsToUse?: Contact[]) => {
    if (!user) return;

    try {
      const { callCategories, textCategory } = currentWeek;
      const currentYear = new Date().getFullYear();

      // Check if tasks already exist for this week to prevent duplicates
      const { data: existingTasks, error: checkError } = await supabase
        .from('spheresync_tasks')
        .select('id')
        .eq('agent_id', user.id)
        .eq('week_number', currentWeek.weekNumber)
        .eq('year', currentYear);

      if (checkError) {
        console.error('Error checking existing tasks:', checkError);
        throw checkError;
      }

      // If tasks already exist, delete them first to regenerate
      if (existingTasks && existingTasks.length > 0) {
        const { error: deleteError } = await supabase
          .from('spheresync_tasks')
          .delete()
          .eq('agent_id', user.id)
          .eq('week_number', currentWeek.weekNumber)
          .eq('year', currentYear);

        if (deleteError) {
          console.error('Error deleting existing tasks:', deleteError);
          throw deleteError;
        }
      }

      // Use provided contacts or fall back to state
      const contactsToFilter = contactsToUse || contacts;

      // Filter contacts by categories
      const callContacts = contactsToFilter.filter(contact => 
        callCategories.includes(contact.category)
      );
      const textContacts = contactsToFilter.filter(contact => 
        contact.category === textCategory
      );

      console.log('Task generation debug:', {
        totalContacts: contactsToFilter.length,
        callCategories,
        textCategory,
        callContacts: callContacts.length,
        textContacts: textContacts.length,
        weekNumber: currentWeek.weekNumber,
        year: currentYear
      });

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
        // Insert new tasks with duplicate key error handling
        const { error: insertError } = await supabase
          .from('spheresync_tasks')
          .insert(tasksToInsert);

        if (insertError) {
          // Handle duplicate key errors gracefully
          if (insertError.code === '23505') {
            console.warn('Duplicate tasks detected, skipping insertion');
            return;
          }
          throw insertError;
        }
      }

    } catch (error) {
      console.error('Error generating weekly tasks:', error);
      throw error;
    }
  };

  const generateWeeklyTasks = async () => {
    if (!user || generating) return;
    
    const currentYear = new Date().getFullYear();
    const weekKey = `${currentWeek.weekNumber}-${currentYear}`;
    
    // Prevent duplicate generation for the same week
    if (lastGeneratedWeek === weekKey) {
      toast({
        title: "Info",
        description: "Tasks for this week have already been generated"
      });
      return;
    }

    try {
      setGenerating(true);
      await generateWeeklyTasksInternal(contacts);
      setLastGeneratedWeek(weekKey);
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
    console.log('updateTask called:', { taskId, updates });
    try {
      const { error, data } = await supabase
        .from('spheresync_tasks')
        .update(updates)
        .eq('id', taskId)
        .select();

      if (error) {
        console.error('Supabase error updating task:', error);
        throw error;
      }

      console.log('Task update successful:', data);

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

  // Function to generate tasks for newly uploaded contacts
  const generateTasksForNewContacts = useCallback(async (newContacts: Contact[]) => {
    if (!user || newContacts.length === 0) return;

    try {
      const { callCategories, textCategory } = currentWeek;
      const currentYear = new Date().getFullYear();

      // Filter new contacts by current week's categories
      const callContacts = newContacts.filter(contact => 
        callCategories.includes(contact.category)
      );
      const textContacts = newContacts.filter(contact => 
        contact.category === textCategory
      );

      console.log('New contact task generation:', {
        totalNewContacts: newContacts.length,
        callCategories,
        textCategory,
        callContacts: callContacts.length,
        textContacts: textContacts.length
      });

      // Only generate tasks if there are contacts matching this week's categories
      if (callContacts.length > 0 || textContacts.length > 0) {
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
          const { error: insertError } = await supabase
            .from('spheresync_tasks')
            .insert(tasksToInsert);

          if (insertError) {
            console.error('Error inserting new contact tasks:', insertError);
            return;
          }

          // Refresh tasks to show the new ones
          await loadTasksAndContacts();

          toast({
            title: "Tasks Generated",
            description: `${tasksToInsert.length} new tasks created for contacts matching this week's categories (${callCategories.join(', ')} calls, ${textCategory} texts)`
          });
        }
      } else {
        // Show info about when tasks will be generated
        const unmatchedCategories = [...new Set(newContacts.map(c => c.category))];
        toast({
          title: "Tasks Scheduled",
          description: `New contacts uploaded (${unmatchedCategories.join(', ')}). Tasks will be generated when their letters come up in the weekly rotation.`
        });
      }
    } catch (error) {
      console.error('Error generating tasks for new contacts:', error);
    }
  }, [user, currentWeek, loadTasksAndContacts]);

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
    generateTasksForNewContacts,
    updateTask,
    refreshTasks
  };
}
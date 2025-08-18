import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentWeekTasks } from '@/utils/po2Logic';
import { useToast } from '@/hooks/use-toast';

export interface Contact {
  id: string;
  first_name?: string;
  last_name: string;
  phone?: string;
  category: string;
  agent_id: string;
}

export interface PO2Task {
  id: string;
  task_type: 'call' | 'text';
  lead_id: string;
  completed: boolean;
  notes?: string;
  lead: Contact;
}

export function usePO2Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<PO2Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [generatedThisLoad, setGeneratedThisLoad] = useState(false);
  const [historicalStats, setHistoricalStats] = useState<{ weekNumber: number; year: number; completed: number; total: number }[]>([]);
  const currentWeek = getCurrentWeekTasks();
  const year = new Date().getFullYear();

  // Load tasks and contacts
  useEffect(() => {
    if (user) {
      loadTasksAndContacts();
    }
  }, [user]);

  const loadTasksAndContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('agent_id', user.id);

      if (contactsError) throw contactsError;

      // Auto-set category if missing and log contact info
      const updatedContacts = contactsData.map(c => {
        if (!c.category) {
          const newCategory = c.last_name?.charAt(0)?.toUpperCase() || 'U';
          console.log(`Auto-assigning category '${newCategory}' to contact: ${c.first_name} ${c.last_name}`);
          return { ...c, category: newCategory };
        }
        return c;
      });

      // Log category distribution for debugging
      const categoryCount = updatedContacts.reduce((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('Contact category distribution:', categoryCount);
      console.log(`Week ${currentWeek.weekNumber} requires - Calls: ${currentWeek.callCategories.join(', ')}, Texts: ${currentWeek.textCategory}`);

      // Update contacts with categories if changed
      const contactsNeedingUpdate = updatedContacts.filter((c, i) => c.category !== contactsData[i].category);
      if (contactsNeedingUpdate.length > 0) {
        await supabase.from('contacts').upsert(contactsNeedingUpdate, { onConflict: 'id' });
        console.log(`Updated ${contactsNeedingUpdate.length} contacts with categories`);
      }

      setContacts(updatedContacts);

      // Load tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('po2_tasks')
        .select(`
          *,
          lead:contacts(*)
        `)
        .eq('agent_id', user.id)
        .eq('week_number', currentWeek.weekNumber)
        .eq('year', year);

      if (tasksError) throw tasksError;

      setTasks((tasksData || []) as unknown as PO2Task[]);

      // Auto-generate if no tasks or if tasks are for a different week
      const needsNewTasks = !tasksData || tasksData.length === 0 || 
        (tasksData.length > 0 && tasksData[0].week_number !== currentWeek.weekNumber);
      
      if (needsNewTasks && !generatedThisLoad) {
        console.log(`Generating tasks for current week ${currentWeek.weekNumber} (previous week: ${tasksData?.[0]?.week_number || 'none'})`);
        setGeneratedThisLoad(true);
        await generateWeeklyTasksInternal(updatedContacts);
      }

      // Load historical statistics
      await loadHistoricalStats();
    } catch (error) {
      console.error('Error loading tasks and contacts:', error);
      toast({ 
        title: "Error", 
        description: "Failed to load tasks and contacts. Check console for details.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentWeek.weekNumber, toast]);

  const generateWeeklyTasksInternal = async (contactsList: Contact[]) => {
    if (!user) return;
    setGeneratingTasks(true);
    try {
      const callContacts = contactsList.filter(c => currentWeek.callCategories.includes(c.category));
      const textContacts = contactsList.filter(c => c.category === currentWeek.textCategory);

      console.log(`Generating tasks for week ${currentWeek.weekNumber}:`);
      console.log(`- Call contacts (${currentWeek.callCategories.join(', ')}):`, callContacts.length);
      console.log(`- Text contacts (${currentWeek.textCategory}):`, textContacts.length);

      const callTasks = callContacts.map(c => ({
        task_type: 'call',
        lead_id: c.id,
        agent_id: user.id,
        week_number: currentWeek.weekNumber,
        year
      }));

      const textTasks = textContacts.map(c => ({
        task_type: 'text',
        lead_id: c.id,
        agent_id: user.id,
        week_number: currentWeek.weekNumber,
        year
      }));

      const allTasks = [...callTasks, ...textTasks];

      if (allTasks.length > 0) {
        console.log(`Inserting ${allTasks.length} tasks:`, { calls: callTasks.length, texts: textTasks.length });
        const { error } = await supabase.from('po2_tasks').upsert(allTasks, { onConflict: 'lead_id,agent_id,task_type,week_number,year' });
        if (error) {
          console.error('Database error inserting tasks:', error);
          throw error;
        }
        
        const callMsg = callTasks.length > 0 ? `${callTasks.length} calls (${currentWeek.callCategories.join(', ')})` : '';
        const textMsg = textTasks.length > 0 ? `${textTasks.length} texts (${currentWeek.textCategory})` : '';
        const parts = [callMsg, textMsg].filter(Boolean);
        
        toast({ 
          title: "Success", 
          description: `Generated ${parts.join(' and ')} for week ${currentWeek.weekNumber}` 
        });
        
        // Reload tasks to update the UI
        const { data: newTasksData, error: tasksError } = await supabase
          .from('po2_tasks')
          .select(`
            *,
            lead:contacts(*)
          `)
          .eq('agent_id', user.id)
          .eq('week_number', currentWeek.weekNumber)
          .eq('year', year);

        if (!tasksError && newTasksData) {
          setTasks(newTasksData as unknown as PO2Task[]);
        }
      } else {
        console.log(`Generation failed: no matching contacts for week ${currentWeek.weekNumber}`);
        console.log(`- Required call categories: ${currentWeek.callCategories.join(', ')} (found: ${callContacts.length})`);
        console.log(`- Required text category: ${currentWeek.textCategory} (found: ${textContacts.length})`);
        toast({ 
          title: "No matching contacts", 
          description: "Add leads to database with matching categories to generate tasks",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error generating tasks:', error);
      toast({ 
        title: "Error", 
        description: "Failed to generate weekly tasks. Check console for details.", 
        variant: "destructive" 
      });
    } finally {
      setGeneratingTasks(false);
    }
  };

  const generateWeeklyTasks = useCallback(async () => {
    setGeneratingTasks(true);
    await generateWeeklyTasksInternal(contacts);
    await loadTasksAndContacts();
    setGeneratingTasks(false);
  }, [contacts, loadTasksAndContacts]);

  const updateTask = async (taskId: string, updates: Partial<PO2Task>) => {
    try {
      const { error } = await supabase
        .from('po2_tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('agent_id', user.id);

      if (error) throw error;

      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, ...updates } : task));
      toast({ title: "Success", description: "Task updated successfully" });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    }
  };

  const loadHistoricalStats = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('po2_tasks')
        .select('week_number, year, completed')
        .eq('agent_id', user.id)
        .neq('week_number', currentWeek.weekNumber)
        .order('year', { ascending: false })
        .order('week_number', { ascending: false });

      if (error) throw error;

      // Group by week and calculate stats
      const weekStats = data.reduce((acc, task) => {
        const key = `${task.year}-${task.week_number}`;
        if (!acc[key]) {
          acc[key] = { weekNumber: task.week_number, year: task.year, completed: 0, total: 0 };
        }
        acc[key].total++;
        if (task.completed) acc[key].completed++;
        return acc;
      }, {} as Record<string, { weekNumber: number; year: number; completed: number; total: number }>);

      setHistoricalStats(Object.values(weekStats).slice(0, 10)); // Last 10 weeks
    } catch (error) {
      console.error('Error loading historical stats:', error);
    }
  };

  const refreshTasks = () => loadTasksAndContacts();

  return {
    callTasks: tasks.filter(t => t.task_type === 'call'),
    textTasks: tasks.filter(t => t.task_type === 'text'),
    loading,
    generatingTasks,
    currentWeek,
    historicalStats,
    generateWeeklyTasks,
    updateTask,
    refreshTasks
  };
}
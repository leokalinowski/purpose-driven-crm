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

      // Auto-set category if missing
      const updatedContacts = contactsData.map(c => ({
        ...c,
        category: c.category || (c.last_name.charAt(0).toUpperCase() || 'U')
      }));

      // Update contacts with categories if changed
      await supabase.from('contacts').upsert(updatedContacts, { onConflict: 'id' });

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

      // Auto-generate if no tasks
      if (!tasksData || tasksData.length === 0) {
        await generateWeeklyTasksInternal(updatedContacts);
      }
    } catch (error) {
      console.error('Error loading:', error);
      toast({ title: "Error", description: "Failed to load tasks/contacts", variant: "destructive" });
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
        const { error } = await supabase.from('po2_tasks').upsert(allTasks, { onConflict: 'lead_id,agent_id,task_type,week_number,year' });
        if (error) throw error;
        toast({ title: "Success", description: `Generated ${allTasks.length} tasks for week ${currentWeek.weekNumber}` });
      } else {
        toast({ title: "Info", description: "No matching contacts for this week's categories" });
      }
      await loadTasksAndContacts();
    } catch (error) {
      console.error('Error generating tasks:', error);
      toast({ title: "Error", description: "Failed to generate weekly tasks", variant: "destructive" });
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

  const refreshTasks = () => loadTasksAndContacts();

  return {
    callTasks: tasks.filter(t => t.task_type === 'call'),
    textTasks: tasks.filter(t => t.task_type === 'text'),
    loading,
    generatingTasks,
    currentWeek,
    generateWeeklyTasks,
    updateTask,
    refreshTasks
  };
}
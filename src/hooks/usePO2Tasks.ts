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

  // Load existing tasks and contacts
  useEffect(() => {
    if (user) {
      loadTasksAndContacts();
    }
  }, [user]);

  const loadTasksAndContacts = useCallback(async () => {
    console.log('loadTasksAndContacts called', { user: user?.id, currentWeek });
    if (!user) return;

    try {
      console.log('Starting to load tasks and contacts...');
      setLoading(true);

      // Load existing tasks for current week
      const { data: tasksData, error: tasksError } = await supabase
        .from('po2_tasks')
        .select(`
          *,
          lead:contacts(*)
        `)
        .eq('agent_id', user.id)
        .eq('week_number', currentWeek.weekNumber)
        .eq('year', new Date().getFullYear());

      if (tasksError) {
        console.error('Tasks error:', tasksError);
        throw tasksError;
      }

      // Load all contacts for the agent
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('agent_id', user.id);

      if (contactsError) {
        console.error('Contacts error:', contactsError);
        throw contactsError;
      }

      console.log('Data loaded:', { tasksCount: tasksData?.length, contactsCount: contactsData?.length });
      
      setTasks((tasksData || []) as unknown as PO2Task[]);
      setContacts(contactsData || []);

      // Auto-generate tasks if none exist for this week
      if (!tasksData || tasksData.length === 0) {
        console.log('No tasks found, auto-generating...');
        await generateWeeklyTasksInternal(contactsData || []);
      }
    } catch (error) {
      console.error('Error loading tasks and contacts:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks and contacts: " + (error as Error).message,
        variant: "destructive",
      });
    } finally {
      console.log('Loading complete');
      setLoading(false);
    }
  }, [user, currentWeek.weekNumber, toast]);

  const generateWeeklyTasksInternal = async (contactsList: Contact[]) => {
    if (!user) return;

    try {
      // Get contacts for call categories
      const callContacts = contactsList.filter(contact => 
        currentWeek.callCategories.includes(contact.category)
      );

      // Get contacts for text category
      const textContacts = contactsList.filter(contact => 
        contact.category === currentWeek.textCategory
      );

      // Create call tasks
      const callTasks = callContacts.map(contact => ({
        task_type: 'call' as const,
        lead_id: contact.id,
        agent_id: user.id,
        week_number: currentWeek.weekNumber,
        year: new Date().getFullYear()
      }));

      // Create text tasks
      const textTasks = textContacts.map(contact => ({
        task_type: 'text' as const,
        lead_id: contact.id,
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
      }
    } catch (error) {
      console.error('Error generating tasks:', error);
      toast({
        title: "Error",
        description: "Failed to generate weekly tasks",
        variant: "destructive",
      });
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
    contacts,
    loading,
    generatingTasks,
    currentWeek,
    generateWeeklyTasks,
    updateTask,
    refreshTasks: loadTasksAndContacts
  };
}
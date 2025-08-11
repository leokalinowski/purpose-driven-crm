import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Event {
  id: string;
  title: string;
  event_date: string;
  location: string;
  description?: string;
  theme?: string;
  speakers?: string[];
  attendance_count?: number;
  invited_count?: number;
  leads_generated?: number;
  feedback_summary?: string;
  registration_info?: string;
  quarter?: string;
  event_type?: string;
  clickup_list_id?: string;
  agent_id: string;
}

export interface EventTask {
  id: string;
  event_id: string;
  task_name: string;
  responsible_person: string;
  due_date?: string;
  completed_at?: string;
  status: 'pending' | 'completed' | 'overdue';
  agent_id: string;
}

export const useEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('agent_id', user.id)
        .order('event_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchEventTasks = async (eventId?: string) => {
    if (!user) return;

    try {
      let query = supabase
        .from('event_tasks')
        .select('*')
        .eq('agent_id', user.id);

      if (eventId) {
        query = query.eq('event_id', eventId);
      }

      const { data, error } = await query.order('due_date', { ascending: true });

      if (error) throw error;
      setTasks((data || []) as EventTask[]);
    } catch (error) {
      console.error('Error fetching event tasks:', error);
    }
  };

  const addEvent = async (eventData: Omit<Event, 'id' | 'agent_id'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('events')
        .insert([{ ...eventData, agent_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setEvents(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error adding event:', error);
      throw error;
    }
  };

  const updateEvent = async (id: string, updates: Partial<Event>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .eq('agent_id', user.id)
        .select()
        .single();

      if (error) throw error;
      setEvents(prev => prev.map(event => event.id === id ? data : event));
      return data;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  };

  const addTask = async (taskData: Omit<EventTask, 'id' | 'agent_id'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('event_tasks')
        .insert([{ ...taskData, agent_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setTasks(prev => [...prev, data as EventTask]);
      return data;
    } catch (error) {
      console.error('Error adding task:', error);
      throw error;
    }
  };

  const updateTask = async (id: string, updates: Partial<EventTask>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('event_tasks')
        .update(updates)
        .eq('id', id)
        .eq('agent_id', user.id)
        .select()
        .single();

      if (error) throw error;
      setTasks(prev => prev.map(task => task.id === id ? data as EventTask : task));
      return data;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  const markTaskComplete = async (id: string) => {
    return updateTask(id, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
  };

  const deleteTask = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('event_tasks')
        .delete()
        .eq('id', id)
        .eq('agent_id', user.id);

      if (error) throw error;
      setTasks(prev => prev.filter(task => task.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  };

  const getPreviousQuarterEvent = () => {
    const now = new Date();
    // Most recent past event
    const pastEvents = [...events].filter(e => new Date(e.event_date) < now);
    pastEvents.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    return pastEvents[0];
  };

  const getNextEvent = () => {
    const now = new Date();
    // Nearest upcoming event
    const futureEvents = [...events].filter(e => new Date(e.event_date) >= now);
    futureEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    return futureEvents[0];
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([fetchEvents(), fetchEventTasks()]).finally(() => {
        setLoading(false);
      });

      // Realtime refresh on changes
      const channel = supabase
        .channel('events-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
          fetchEvents();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'event_tasks' }, () => {
          fetchEventTasks();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return {
    events,
    tasks,
    loading,
    addEvent,
    updateEvent,
    addTask,
    updateTask,
    markTaskComplete,
    deleteTask,
    fetchEventTasks,
    getPreviousQuarterEvent,
    getNextEvent
  };
};
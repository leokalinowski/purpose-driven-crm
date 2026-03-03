import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { buildTaskInserts } from '@/utils/defaultEventTasks';

export interface Event {
  id: string;
  title: string;
  event_date: string;
  location?: string;
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
  charity_goal?: number;
  charity_actual?: number;
  feedback_score?: number;
  public_slug?: string;
  max_capacity?: number;
  current_rsvp_count?: number;
  header_image_url?: string;
  brand_color?: string;
  is_published?: boolean;
}

export interface EventTask {
  id: string;
  event_id?: string;
  agent_id: string;
  task_name: string;
  responsible_person: string;
  due_date: string;
  completed_at?: string;
  status?: string;
  notes?: string;
  phase?: string;
  created_at: string;
  updated_at: string;
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

  const addEvent = async (eventData: Omit<Event, 'id' | 'agent_id'> & { is_published?: boolean; max_capacity?: number; header_image_url?: string; brand_color?: string }) => {
    if (!user) return;

    try {
      // Fetch agent branding from profiles to auto-populate event branding
      let agentBranding = {
        primary_color: eventData.brand_color || undefined,
        logo_url: undefined as string | undefined,
        header_image_url: eventData.header_image_url || undefined,
      };

      try {
        const { data: marketingData } = await supabase
          .from('agent_marketing_settings')
          .select('primary_color, logo_colored_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (marketingData) {
          if (!eventData.brand_color && marketingData.primary_color) {
            agentBranding.primary_color = marketingData.primary_color;
          }
          if (!eventData.header_image_url && marketingData.logo_colored_url) {
            agentBranding.logo_url = marketingData.logo_colored_url;
          }
        }
      } catch (error) {
        console.warn('Could not fetch agent branding, using provided values:', error);
      }

      // Generate public slug if event is being published
      let publicSlug: string | undefined = undefined;
      if (eventData.is_published && eventData.title) {
        const { data: slugData, error: slugError } = await supabase
          .rpc('generate_event_slug', { title: eventData.title });
        
        if (!slugError && slugData) {
          publicSlug = slugData;
        }
      }

      const { data, error } = await supabase
        .from('events')
        .insert([{ 
          ...eventData, 
          agent_id: user.id,
          public_slug: publicSlug,
          current_rsvp_count: 0,
          brand_color: agentBranding.primary_color,
          logo_url: agentBranding.logo_url,
          header_image_url: agentBranding.header_image_url || eventData.header_image_url,
        }])
        .select()
        .single();

      if (error) throw error;

      // Auto-generate tasks from template with calculated due dates
      if (data) {
        const tasksToInsert = buildTaskInserts(data.id, user.id, new Date(data.event_date));

        const { error: tasksError } = await supabase
          .from('event_tasks')
          .insert(tasksToInsert);

        if (tasksError) {
          console.error('Error creating tasks:', tasksError);
          throw new Error(`Event created but failed to create tasks: ${tasksError.message}`);
        }

        // Immediately refresh tasks to show them in the UI
        await fetchEventTasks();

      }

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
      // Find the current event to check if title actually changed
      const currentEvent = events.find(e => e.id === id);
      
      // Only generate new slug if:
      // 1. Title actually changed AND event is published, OR
      // 2. Event is being newly published (no existing slug)
      const titleChanged = currentEvent && updates.title && updates.title !== currentEvent.title;
      const newlyPublished = updates.is_published && !currentEvent?.public_slug;
      
      if ((titleChanged || newlyPublished) && updates.is_published && updates.title) {
        const { data: slugData, error: slugError } = await supabase
          .rpc('generate_event_slug', { title: updates.title });
        
        if (!slugError && slugData) {
          updates.public_slug = slugData;
        }
      }

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

  const deleteEvent = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
        .eq('agent_id', user.id);

      if (error) throw error;
      setEvents(prev => prev.filter(event => event.id !== id));
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  };

  // Admin functions - bypass agent_id checks
  const addEventAsAdmin = async (eventData: Omit<Event, 'id' | 'agent_id'> & { is_published?: boolean; max_capacity?: number; header_image_url?: string; brand_color?: string }, agentId: string) => {
    if (!user) return;

    try {
      // Fetch agent branding from profiles to auto-populate event branding
      let agentBranding = {
        primary_color: eventData.brand_color || undefined,
        logo_url: undefined as string | undefined,
        header_image_url: eventData.header_image_url || undefined,
      };

      try {
        const { data: marketingData } = await supabase
          .from('agent_marketing_settings')
          .select('primary_color, logo_colored_url')
          .eq('user_id', agentId)
          .maybeSingle();

        if (marketingData) {
          if (!eventData.brand_color && marketingData.primary_color) {
            agentBranding.primary_color = marketingData.primary_color;
          }
          if (!eventData.header_image_url && marketingData.logo_colored_url) {
            agentBranding.logo_url = marketingData.logo_colored_url;
          }
        }
      } catch (error) {
        console.warn('Could not fetch agent branding, using provided values:', error);
      }

      // Generate public slug if event is being published
      let publicSlug: string | undefined = undefined;
      if (eventData.is_published && eventData.title) {
        const { data: slugData, error: slugError } = await supabase
          .rpc('generate_event_slug', { title: eventData.title });
        
        if (!slugError && slugData) {
          publicSlug = slugData;
        }
      }

      const { data, error } = await supabase
        .from('events')
        .insert([{ 
          ...eventData, 
          agent_id: agentId,
          public_slug: publicSlug,
          current_rsvp_count: 0,
          brand_color: agentBranding.primary_color,
          logo_url: agentBranding.logo_url,
          header_image_url: agentBranding.header_image_url || eventData.header_image_url,
        }])
        .select()
        .single();

      if (error) throw error;

      // Auto-generate tasks from template with calculated due dates
      if (data) {
        const tasksToInsert = buildTaskInserts(data.id, agentId, new Date(data.event_date));

        const { error: tasksError } = await supabase
          .from('event_tasks')
          .insert(tasksToInsert);

        if (tasksError) {
          console.error('Error creating tasks:', tasksError);
          throw new Error(`Event created but failed to create tasks: ${tasksError.message}`);
        }
      }

      // Auto-create ClickUp folder (fire-and-forget)
      if (data) {
        supabase.functions.invoke('clickup-create-event-folder', {
          body: { eventId: data.id, agentId: agentId, eventTitle: data.title, eventDate: data.event_date }
        }).then(({ error: clickupErr }) => {
          if (clickupErr) console.error('ClickUp folder creation failed (admin):', clickupErr);
          else console.log('ClickUp folder created for event (admin):', data.id);
        });
      }

      return data;
    } catch (error) {
      console.error('Error adding event as admin:', error);
      throw error;
    }
  };

  const updateEventAsAdmin = async (id: string, updates: Partial<Event>, agentId: string) => {
    if (!user) return;

    try {
      // First fetch the current event to check if title actually changed
      const { data: currentEvent } = await supabase
        .from('events')
        .select('title, public_slug')
        .eq('id', id)
        .single();
      
      // Only generate new slug if:
      // 1. Title actually changed AND event is published, OR
      // 2. Event is being newly published (no existing slug)
      const titleChanged = currentEvent && updates.title && updates.title !== currentEvent.title;
      const newlyPublished = updates.is_published && !currentEvent?.public_slug;
      
      if ((titleChanged || newlyPublished) && updates.is_published && updates.title) {
        const { data: slugData, error: slugError } = await supabase
          .rpc('generate_event_slug', { title: updates.title });
        
        if (!slugError && slugData) {
          updates.public_slug = slugData;
        }
      }

      const { data, error } = await supabase
        .from('events')
        .update({ ...updates, agent_id: agentId })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating event as admin:', error);
      throw error;
    }
  };

  const deleteEventAsAdmin = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting event as admin:', error);
      throw error;
    }
  };

  const addTask = async (taskData: Omit<EventTask, 'id' | 'agent_id' | 'created_at' | 'updated_at'>) => {
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
    deleteEvent,
    addEventAsAdmin,
    updateEventAsAdmin,
    deleteEventAsAdmin,
    addTask,
    updateTask,
    markTaskComplete,
    deleteTask,
    fetchEventTasks,
    getPreviousQuarterEvent,
    getNextEvent
  };
};
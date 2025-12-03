import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RSVP {
  id: string;
  event_id: string;
  email: string;
  name: string;
  phone?: string;
  guest_count: number;
  status: 'confirmed' | 'cancelled' | 'waitlist';
  rsvp_date: string;
  check_in_status: 'not_checked_in' | 'checked_in' | 'no_show';
  checked_in_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RSVPStats {
  total: number;
  confirmed: number;
  cancelled: number;
  waitlist: number;
  checked_in: number;
  not_checked_in: number;
}

export interface RSVPFormData {
  name: string;
  email: string;
  phone?: string;
  guest_count: number;
}

export const useRSVP = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submit RSVP (public, no auth required)
  const submitRSVP = async (eventId: string, formData: RSVPFormData): Promise<RSVP> => {
    setLoading(true);
    setError(null);

    try {
      // Check if event exists and is published
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, max_capacity, current_rsvp_count, is_published')
        .eq('id', eventId)
        .eq('is_published', true)
        .single();

      if (eventError || !event) {
        throw new Error('Event not found or not published');
      }

      // Check capacity if max_capacity is set
      if (event.max_capacity && event.current_rsvp_count >= event.max_capacity) {
        // Check if there's already an RSVP for this email
        const { data: existingRSVP } = await supabase
          .from('event_rsvps')
          .select('id, status')
          .eq('event_id', eventId)
          .eq('email', formData.email.toLowerCase())
          .single();

        if (existingRSVP && existingRSVP.status === 'confirmed') {
          throw new Error('You have already RSVPed for this event');
        }

        // Add to waitlist
        const { data: rsvp, error: rsvpError } = await supabase
          .from('event_rsvps')
          .insert([{
            event_id: eventId,
            email: formData.email.toLowerCase(),
            name: formData.name,
            phone: formData.phone || null,
            guest_count: formData.guest_count || 1,
            status: 'waitlist'
          }])
          .select()
          .single();

        if (rsvpError) {
          if (rsvpError.code === '23505') {
            throw new Error('You have already RSVPed for this event');
          }
          throw rsvpError;
        }

        return rsvp as RSVP;
      }

      // Check for duplicate RSVP
      const { data: existingRSVP } = await supabase
        .from('event_rsvps')
        .select('id, status')
        .eq('event_id', eventId)
        .eq('email', formData.email.toLowerCase())
        .single();

      if (existingRSVP && existingRSVP.status === 'confirmed') {
        throw new Error('You have already RSVPed for this event');
      }

      // Create RSVP
      const { data: rsvp, error: rsvpError } = await supabase
        .from('event_rsvps')
        .insert([{
          event_id: eventId,
          email: formData.email.toLowerCase(),
          name: formData.name,
          phone: formData.phone || null,
          guest_count: formData.guest_count || 1,
          status: 'confirmed'
        }])
        .select()
        .single();

      if (rsvpError) {
        if (rsvpError.code === '23505') {
          throw new Error('You have already RSVPed for this event');
        }
        throw rsvpError;
      }

      // Trigger email confirmation (fire and forget - don't block RSVP)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && anonKey) {
        // Use fetch without await to not block the RSVP
        fetch(`${supabaseUrl}/functions/v1/rsvp-confirmation-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            rsvp_id: rsvp.id,
            event_id: eventId,
          }),
        }).then(response => {
          if (!response.ok) {
            console.error('Email function returned error:', response.status, response.statusText);
          }
          return response.json();
        }).then(data => {
          console.log('Email confirmation sent:', data);
        }).catch((emailError) => {
          console.error('Failed to send confirmation email:', emailError);
          // Don't fail the RSVP if email fails
        });
      } else {
        console.warn('Missing Supabase URL or Anon Key - email confirmation skipped');
      }

      return rsvp as RSVP;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to submit RSVP';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get RSVP by email and event (public)
  const getRSVPByEmail = async (eventId: string, email: string): Promise<RSVP | null> => {
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .eq('email', email.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as RSVP | null;
    } catch (err) {
      console.error('Error fetching RSVP:', err);
      return null;
    }
  };

  // Get event by public slug (public, no auth required)
  const getEventBySlug = async (slug: string) => {
    try {
      // First fetch the event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('public_slug', slug)
        .eq('is_published', true)
        .single();

      if (eventError || !event) {
        throw eventError || new Error('Event not found');
      }

      // Then fetch the agent profile separately if agent_id exists
      let profile = null;
      if (event.agent_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name, team_name, brokerage, phone_number, office_address')
          .eq('user_id', event.agent_id)
          .single();
        
        profile = profileData;
      }

      return {
        ...event,
        profiles: profile
      };
    } catch (err) {
      console.error('Error fetching event by slug:', err);
      throw err;
    }
  };

  // Get RSVP statistics for an event (requires auth for agent)
  const getRSVPStats = async (eventId: string): Promise<RSVPStats> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('status, check_in_status')
        .eq('event_id', eventId);

      if (error) throw error;

      const stats: RSVPStats = {
        total: data?.length || 0,
        confirmed: data?.filter(r => r.status === 'confirmed').length || 0,
        cancelled: data?.filter(r => r.status === 'cancelled').length || 0,
        waitlist: data?.filter(r => r.status === 'waitlist').length || 0,
        checked_in: data?.filter(r => r.check_in_status === 'checked_in').length || 0,
        not_checked_in: data?.filter(r => r.check_in_status === 'not_checked_in').length || 0,
      };

      return stats;
    } catch (err) {
      console.error('Error fetching RSVP stats:', err);
      throw err;
    }
  };

  // Get all RSVPs for an event (requires auth for agent)
  const getEventRSVPs = async (eventId: string): Promise<RSVP[]> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('rsvp_date', { ascending: false });

      if (error) throw error;

      return (data || []) as RSVP[];
    } catch (err) {
      console.error('Error fetching event RSVPs:', err);
      throw err;
    }
  };

  // Check in an RSVP (requires auth for agent)
  const checkInRSVP = async (rsvpId: string): Promise<RSVP> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .update({
          check_in_status: 'checked_in',
          checked_in_at: new Date().toISOString(),
        })
        .eq('id', rsvpId)
        .select()
        .single();

      if (error) throw error;

      return data as RSVP;
    } catch (err) {
      console.error('Error checking in RSVP:', err);
      throw err;
    }
  };

  // Cancel RSVP (public, allows cancelling own RSVP)
  const cancelRSVP = async (rsvpId: string, email: string): Promise<RSVP> => {
    try {
      // Verify the RSVP belongs to this email
      const { data: rsvp, error: fetchError } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('id', rsvpId)
        .eq('email', email.toLowerCase())
        .single();

      if (fetchError || !rsvp) {
        throw new Error('RSVP not found');
      }

      const { data, error } = await supabase
        .from('event_rsvps')
        .update({
          status: 'cancelled',
        })
        .eq('id', rsvpId)
        .select()
        .single();

      if (error) throw error;

      return data as RSVP;
    } catch (err) {
      console.error('Error cancelling RSVP:', err);
      throw err;
    }
  };

  return {
    loading,
    error,
    submitRSVP,
    getRSVPByEmail,
    getEventBySlug,
    getRSVPStats,
    getEventRSVPs,
    checkInRSVP,
    cancelRSVP,
  };
};


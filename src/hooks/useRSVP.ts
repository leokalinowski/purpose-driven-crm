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
      // Use SECURITY DEFINER RPC to bypass RLS for anonymous submissions
      const { data, error: rpcError } = await supabase
        .rpc('submit_public_rsvp', {
          p_event_id: eventId,
          p_email: formData.email.toLowerCase(),
          p_name: formData.name,
          p_phone: formData.phone || null,
          p_guest_count: formData.guest_count || 1,
        });

      if (rpcError) {
        if (rpcError.message?.includes('already RSVPed')) {
          throw new Error('You have already RSVPed for this event');
        }
        if (rpcError.message?.includes('not published')) {
          throw new Error('Event not found or not published');
        }
        throw rpcError;
      }

      if (!data || data.length === 0) {
        throw new Error('Failed to create RSVP');
      }

      const rsvp = {
        id: data[0].id,
        status: data[0].status,
        event_id: eventId,
        email: formData.email.toLowerCase(),
        name: formData.name,
        phone: formData.phone || null,
        guest_count: formData.guest_count || 1,
        rsvp_date: new Date().toISOString(),
        check_in_status: 'not_checked_in' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as RSVP;

      // Trigger email confirmation (fire and forget)
      supabase.functions.invoke('rsvp-confirmation-email', {
        body: {
          rsvp_id: rsvp.id,
          event_id: eventId,
        },
      }).then(({ data, error: emailError }) => {
        if (emailError) {
          console.error('Email function returned error:', emailError);
        } else {
          console.log('Email confirmation sent:', data);
        }
      }).catch((emailError) => {
        console.error('Failed to send confirmation email:', emailError);
      });

      return rsvp;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to submit RSVP';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get RSVP by email and event (public) - uses secure RPC
  const getRSVPByEmail = async (eventId: string, email: string): Promise<RSVP | null> => {
    try {
      // Use secure RPC that only returns the user's own RSVP
      const { data, error } = await supabase
        .rpc('get_own_rsvp', {
          p_event_id: eventId,
          p_email: email.toLowerCase()
        });

      if (error) {
        console.error('Error fetching RSVP:', error);
        return null;
      }

      // RPC returns an array, get first result
      if (data && data.length > 0) {
        return {
          id: data[0].id,
          status: data[0].status,
          event_id: eventId,
          email: email.toLowerCase(),
        } as RSVP;
      }

      return null;
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

      // Then fetch the agent profile separately if agent_id exists (contact info only)
      let profile = null;
      let branding = null;
      if (event.agent_id) {
        const [profileRes, brandingRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('first_name, last_name, team_name, brokerage, phone_number, office_number, office_address, website, state_licenses')
            .eq('user_id', event.agent_id)
            .single(),
          supabase
            .from('agent_marketing_settings')
            .select('primary_color, secondary_color, headshot_url, logo_colored_url, logo_white_url')
            .eq('user_id', event.agent_id)
            .maybeSingle()
        ]);
        
        profile = profileRes.data;
        branding = brandingRes.data;
      }

      return {
        ...event,
        profiles: profile ? { ...profile, ...branding } : null
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


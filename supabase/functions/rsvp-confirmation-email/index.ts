import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RSVPConfirmationRequest {
  rsvp_id: string;
  event_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const FROM_NAME = Deno.env.get("RESEND_FROM_NAME") || "REOP Events";

    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const payload: RSVPConfirmationRequest = await req.json();
    const { rsvp_id, event_id } = payload;

    if (!rsvp_id || !event_id) {
      throw new Error("Missing rsvp_id or event_id");
    }

    // Fetch RSVP details
    const { data: rsvp, error: rsvpError } = await supabase
      .from('event_rsvps')
      .select('*')
      .eq('id', rsvp_id)
      .single();

    if (rsvpError || !rsvp) {
      throw new Error(`RSVP not found: ${rsvpError?.message}`);
    }

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error(`Event not found: ${eventError?.message}`);
    }

    // Fetch agent profile separately with all branding fields
    let agent: any = null;
    if (event.agent_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, team_name, brokerage, phone_number, office_number, office_address, website, state_licenses, primary_color, secondary_color, headshot_url, logo_colored_url, logo_white_url')
        .eq('user_id', event.agent_id)
        .single();
      
      agent = profileData;
    }
    const agentName = agent
      ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Your Real Estate Agent'
      : 'Your Real Estate Agent';
    const agentEmail = agent?.email || FROM_EMAIL;
    const teamName = agent?.team_name || '';
    const brokerage = agent?.brokerage || '';
    const phoneNumber = agent?.phone_number || '';
    const officeNumber = agent?.office_number || '';
    const officeAddress = agent?.office_address || '';
    const website = agent?.website || '';
    const stateLicenses = agent?.state_licenses?.length ? agent.state_licenses.join(' and ') : '';
    
    // Helper function to adjust color brightness
    function adjustBrightness(color: string, percent: number): string {
      const num = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;
      return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    // Use agent branding colors (from profiles) or event brand color, or default
    const primaryColor = agent?.primary_color || event.brand_color || '#667eea';
    const secondaryColor = agent?.secondary_color || (event.brand_color ? adjustBrightness(event.brand_color, -20) : '#764ba2');
    // Use agent logo (colored) or event logo, prefer agent branding
    const logoUrl = agent?.logo_colored_url || event.logo_url || '';
    const headshotUrl = agent?.headshot_url || '';

    // Parse date/time directly from the stored string to avoid timezone shifts
    const dateTimeParts = event.event_date.split('T');
    const datePart = dateTimeParts[0]; // "YYYY-MM-DD"
    const timePart = dateTimeParts[1]?.substring(0, 5) || '00:00'; // "HH:MM"

    const [year, month, day] = datePart.split('-').map(Number);
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dateObj = new Date(year, month - 1, day);
    const formattedDate = `${weekdays[dateObj.getDay()]}, ${monthNames[month-1]} ${day}, ${year}`;

    const [h, mi] = timePart.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    const formattedTime = `${hour12}:${String(mi).padStart(2, '0')} ${ampm}`;

    const isWaitlist = rsvp.status === 'waitlist';

    // Template resolution: event-specific → global → hardcoded fallback
    let emailSubject = ''
    let emailHtml = ''

    // Helper to replace template variables with actual data
    function replaceVariables(content: string): string {
      return content
        .replace(/{event_title}/g, event.title)
        .replace(/{event_date}/g, formattedDate)
        .replace(/{event_time}/g, formattedTime)
        .replace(/{event_description}/g, event.description || '')
        .replace(/{event_location}/g, event.location || '')
        .replace(/{agent_name}/g, agentName)
        .replace(/{agent_email}/g, agentEmail)
        .replace(/{agent_phone}/g, phoneNumber)
        .replace(/{agent_office_number}/g, officeNumber)
        .replace(/{agent_office_address}/g, officeAddress)
        .replace(/{agent_website}/g, website)
        .replace(/{agent_brokerage}/g, brokerage)
        .replace(/{agent_team_name}/g, teamName)
        .replace(/{primary_color}/g, primaryColor)
        .replace(/{secondary_color}/g, secondaryColor)
        .replace(/{headshot_url}/g, headshotUrl)
        .replace(/{logo_colored_url}/g, logoUrl)
        .replace(/{logo_white_url}/g, agent?.logo_white_url || '')
        .replace(/\{#if ([^}]+)\}([\s\S]*?)\{\/if\}/g, (_, varName, inner) => {
          const val = inner.trim()
          return val ? inner : ''
        })
    }

    // 1. Check event-specific template
    const { data: eventTemplate } = await supabase
      .from('event_email_templates')
      .select('*')
      .eq('event_id', event_id)
      .eq('email_type', 'confirmation')
      .eq('is_active', true)
      .single()

    if (eventTemplate) {
      emailSubject = replaceVariables(eventTemplate.subject)
      emailHtml = replaceVariables(eventTemplate.html_content)
    }

    // If no template found, fail visibly instead of using hardcoded fallback
    if (!emailHtml) {
      return new Response(
        JSON.stringify({ error: 'No confirmation template found for this event. Please create one in the Email Templates editor (event-specific or global).' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    if (!emailSubject) {
      emailSubject = isWaitlist
        ? `Waitlist Confirmation: ${event.title}`
        : `RSVP Confirmed: ${event.title}`
    }

    // Send email
    const resend = new Resend(RESEND_API_KEY);

    const { data, error: emailError } = await resend.emails.send({
      from: `${agentName} - Events <noreply@events.realestateonpurpose.com>`,
      to: rsvp.email,
      subject: emailSubject,
      html: emailHtml,
      reply_to: agentEmail,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    // Record email in tracking table
    const { error: trackingError } = await supabase
      .from('event_emails')
      .insert({
        event_id: event_id,
        rsvp_id: rsvp.id,
        email_type: 'confirmation',
        recipient_email: rsvp.email,
        subject: emailSubject,
        status: 'sent',
        sent_at: new Date().toISOString(),
        resend_id: data?.id
      })

    if (trackingError) {
      console.error('Error recording email tracking:', trackingError)
    }

    // Log to unified email_logs table
    try {
      await supabase
        .from('email_logs')
        .insert({
          email_type: 'event_confirmation',
          recipient_email: rsvp.email,
          recipient_name: rsvp.name,
          agent_id: event.agent_id,
          subject: emailSubject,
          status: 'sent',
          resend_email_id: data?.id,
          metadata: {
            event_id: eventId,
            event_title: event.title,
            rsvp_id: rsvp.id,
            is_waitlist: isWaitlist
          },
          sent_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Failed to log email to unified email_logs table:', logError);
    }

    console.log(`RSVP confirmation email sent to ${rsvp.email} for event ${event.title}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Confirmation email sent",
        email_id: data?.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending RSVP confirmation email:", error);
    
    // Log failed email to unified email_logs table
    try {
      const payload: RSVPConfirmationRequest = await req.json().catch(() => ({ rsvp_id: '', event_id: '' }));
      if (payload.rsvp_id && payload.event_id) {
        const { data: rsvp } = await supabase
          .from('event_rsvps')
          .select('email, name')
          .eq('id', payload.rsvp_id)
          .single();
        
        const { data: event } = await supabase
          .from('events')
          .select('title, agent_id')
          .eq('id', payload.event_id)
          .single();

        if (rsvp && event) {
          await supabase
            .from('email_logs')
            .insert({
              email_type: 'event_confirmation',
              recipient_email: rsvp.email,
              recipient_name: rsvp.name,
              agent_id: event.agent_id,
              subject: `RSVP Confirmation: ${event.title}`,
              status: 'failed',
              error_message: error.message || error.toString(),
              metadata: {
                event_id: payload.event_id,
                event_title: event.title,
                rsvp_id: payload.rsvp_id
              }
            });
        }
      }
    } catch (logError) {
      console.error('Failed to log failed email:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send confirmation email",
        details: error.toString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});


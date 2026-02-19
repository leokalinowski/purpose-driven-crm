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
    } else {
      // 2. Check global template
      const { data: globalTemplate } = await supabase
        .from('global_email_templates')
        .select('*')
        .eq('email_type', 'confirmation')
        .eq('is_active', true)
        .single()

      if (globalTemplate) {
        emailSubject = replaceVariables(globalTemplate.subject)
        emailHtml = replaceVariables(globalTemplate.html_content)
      }
    }

    // 3. Fallback to hardcoded HTML if no saved template found
    if (!emailHtml) {
      emailSubject = isWaitlist
        ? `Waitlist Confirmation: ${event.title}`
        : `RSVP Confirmed: ${event.title}`

      emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isWaitlist ? 'Waitlist Confirmation' : 'RSVP Confirmation'}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f7fa; padding: 20px;">
            <tr>
              <td align="center">
                <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 40px 30px; text-align: center;">
                      ${logoUrl ? `<img src="${logoUrl}" alt="${agentName}" style="max-width: 150px; height: auto; margin-bottom: 15px; border-radius: 8px; background: rgba(255,255,255,0.1); padding: 8px;" />` : ''}
                      ${headshotUrl && !logoUrl ? `<img src="${headshotUrl}" alt="${agentName}" style="max-width: 100px; height: 100px; margin-bottom: 15px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); object-fit: cover;" />` : ''}
                      <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">${isWaitlist ? "You're on the Waitlist!" : 'RSVP Confirmed!'}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="font-size: 18px; color: #1f2937; margin: 0 0 25px 0; font-weight: 500;">Hi ${rsvp.name},</p>
                      <p style="font-size: 16px; color: #4b5563; margin: 0 0 30px 0; line-height: 1.7;">
                        ${isWaitlist
                          ? `Thank you for your interest in <strong style="color: ${primaryColor};">${event.title}</strong>. We've added you to our waitlist.`
                          : `Thank you for RSVPing to <strong style="color: ${primaryColor};">${event.title}</strong>! We're excited to have you join us.`
                        }
                      </p>
                      <div style="background: #f9fafb; border-left: 5px solid ${primaryColor}; padding: 25px; margin: 30px 0; border-radius: 8px;">
                        <h2 style="margin: 0 0 20px 0; color: ${primaryColor}; font-size: 22px;">Event Details</h2>
                        <p style="margin: 8px 0; color: #1f2937;"><strong>Event:</strong> ${event.title}</p>
                        <p style="margin: 8px 0; color: #1f2937;"><strong>Date:</strong> ${formattedDate}</p>
                        <p style="margin: 8px 0; color: #1f2937;"><strong>Time:</strong> ${formattedTime}</p>
                        ${event.location ? `<p style="margin: 8px 0; color: #1f2937;"><strong>Location:</strong> ${event.location}</p>` : ''}
                        <p style="margin: 8px 0; color: #1f2937;"><strong>Guests:</strong> ${rsvp.guest_count}</p>
                      </div>
                      <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #e5e7eb;">
                        <h3 style="color: #1f2937; font-size: 20px; margin: 0 0 20px 0;">Your Event Host</h3>
                        <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1f2937;">${agentName}</p>
                        ${teamName || brokerage ? `<p style="margin: 0 0 12px 0; color: #4b5563;">${teamName ? `<strong>${teamName}</strong>` : ''}${teamName && brokerage ? ' | ' : ''}${brokerage}</p>` : ''}
                        ${phoneNumber ? `<p style="margin: 8px 0;">📱 <a href="tel:${phoneNumber.replace(/\D/g, '')}" style="color: ${primaryColor};">${phoneNumber}</a></p>` : ''}
                        ${agentEmail ? `<p style="margin: 8px 0;">📧 <a href="mailto:${agentEmail}" style="color: ${primaryColor};">${agentEmail}</a></p>` : ''}
                        ${website ? `<p style="margin: 8px 0;">🌐 <a href="${website.startsWith('http') ? website : 'https://' + website}" style="color: ${primaryColor};">${website}</a></p>` : ''}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #9ca3af; font-size: 12px;">Real Estate on Purpose | REOP Event Engine™</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
      `
    } else if (!emailSubject) {
      emailSubject = isWaitlist
        ? `Waitlist Confirmation: ${event.title}`
        : `RSVP Confirmed: ${event.title}`
    }

    // Send email
    const resend = new Resend(RESEND_API_KEY);

    const { data, error: emailError } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
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


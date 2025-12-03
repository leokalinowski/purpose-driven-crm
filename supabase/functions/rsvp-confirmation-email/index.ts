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

    // Fetch agent profile separately
    let agent = null;
    if (event.agent_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, team_name, brokerage, phone_number, office_address')
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
    const officeAddress = agent?.office_address || '';

    const eventDate = new Date(event.event_date);
    // Format date manually to avoid date-fns dependency issues
    const formattedDate = eventDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = eventDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    const isWaitlist = rsvp.status === 'waitlist';

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isWaitlist ? 'Waitlist Confirmation' : 'RSVP Confirmation'}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">
              ${isWaitlist ? 'You\'re on the Waitlist!' : 'RSVP Confirmed!'}
            </h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${isWaitlist 
                ? `Hi ${rsvp.name},<br><br>Thank you for your interest in <strong>${event.title}</strong>. The event is currently at capacity, but we've added you to our waitlist. We'll notify you immediately if a spot becomes available.`
                : `Hi ${rsvp.name},<br><br>Thank you for RSVPing to <strong>${event.title}</strong>! We're excited to have you join us.`
              }
            </p>

            <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">Event Details</h2>
              <p style="margin: 8px 0;"><strong>Event:</strong> ${event.title}</p>
              <p style="margin: 8px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
              ${event.location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${event.location}</p>` : ''}
              <p style="margin: 8px 0;"><strong>Guests:</strong> ${rsvp.guest_count} ${rsvp.guest_count === 1 ? 'guest' : 'guests'}</p>
            </div>

            ${event.description ? `
              <div style="margin: 20px 0;">
                <h3 style="color: #374151; font-size: 18px;">About This Event</h3>
                <p style="color: #6b7280; line-height: 1.6;">${event.description}</p>
              </div>
            ` : ''}

            ${isWaitlist ? `
              <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e;">
                  <strong>Waitlist Status:</strong> You'll receive an email notification if a spot becomes available. Please keep an eye on your inbox!
                </p>
              </div>
            ` : `
              <div style="background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0; color: #065f46;">
                  <strong>✓ Confirmed:</strong> Your RSVP has been confirmed. We'll send you a reminder closer to the event date.
                </p>
              </div>
            `}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">
                <strong>Hosted by:</strong> ${agentName}
                ${teamName ? `<br>${teamName}` : ''}
                ${brokerage ? ` | ${brokerage}` : ''}
              </p>
              ${phoneNumber ? `<p style="margin: 8px 0; color: #6b7280; font-size: 14px;"><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
              ${officeAddress ? `<p style="margin: 8px 0; color: #6b7280; font-size: 14px;">${officeAddress}</p>` : ''}
            </div>

            <div style="margin-top: 30px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px;">
                Questions? Reply to this email or contact ${agentName}${phoneNumber ? ` at ${phoneNumber}` : ''}.
              </p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px;">
              This is an automated confirmation email. If you need to cancel your RSVP, please contact the event organizer.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 10px;">
              Real Estate on Purpose | REOP Event Engine™
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email
    const resend = new Resend(RESEND_API_KEY);

    const { data, error: emailError } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: rsvp.email,
      subject: isWaitlist
        ? `Waitlist Confirmation: ${event.title}`
        : `RSVP Confirmed: ${event.title}`,
      html: emailHtml,
      reply_to: agentEmail,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
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


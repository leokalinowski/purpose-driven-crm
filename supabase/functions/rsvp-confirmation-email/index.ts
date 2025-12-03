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
        .select('first_name, last_name, email, team_name, brokerage, phone_number, office_number, office_address, website, state_licenses')
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
    
    // Use event brand color or default to modern gradient
    const primaryColor = event.brand_color || '#667eea';
    const secondaryColor = event.brand_color ? adjustBrightness(event.brand_color, -20) : '#764ba2';
    const logoUrl = event.logo_url || '';

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

    // Build email HTML with modern, branded design
    const emailHtml = `
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
                  <!-- Header with gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 40px 30px; text-align: center;">
                      ${logoUrl ? `<img src="${logoUrl}" alt="${agentName}" style="max-width: 150px; height: auto; margin-bottom: 15px; border-radius: 8px;" />` : ''}
                      <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        ${isWaitlist ? 'You\'re on the Waitlist!' : 'RSVP Confirmed!'}
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="font-size: 18px; color: #1f2937; margin: 0 0 25px 0; font-weight: 500;">
                        Hi ${rsvp.name},
                      </p>
                      <p style="font-size: 16px; color: #4b5563; margin: 0 0 30px 0; line-height: 1.7;">
                        ${isWaitlist 
                          ? `Thank you for your interest in <strong style="color: ${primaryColor};">${event.title}</strong>. The event is currently at capacity, but we've added you to our waitlist. We'll notify you immediately if a spot becomes available.`
                          : `Thank you for RSVPing to <strong style="color: ${primaryColor};">${event.title}</strong>! We're excited to have you join us.`
                        }
                      </p>

                      <!-- Event Details Card -->
                      <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-left: 5px solid ${primaryColor}; padding: 25px; margin: 30px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
                        <h2 style="margin: 0 0 20px 0; color: ${primaryColor}; font-size: 22px; font-weight: 600;">Event Details</h2>
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #374151; font-weight: 600; width: 100px;">Event:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${event.title}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #374151; font-weight: 600;">Date:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${formattedDate}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #374151; font-weight: 600;">Time:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${formattedTime}</td>
                          </tr>
                          ${event.location ? `
                          <tr>
                            <td style="padding: 8px 0; color: #374151; font-weight: 600;">Location:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${event.location}</td>
                          </tr>
                          ` : ''}
                          <tr>
                            <td style="padding: 8px 0; color: #374151; font-weight: 600;">Guests:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${rsvp.guest_count} ${rsvp.guest_count === 1 ? 'guest' : 'guests'}</td>
                          </tr>
                        </table>
                      </div>

                      ${event.description ? `
                      <div style="margin: 30px 0;">
                        <h3 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 12px 0;">About This Event</h3>
                        <p style="color: #6b7280; line-height: 1.7; margin: 0;">${event.description}</p>
                      </div>
                      ` : ''}

                      ${isWaitlist ? `
                      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 30px 0;">
                        <p style="margin: 0; color: #92400e; font-size: 15px; font-weight: 500;">
                          <strong>⏳ Waitlist Status:</strong> You'll receive an email notification if a spot becomes available. Please keep an eye on your inbox!
                        </p>
                      </div>
                      ` : `
                      <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 30px 0;">
                        <p style="margin: 0; color: #065f46; font-size: 15px; font-weight: 500;">
                          <strong>✓ Confirmed:</strong> Your RSVP has been confirmed. We'll send you a reminder closer to the event date.
                        </p>
                      </div>
                      `}

                      <!-- Agent Contact Section -->
                      <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #e5e7eb;">
                        <h3 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 20px 0;">Your Event Host</h3>
                        <div style="background: #f9fafb; padding: 25px; border-radius: 8px;">
                          <p style="margin: 0 0 12px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                            ${agentName}${agentName.includes('REALTOR') ? '' : ' - REALTOR®'}
                          </p>
                          ${teamName || brokerage ? `
                          <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 15px;">
                            ${teamName ? `<strong>${teamName}</strong>` : ''}${teamName && brokerage ? ' | ' : ''}${brokerage ? brokerage : ''}
                          </p>
                          ` : ''}
                          ${officeAddress ? `
                          <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                            📍 ${officeAddress}
                          </p>
                          ` : ''}
                          ${stateLicenses ? `
                          <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 13px;">
                            Licensed in ${stateLicenses}
                          </p>
                          ` : ''}
                          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                            ${phoneNumber ? `
                            <p style="margin: 8px 0; color: #1f2937; font-size: 15px;">
                              📱 <a href="tel:${phoneNumber.replace(/\D/g, '')}" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">${phoneNumber}</a>
                            </p>
                            ` : ''}
                            ${officeNumber ? `
                            <p style="margin: 8px 0; color: #1f2937; font-size: 15px;">
                              ☎️ <a href="tel:${officeNumber.replace(/\D/g, '')}" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">Office: ${officeNumber}</a>
                            </p>
                            ` : ''}
                            ${agentEmail ? `
                            <p style="margin: 8px 0; color: #1f2937; font-size: 15px;">
                              📧 <a href="mailto:${agentEmail}" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">${agentEmail}</a>
                            </p>
                            ` : ''}
                            ${website ? `
                            <p style="margin: 8px 0; color: #1f2937; font-size: 15px;">
                              🌐 <a href="${website.startsWith('http') ? website : 'https://' + website}" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;" target="_blank">${website}</a>
                            </p>
                            ` : ''}
                          </div>
                        </div>
                        <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; text-align: center;">
                          Questions? Reply to this email or contact ${agentName}${phoneNumber ? ` at ${phoneNumber}` : ''}.
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
                        This is an automated confirmation email. If you need to cancel your RSVP, please contact the event organizer.
                      </p>
                      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                        Real Estate on Purpose | REOP Event Engine™
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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


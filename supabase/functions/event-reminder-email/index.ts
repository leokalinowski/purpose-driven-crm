import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Helper function to log email to unified email_logs table
async function logEmailToUnifiedTable(
  supabaseClient: any,
  emailType: string,
  recipientEmail: string,
  recipientName: string | null,
  agentId: string | null,
  subject: string,
  status: 'sent' | 'failed',
  resendId: string | null,
  errorMessage: string | null,
  metadata: any
) {
  try {
    await supabaseClient
      .from('email_logs')
      .insert({
        email_type: emailType,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        agent_id: agentId,
        subject: subject,
        status: status,
        resend_email_id: resendId,
        error_message: errorMessage,
        metadata: metadata,
        sent_at: status === 'sent' ? new Date().toISOString() : null
      });
  } catch (error) {
    console.error('Failed to log email to unified email_logs table:', error);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  eventId: string
  emailType: 'reminder_7day' | 'reminder_1day'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { eventId, emailType }: EmailRequest = await req.json()

    // Get event details with agent info
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select(`
        *,
        profiles:agent_id (
          first_name,
          last_name,
          email,
          phone_number,
          office_number,
          office_address,
          website,
          primary_color,
          secondary_color,
          logo_colored_url,
          logo_white_url,
          team_name,
          brokerage
        )
      `)
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      throw new Error('Event not found')
    }

    // Get confirmed RSVPs
    const { data: rsvps, error: rsvpsError } = await supabaseClient
      .from('event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'confirmed')

    if (rsvpsError) {
      throw new Error('Failed to fetch RSVPs')
    }

    // Get or create email template
    let { data: template, error: templateError } = await supabaseClient
      .from('event_email_templates')
      .select('*')
      .eq('event_id', eventId)
      .eq('email_type', emailType)
      .eq('is_active', true)
      .single()

    if (templateError || !template) {
      // Create default template
      const agentName = event.profiles ?
        `${event.profiles.first_name || ''} ${event.profiles.last_name || ''}`.trim() || 'Event Organizer' :
        'Event Organizer'

      const eventDate = new Date(event.event_date)
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })

      const defaultTemplate = await supabaseClient
        .rpc('get_default_email_template', {
          email_type: emailType,
          agent_name: agentName,
          event_title: event.title,
          event_date: formattedDate
        })

      const { data: newTemplate, error: createError } = await supabaseClient
        .from('event_email_templates')
        .insert({
          event_id: eventId,
          email_type: emailType,
          subject: defaultTemplate.subject,
          html_content: defaultTemplate.html_content,
          text_content: defaultTemplate.text_content
        })
        .select()
        .single()

      if (createError) {
        throw new Error('Failed to create email template')
      }

      template = newTemplate
    }

    // Send emails to confirmed RSVPs
    const emailPromises = rsvps.map(async (rsvp) => {
      try {
        // Check if this email was already sent
        const { data: existingEmail } = await supabaseClient
          .from('event_emails')
          .select('id')
          .eq('event_id', eventId)
          .eq('rsvp_id', rsvp.id)
          .eq('email_type', emailType)
          .single()

        if (existingEmail) {
          console.log(`Email already sent to ${rsvp.email} for ${emailType}`)
          return
        }

        // Send email via Resend
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Real Estate on Purpose <noreply@realestateonpurpose.com>',
            to: [rsvp.email],
            subject: template.subject,
            html: template.html_content,
            text: template.text_content,
            reply_to: event.profiles?.email || 'noreply@realestateonpurpose.com',
            tags: [
              { name: 'event_id', value: eventId },
              { name: 'email_type', value: emailType },
              { name: 'rsvp_id', value: rsvp.id }
            ]
          }),
        })

        const resendData = await resendResponse.json()

        if (!resendResponse.ok) {
          throw new Error(`Resend API error: ${resendData.message}`)
        }

        // Record email in tracking table
        await supabaseClient
          .from('event_emails')
          .insert({
            event_id: eventId,
            rsvp_id: rsvp.id,
            email_type: emailType,
            recipient_email: rsvp.email,
            subject: template.subject,
            status: 'sent',
            sent_at: new Date().toISOString(),
            resend_id: resendData.id
          })

        // Log to unified email_logs table
        await logEmailToUnifiedTable(
          supabaseClient,
          emailType === 'reminder_7day' ? 'event_reminder_7day' : 'event_reminder_1day',
          rsvp.email,
          rsvp.name,
          event.agent_id,
          template.subject,
          'sent',
          resendData.id,
          null,
          {
            event_id: eventId,
            event_title: event.title,
            rsvp_id: rsvp.id
          }
        )

      } catch (error) {
        console.error(`Failed to send email to ${rsvp.email}:`, error)

        // Record failed email
        await supabaseClient
          .from('event_emails')
          .insert({
            event_id: eventId,
            rsvp_id: rsvp.id,
            email_type: emailType,
            recipient_email: rsvp.email,
            subject: template.subject,
            status: 'failed',
            error_message: error.message
          })

        // Log to unified email_logs table
        await logEmailToUnifiedTable(
          supabaseClient,
          emailType === 'reminder_7day' ? 'event_reminder_7day' : 'event_reminder_1day',
          rsvp.email,
          rsvp.name,
          event.agent_id,
          template.subject,
          'failed',
          null,
          error.message,
          {
            event_id: eventId,
            event_title: event.title,
            rsvp_id: rsvp.id
          }
        )
      }
    })

    await Promise.all(emailPromises)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reminder emails sent to ${rsvps.length} attendees`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )

  } catch (error) {
    console.error('Error sending reminder emails:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

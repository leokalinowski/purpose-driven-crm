import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to log to unified email_logs table
async function logEmailToUnifiedTable(
  supabase: any,
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
    const { error } = await supabase.from('email_logs').insert({
      email_type: emailType,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      agent_id: agentId,
      subject,
      status,
      resend_email_id: resendId,
      error_message: errorMessage,
      metadata,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    if (error) console.error('Failed to log to email_logs:', error)
  } catch (e) {
    console.error('Failed to log email:', e)
  }
}

function formatEventDateTime(eventDate: string) {
  const dateTimeParts = eventDate.split('T')
  const datePart = dateTimeParts[0]
  const timePart = dateTimeParts[1]?.substring(0, 5) || '00:00'

  const [year, month, day] = datePart.split('-').map(Number)
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const dateObj = new Date(year, month - 1, day)
  const formattedDate = `${weekdays[dateObj.getDay()]}, ${monthNames[month-1]} ${day}, ${year}`

  const [h, mi] = timePart.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  const formattedTime = `${hour12}:${String(mi).padStart(2, '0')} ${ampm}`

  return { formattedDate, formattedTime, datePart }
}

function makeReplaceVars(event: any, agentName: string, primaryColor: string, secondaryColor: string, formattedDate: string, formattedTime: string) {
  const rsvpLink = event.public_slug
    ? `https://hub.realestateonpurpose.com/event/${event.public_slug}`
    : ''

  return function replaceVars(content: string): string {
    return content
      .replace(/{event_title}/g, event.title)
      .replace(/{event_date}/g, formattedDate)
      .replace(/{event_time}/g, formattedTime)
      .replace(/{event_description}/g, event.description || '')
      .replace(/{event_location}/g, event.location || '')
      .replace(/{agent_name}/g, agentName)
      .replace(/{agent_email}/g, event.profiles?.email || '')
      .replace(/{agent_phone}/g, event.profiles?.phone_number || '')
      .replace(/{agent_office_number}/g, event.profiles?.office_number || '')
      .replace(/{agent_office_address}/g, event.profiles?.office_address || '')
      .replace(/{agent_website}/g, event.profiles?.website || '')
      .replace(/{agent_brokerage}/g, event.profiles?.brokerage || '')
      .replace(/{agent_team_name}/g, event.profiles?.team_name || '')
      .replace(/{primary_color}/g, primaryColor)
      .replace(/{secondary_color}/g, secondaryColor)
      .replace(/{headshot_url}/g, event.profiles?.headshot_url || '')
      .replace(/{logo_colored_url}/g, event.profiles?.logo_colored_url || '')
      .replace(/{logo_white_url}/g, event.profiles?.logo_white_url || '')
      .replace(/{rsvp_link}/g, rsvpLink)
      .replace(/\{#if ([^}]+)\}([\s\S]*?)\{\/if\}/g, (_, _varName, inner) => inner.trim() ? inner : '')
  }
}

async function resolveTemplate(supabase: any, eventId: string, emailType: string, replaceVars: (s: string) => string, event: any, agentName: string, primaryColor: string, formattedDate: string, formattedTime: string) {
  // 1. Event-specific template
  const { data: eventTemplate } = await supabase
    .from('event_email_templates')
    .select('*')
    .eq('event_id', eventId)
    .eq('email_type', emailType)
    .eq('is_active', true)
    .single()

  if (eventTemplate) {
    return {
      subject: replaceVars(eventTemplate.subject),
      html_content: replaceVars(eventTemplate.html_content),
      text_content: eventTemplate.text_content ? replaceVars(eventTemplate.text_content) : null,
    }
  }

  // 2. Global template
  const { data: globalTemplate } = await supabase
    .from('global_email_templates')
    .select('*')
    .eq('email_type', emailType)
    .eq('is_active', true)
    .single()

  if (globalTemplate) {
    return {
      subject: replaceVars(globalTemplate.subject),
      html_content: replaceVars(globalTemplate.html_content),
      text_content: globalTemplate.text_content ? replaceVars(globalTemplate.text_content) : null,
    }
  }

  // 3. Hardcoded fallback
  const labels: Record<string, string> = {
    reminder_7day: '7-Day Reminder',
    reminder_1day: '1-Day Reminder',
    thank_you: 'Thank You',
    no_show: 'Follow Up',
  }
  const typeLabel = labels[emailType] || emailType
  const isPostEvent = emailType === 'thank_you' || emailType === 'no_show'

  const eventDetailsBlock = isPostEvent
    ? `<p>Thank you for your interest in <strong>${event.title}</strong>.</p>`
    : `<p>This is a ${typeLabel.toLowerCase()} for <strong>${event.title}</strong> on ${formattedDate} at ${formattedTime}.</p>
      ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ''}`

  return {
    subject: `${typeLabel}: ${event.title}`,
    html_content: `<html><body style="font-family: sans-serif; padding: 20px;">
      <h1 style="color: ${primaryColor};">${typeLabel}</h1>
      <p>Hi there,</p>
      ${eventDetailsBlock}
      <p>Best regards,<br/>${agentName}</p>
    </body></html>`,
    text_content: null,
  }
}

async function sendEmailWithDedup(
  supabase: any,
  eventId: string,
  rsvpId: string,
  emailType: string,
  recipientEmail: string,
  recipientName: string,
  agentId: string | null,
  agentName: string,
  template: { subject: string; html_content: string; text_content: string | null },
  replyTo: string,
  eventTitle: string
) {
  // Dedup check
  const { data: existing } = await supabase
    .from('event_emails')
    .select('id')
    .eq('event_id', eventId)
    .eq('rsvp_id', rsvpId)
    .eq('email_type', emailType)
    .maybeSingle()

  if (existing) {
    return 'skipped'
  }

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${agentName} - Events <noreply@events.realestateonpurpose.com>`,
        to: [recipientEmail],
        subject: template.subject,
        html: template.html_content,
        text: template.text_content,
        reply_to: replyTo,
        tags: [
          { name: 'event_id', value: eventId },
          { name: 'email_type', value: emailType },
          { name: 'rsvp_id', value: rsvpId },
        ],
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      throw new Error(`Resend API error: ${resendData.message || JSON.stringify(resendData)}`)
    }

    const { error: insertError } = await supabase.from('event_emails').insert({
      event_id: eventId,
      rsvp_id: rsvpId,
      email_type: emailType,
      recipient_email: recipientEmail,
      subject: template.subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      resend_id: resendData.id,
    })
    if (insertError) console.error('Failed to insert event_emails:', insertError)

    await logEmailToUnifiedTable(supabase, `event_${emailType}`, recipientEmail, recipientName, agentId, template.subject, 'sent', resendData.id, null, { event_id: eventId, event_title: eventTitle, rsvp_id: rsvpId, source: 'scheduler' })

    return 'sent'
  } catch (error: any) {
    console.error(`Failed to send ${emailType} to ${recipientEmail}:`, error)

    const { error: insertError } = await supabase.from('event_emails').insert({
      event_id: eventId,
      rsvp_id: rsvpId,
      email_type: emailType,
      recipient_email: recipientEmail,
      subject: template.subject,
      status: 'failed',
      error_message: error.message,
    })
    if (insertError) console.error('Failed to insert failed event_emails:', insertError)

    await logEmailToUnifiedTable(supabase, `event_${emailType}`, recipientEmail, recipientName, agentId, template.subject, 'failed', null, error.message, { event_id: eventId, event_title: eventTitle, rsvp_id: rsvpId, source: 'scheduler' })

    return 'failed'
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Auth: accept cron header OR authenticated admin
    const isCron = req.headers.get('X-Cron-Job') === 'true'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      isCron ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! : Deno.env.get('SUPABASE_ANON_KEY')!,
      isCron ? {} : { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    if (!isCron) {
      // Validate admin
      const { data: roleData } = await supabase.rpc('get_current_user_role')
      if (roleData !== 'admin') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Get today's date in YYYY-MM-DD (UTC)
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const today = new Date(todayStr)

    // Fetch all published events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select(`
        *,
        profiles:agent_id (
          first_name, last_name, email, phone_number, office_number,
          office_address, website, primary_color, secondary_color,
          logo_colored_url, logo_white_url, team_name, brokerage, headshot_url
        )
      `)
      .eq('is_published', true)

    if (eventsError) throw new Error(`Failed to fetch events: ${eventsError.message}`)

    const summary: any[] = []

    for (const event of events || []) {
      const { datePart, formattedDate, formattedTime } = formatEventDateTime(event.event_date)
      const eventDate = new Date(datePart)
      const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      const emailTypesToSend: string[] = []
      if (diffDays === 7) emailTypesToSend.push('reminder_7day')
      if (diffDays === 1) emailTypesToSend.push('reminder_1day')
      if (diffDays === -1) {
        emailTypesToSend.push('thank_you')
        emailTypesToSend.push('no_show')
      }

      if (emailTypesToSend.length === 0) continue

      const agentName = event.profiles
        ? `${event.profiles.first_name || ''} ${event.profiles.last_name || ''}`.trim() || 'Event Organizer'
        : 'Event Organizer'
      const primaryColor = event.profiles?.primary_color || event.brand_color || '#2563eb'
      const secondaryColor = event.profiles?.secondary_color || '#1e40af'
      const replaceVars = makeReplaceVars(event, agentName, primaryColor, secondaryColor, formattedDate, formattedTime)
      const replyTo = event.profiles?.email || 'noreply@realestateonpurpose.com'

      // Fetch RSVPs for this event
      const { data: rsvps } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', event.id)
        .eq('status', 'confirmed')

      if (!rsvps || rsvps.length === 0) continue

      for (const emailType of emailTypesToSend) {
        // Filter recipients based on email type
        let recipients = rsvps
        if (emailType === 'thank_you') {
          recipients = rsvps.filter((r: any) => r.check_in_status === 'checked_in')
        } else if (emailType === 'no_show') {
          recipients = rsvps.filter((r: any) => r.check_in_status !== 'checked_in')
        }

        if (recipients.length === 0) continue

        const template = await resolveTemplate(supabase, event.id, emailType, replaceVars, event, agentName, primaryColor, formattedDate, formattedTime)

        let sent = 0, skipped = 0, failed = 0

        for (const rsvp of recipients) {
          const result = await sendEmailWithDedup(
            supabase, event.id, rsvp.id, emailType,
            rsvp.email, rsvp.name, event.agent_id, agentName,
            template, replyTo, event.title
          )
          if (result === 'sent') sent++
          else if (result === 'skipped') skipped++
          else failed++

          // Rate limiting
          await delay(200)
        }

        summary.push({
          event: event.title,
          emailType,
          sent,
          skipped,
          failed,
        })

        console.log(`[${event.title}] ${emailType}: sent=${sent}, skipped=${skipped}, failed=${failed}`)
      }
    }

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Event email scheduler error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { Resend } from "https://esm.sh/resend@4.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    const { eventId }: { eventId: string } = await req.json()

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'Missing eventId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      console.error('Event fetch error:', eventError)
      throw new Error('Event not found')
    }

    // Fetch agent profile separately (no FK required)
    let agentProfile: any = null
    if (event.agent_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone_number, office_number, office_address, website, primary_color, secondary_color, headshot_url, logo_colored_url, logo_white_url, team_name, brokerage')
        .eq('user_id', event.agent_id)
        .single()
      agentProfile = profile
    }
    // Attach as event.profiles for downstream compatibility
    ;(event as any).profiles = agentProfile

    if (!event.is_published || !event.public_slug) {
      return new Response(
        JSON.stringify({ error: 'Event must be published with a public page before sending invitations' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const agentId = event.agent_id
    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Event has no assigned agent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all eligible contacts for this agent
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('agent_id', agentId)
      .eq('dnc', false)
      .not('email', 'is', null)

    if (contactsError) {
      throw new Error('Failed to fetch contacts: ' + contactsError.message)
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: 0, failed: 0, message: 'No eligible contacts found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check which contacts already received an invitation for this event
    const { data: alreadySent } = await supabase
      .from('event_emails')
      .select('recipient_email')
      .eq('event_id', eventId)
      .eq('email_type', 'invitation')
      .in('status', ['sent', 'delivered', 'opened', 'clicked'])

    const alreadySentEmails = new Set(
      (alreadySent || []).map(e => e.recipient_email.toLowerCase())
    )

    const eligibleContacts = contacts.filter(
      c => c.email && !alreadySentEmails.has(c.email.toLowerCase())
    )

    if (eligibleContacts.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: contacts.length, failed: 0, message: 'All contacts have already been invited' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Resolve template: event-specific → global → hardcoded
    const agentName = event.profiles
      ? `${event.profiles.first_name || ''} ${event.profiles.last_name || ''}`.trim() || 'Event Organizer'
      : 'Event Organizer'

    // Parse date/time from string to avoid timezone shifts
    const dateTimeParts = event.event_date.split('T')
    const datePart = dateTimeParts[0]
    const timePart = dateTimeParts[1]?.substring(0, 5) || '00:00'

    const [year, month, day] = datePart.split('-').map(Number)
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const dateObj = new Date(year, month - 1, day)
    const formattedDate = `${weekdays[dateObj.getDay()]}, ${monthNames[month - 1]} ${day}, ${year}`

    const [h, mi] = timePart.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    const formattedTime = `${hour12}:${String(mi).padStart(2, '0')} ${ampm}`

    const primaryColor = event.profiles?.primary_color || event.brand_color || '#2563eb'
    const secondaryColor = event.profiles?.secondary_color || '#1e40af'
    const rsvpLink = `https://hub.realestateonpurpose.com/event/${event.public_slug}`

    function replaceVars(content: string): string {
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

    let template: { subject: string; html_content: string; text_content: string | null }

    // 1. Event-specific template
    const { data: eventTemplate } = await supabase
      .from('event_email_templates')
      .select('*')
      .eq('event_id', eventId)
      .eq('email_type', 'invitation')
      .eq('is_active', true)
      .single()

    if (eventTemplate) {
      template = {
        subject: replaceVars(eventTemplate.subject),
        html_content: replaceVars(eventTemplate.html_content),
        text_content: eventTemplate.text_content ? replaceVars(eventTemplate.text_content) : null
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'No invitation template found for this event. Please create one in the Email Templates editor.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send emails with rate limiting
    let sent = 0
    let skipped = alreadySentEmails.size
    let failed = 0

    for (const contact of eligibleContacts) {
      try {
        const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim()

        // Clean up old failed/bounced rows for this contact before retrying
        await supabase
          .from('event_emails')
          .delete()
          .eq('event_id', eventId)
          .eq('email_type', 'invitation')
          .eq('recipient_email', contact.email!)
          .in('status', ['failed', 'bounced'])

        const { data: resendData, error: resendError } = await resend.emails.send({
          from: `${agentName} - Events <noreply@events.realestateonpurpose.com>`,
          to: [contact.email!],
          subject: template.subject,
          html: template.html_content,
          text: template.text_content || undefined,
          reply_to: event.profiles?.email || undefined,
          headers: {
            'X-Entity-Ref-ID': `invitation-${eventId}-${contact.id}`,
          },
          tags: [
            { name: 'event_id', value: eventId },
            { name: 'email_type', value: 'invitation' },
            { name: 'contact_id', value: contact.id }
          ]
        })

        if (resendError) {
          throw new Error(resendError.message || 'Resend API error')
        }

        // Log to event_emails
        const { error: insertError } = await supabase
          .from('event_emails')
          .insert({
            event_id: eventId,
            email_type: 'invitation',
            recipient_email: contact.email!,
            subject: template.subject,
            status: 'sent',
            sent_at: new Date().toISOString(),
            resend_id: resendData?.id || null
          })
        if (insertError) console.error('Failed to log event_email:', insertError)

        // Log to email_logs
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            email_type: 'event_invitation',
            recipient_email: contact.email!,
            recipient_name: contactName || null,
            agent_id: agentId,
            subject: template.subject,
            status: 'sent',
            resend_email_id: resendData?.id || null,
            sent_at: new Date().toISOString(),
            metadata: { event_id: eventId, event_title: event.title, contact_id: contact.id }
          })
        if (logError) console.error('Failed to log email_log:', logError)

        sent++
      } catch (error) {
        console.error(`Failed to send invitation to ${contact.email}:`, error)

        // Log failure to event_emails
        const { error: insertError } = await supabase
          .from('event_emails')
          .insert({
            event_id: eventId,
            email_type: 'invitation',
            recipient_email: contact.email!,
            subject: template.subject,
            status: 'failed',
            error_message: error.message
          })
        if (insertError) console.error('Failed to log failed event_email:', insertError)

        // Log failure to email_logs
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            email_type: 'event_invitation',
            recipient_email: contact.email!,
            recipient_name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null,
            agent_id: agentId,
            subject: template.subject,
            status: 'failed',
            error_message: error.message,
            metadata: { event_id: eventId, event_title: event.title, contact_id: contact.id }
          })
        if (logError) console.error('Failed to log failed email_log:', logError)

        failed++
      }

      // Rate limiting: 600ms between emails (Resend allows 2 req/sec)
      await delay(600)
    }

    // Update event invited_count
    const { error: updateError } = await supabase
      .from('events')
      .update({ invited_count: (event.invited_count || 0) + sent })
      .eq('id', eventId)
    if (updateError) console.error('Failed to update invited_count:', updateError)

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        skipped,
        failed,
        message: `Sent ${sent} invitation emails, skipped ${skipped} (already invited), ${failed} failed`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-event-invitation:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send invitation emails' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

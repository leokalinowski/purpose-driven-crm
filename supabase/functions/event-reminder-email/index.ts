import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

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

interface EmailRequest {
  eventId: string
  emailType: 'reminder_7day' | 'reminder_1day' | 'thank_you' | 'no_show'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // --- Client 1: User-context client for permission validation ---
    const authHeader = req.headers.get('Authorization')
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader! } },
    })

    // --- Client 2: Service-role client for reliable data operations ---
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { eventId, emailType }: EmailRequest = await req.json()

    if (!eventId || !emailType) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing eventId or emailType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Step 1: Verify caller has access via RLS (user-context) ---
    const { data: accessCheck, error: accessError } = await userClient
      .from('events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle()

    if (accessError) {
      console.error('Access check failed:', accessError)
    }

    // If user client can't see the event, check if caller is admin via service role
    if (!accessCheck) {
      // Verify the user is an admin
      const { data: userData } = await userClient.auth.getUser()
      if (!userData?.user) {
        console.error('AUTH_FAILED: No authenticated user found')
        return new Response(
          JSON.stringify({ success: false, error: 'Authentication required. Please log in and try again.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check admin role via service role client
      const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .eq('role', 'admin')
        .maybeSingle()

      if (!roleData) {
        console.error('UNAUTHORIZED: User', userData.user.id, 'cannot access event', eventId)
        return new Response(
          JSON.stringify({ success: false, error: 'You do not have permission to send emails for this event.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // --- Step 2: Fetch event using service-role client (bypasses RLS) ---
    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      console.error('EVENT_NOT_FOUND:', eventId, eventError)
      return new Response(
        JSON.stringify({ success: false, error: `Event not found (ID: ${eventId}). It may have been deleted.` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Step 3: Fetch agent profile separately ---
    let profile: any = null
    if (event.agent_id) {
      const { data: profileData, error: profileError } = await adminClient
        .from('profiles')
        .select('first_name, last_name, email, phone_number, office_number, office_address, website, team_name, brokerage')
        .eq('user_id', event.agent_id)
        .maybeSingle()

      if (profileError) {
        console.error('PROFILE_FETCH_WARNING:', profileError)
      }
      profile = profileData
    }

    // --- Step 4: Fetch marketing branding separately ---
    let marketingBranding: any = null
    if (event.agent_id) {
      const { data: mktData, error: mktError } = await adminClient
        .from('agent_marketing_settings')
        .select('primary_color, secondary_color, headshot_url, logo_colored_url, logo_white_url')
        .eq('user_id', event.agent_id)
        .maybeSingle()

      if (mktError) {
        console.error('BRANDING_FETCH_WARNING:', mktError)
      }
      marketingBranding = mktData
    }

    // --- Step 5: Fetch RSVPs with proper filtering ---
    let rsvpQuery = adminClient
      .from('event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'confirmed')

    // Filter by check-in status for thank_you and no_show
    if (emailType === 'thank_you') {
      rsvpQuery = rsvpQuery.eq('check_in_status', 'checked_in')
    } else if (emailType === 'no_show') {
      rsvpQuery = rsvpQuery.neq('check_in_status', 'checked_in')
    }

    const { data: rsvps, error: rsvpsError } = await rsvpQuery

    if (rsvpsError) {
      console.error('RSVP_FETCH_FAILED:', rsvpsError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch RSVPs for this event.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!rsvps || rsvps.length === 0) {
      const filterDesc = emailType === 'thank_you' ? 'checked-in attendees' : emailType === 'no_show' ? 'no-show attendees' : 'confirmed RSVPs'
      return new Response(
        JSON.stringify({ success: true, message: `No ${filterDesc} found for this event. No emails sent.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Step 6: Build template variables ---
    const agentName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Event Organizer'
      : 'Event Organizer'

    // Parse date/time directly from the stored string to avoid timezone shifts
    const dateTimeParts = event.event_date.split('T')
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

    const primaryColor = marketingBranding?.primary_color || event.brand_color || '#2563eb'
    const secondaryColor = marketingBranding?.secondary_color || '#1e40af'

    function replaceVars(content: string): string {
      return content
        .replace(/{event_title}/g, event.title)
        .replace(/{event_date}/g, formattedDate)
        .replace(/{event_time}/g, formattedTime)
        .replace(/{event_description}/g, event.description || '')
        .replace(/{event_location}/g, event.location || '')
        .replace(/{agent_name}/g, agentName)
        .replace(/{agent_email}/g, profile?.email || '')
        .replace(/{agent_phone}/g, profile?.phone_number || '')
        .replace(/{agent_office_number}/g, profile?.office_number || '')
        .replace(/{agent_office_address}/g, profile?.office_address || '')
        .replace(/{agent_website}/g, profile?.website || '')
        .replace(/{agent_brokerage}/g, profile?.brokerage || '')
        .replace(/{agent_team_name}/g, profile?.team_name || '')
        .replace(/{primary_color}/g, primaryColor)
        .replace(/{secondary_color}/g, secondaryColor)
        .replace(/{headshot_url}/g, marketingBranding?.headshot_url || '')
        .replace(/{logo_colored_url}/g, marketingBranding?.logo_colored_url || '')
        .replace(/{logo_white_url}/g, marketingBranding?.logo_white_url || '')
        .replace(/\{#if ([^}]+)\}([\s\S]*?)\{\/if\}/g, (_, _varName, inner) => inner.trim() ? inner : '')
    }

    // --- Step 7: Fetch email template ---
    const { data: eventTemplate, error: templateError } = await adminClient
      .from('event_email_templates')
      .select('*')
      .eq('event_id', eventId)
      .eq('email_type', emailType)
      .eq('is_active', true)
      .maybeSingle()

    if (templateError) {
      console.error('TEMPLATE_FETCH_FAILED:', templateError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch email template from database.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!eventTemplate) {
      console.error('TEMPLATE_MISSING:', emailType, 'for event', eventId)
      return new Response(
        JSON.stringify({
          success: false,
          error: `No "${emailType}" email template found for this event. Please create one in the Email Templates editor first.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const template = {
      subject: replaceVars(eventTemplate.subject),
      html_content: replaceVars(eventTemplate.html_content),
      text_content: eventTemplate.text_content ? replaceVars(eventTemplate.text_content) : null
    }

    // --- Step 8: Send emails sequentially with throttling ---
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    let sentCount = 0
    let skippedCount = 0
    let failedCount = 0
    let lastError: string | null = null

    const emailLogType = emailType === 'reminder_7day' ? 'event_reminder_7day' 
      : emailType === 'reminder_1day' ? 'event_reminder_1day'
      : emailType === 'thank_you' ? 'event_thank_you'
      : 'event_no_show'

    for (const rsvp of rsvps) {
      try {
        // Check if this email was already sent
        const { data: existingEmail } = await adminClient
          .from('event_emails')
          .select('id')
          .eq('event_id', eventId)
          .eq('rsvp_id', rsvp.id)
          .eq('email_type', emailType)
          .maybeSingle()

        if (existingEmail) {
          console.log(`Skipped (already sent): ${rsvp.email} for ${emailType}`)
          skippedCount++
          continue
        }

        // Send email via Resend using verified events subdomain
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Real Estate on Purpose <noreply@events.realestateonpurpose.com>',
            to: [rsvp.email],
            subject: template.subject,
            html: template.html_content,
            text: template.text_content,
            reply_to: profile?.email || 'noreply@events.realestateonpurpose.com',
            tags: [
              { name: 'event_id', value: eventId },
              { name: 'email_type', value: emailType },
              { name: 'rsvp_id', value: rsvp.id }
            ]
          }),
        })

        const resendData = await resendResponse.json()

        if (!resendResponse.ok) {
          throw new Error(`Resend API error: ${resendData.message || JSON.stringify(resendData)}`)
        }

        // Record email in tracking table
        await adminClient
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

        sentCount++

        await logEmailToUnifiedTable(
          adminClient, emailLogType, rsvp.email, rsvp.name, event.agent_id,
          template.subject, 'sent', resendData.id, null,
          { event_id: eventId, event_title: event.title, rsvp_id: rsvp.id }
        )

      } catch (error) {
        console.error(`Failed to send email to ${rsvp.email}:`, error)
        failedCount++
        lastError = error.message

        await adminClient
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

        await logEmailToUnifiedTable(
          adminClient, emailLogType, rsvp.email, rsvp.name, event.agent_id,
          template.subject, 'failed', null, error.message,
          { event_id: eventId, event_title: event.title, rsvp_id: rsvp.id }
        )
      }

      // Throttle: wait 250ms between sends to stay under Resend's 5 req/s limit
      await delay(250)
    }

    const parts = []
    if (sentCount > 0) parts.push(`${sentCount} sent`)
    if (skippedCount > 0) parts.push(`${skippedCount} already sent (skipped)`)
    if (failedCount > 0) parts.push(`${failedCount} failed`)

    return new Response(
      JSON.stringify({
        success: failedCount === 0,
        message: `${emailType} emails: ${parts.join(', ')}`,
        error: lastError ? `${failedCount} email(s) failed. Last error: ${lastError}` : undefined,
        sent: sentCount,
        skipped: skippedCount,
        failed: failedCount,
        total: rsvps.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('UNEXPECTED_ERROR in event-reminder-email:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred while sending emails.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

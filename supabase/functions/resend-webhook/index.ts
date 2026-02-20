import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    console.log('Resend webhook received:', JSON.stringify(body))

    const { type, data } = body

    if (!type || !data) {
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendEmailId = data.email_id
    if (!resendEmailId) {
      console.log('No email_id in webhook data, skipping')
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()

    // Map Resend event types to our status fields
    let updateFields: Record<string, any> = {}
    let newStatus: string | null = null

    switch (type) {
      case 'email.delivered':
        updateFields = { delivered_at: now }
        newStatus = 'delivered'
        break
      case 'email.opened':
        updateFields = { opened_at: now }
        newStatus = 'opened'
        break
      case 'email.clicked':
        updateFields = { clicked_at: now }
        newStatus = 'clicked'
        break
      case 'email.bounced':
        updateFields = { bounced_at: now, error_message: data.bounce?.message || 'Bounced' }
        newStatus = 'bounced'
        break
      case 'email.complained':
        updateFields = { error_message: 'Spam complaint received' }
        newStatus = 'complained'
        break
      default:
        console.log(`Unhandled event type: ${type}`)
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Update event_emails by resend_id
    const { data: updatedEventEmails, error: eventEmailError } = await supabase
      .from('event_emails')
      .update({ ...updateFields, status: newStatus })
      .eq('resend_id', resendEmailId)
      .select('id')

    if (eventEmailError) {
      console.error('Error updating event_emails:', eventEmailError)
    } else {
      console.log(`Updated ${updatedEventEmails?.length || 0} event_emails rows for resend_id ${resendEmailId}`)
    }

    // Also update email_logs by resend_email_id
    const { data: updatedEmailLogs, error: emailLogError } = await supabase
      .from('email_logs')
      .update({ status: newStatus })
      .eq('resend_email_id', resendEmailId)
      .select('id')

    if (emailLogError) {
      console.error('Error updating email_logs:', emailLogError)
    } else {
      console.log(`Updated ${updatedEmailLogs?.length || 0} email_logs rows for resend_email_id ${resendEmailId}`)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        type,
        event_emails_updated: updatedEventEmails?.length || 0,
        email_logs_updated: updatedEmailLogs?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Resend webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

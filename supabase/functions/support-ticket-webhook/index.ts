import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function verifySignature(secret: string, payload: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return signature === expectedSignature;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('CLICKUP_WEBHOOK_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body for signature verification
    const rawBody = await req.text();
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.headers.get('x-signature');
      if (signature) {
        const isValid = await verifySignature(webhookSecret, rawBody, signature);
        if (!isValid) {
          console.warn('Invalid webhook signature');
          return new Response(
            JSON.stringify({ error: 'Invalid signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const payload = JSON.parse(rawBody);
    console.log('ClickUp webhook received:', payload.event);

    // Handle different ClickUp events
    const { event, task_id, history_items } = payload;

    if (!task_id) {
      console.log('No task_id in webhook payload, ignoring');
      return new Response(
        JSON.stringify({ success: true, message: 'No task_id, ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the ticket by ClickUp task ID
    const { data: ticket, error: findError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('clickup_task_id', task_id)
      .single();

    if (findError || !ticket) {
      console.log('No ticket found for ClickUp task:', task_id);
      return new Response(
        JSON.stringify({ success: true, message: 'No matching ticket found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found ticket:', ticket.id, 'for ClickUp task:', task_id);

    // Process history items for status changes
    const updates: Record<string, unknown> = {};

    if (history_items && Array.isArray(history_items)) {
      for (const item of history_items) {
        // Status change
        if (item.field === 'status') {
          const clickupStatus = item.after?.status?.toLowerCase() || '';
          console.log('ClickUp status changed to:', clickupStatus);
          
          // Map ClickUp statuses to our statuses
          if (clickupStatus.includes('progress') || clickupStatus.includes('working')) {
            updates.status = 'in_progress';
          } else if (clickupStatus.includes('done') || clickupStatus.includes('complete') || clickupStatus.includes('closed')) {
            updates.status = 'resolved';
            updates.resolved_at = new Date().toISOString();
          } else if (clickupStatus.includes('open') || clickupStatus.includes('to do')) {
            updates.status = 'open';
          }
        }

        // Assignee change
        if (item.field === 'assignee_add') {
          const assigneeName = item.after?.username || item.after?.email || null;
          if (assigneeName) {
            updates.assigned_to = assigneeName;
            console.log('Assignee updated to:', assigneeName);
          }
        }
      }
    }

    // Update ticket if we have changes
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticket.id);

      if (updateError) {
        console.error('Failed to update ticket:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update ticket' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Ticket updated successfully:', ticket.id, updates);
    }

    return new Response(
      JSON.stringify({ success: true, updated: Object.keys(updates).length > 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

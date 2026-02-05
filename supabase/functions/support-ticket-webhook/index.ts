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

// Map ClickUp status to Hub status (for native webhook format with status names)
function mapClickUpStatusToHub(clickupStatus: string): 'open' | 'in_progress' | 'resolved' | null {
  const status = clickupStatus.toLowerCase().trim();
  
  // Open statuses
  if (status === 'to do' || status === 'open' || status === 'new' || status === 'pending' || status === 'not started') {
    return 'open';
  }
  
  // In progress statuses
  if (status.includes('progress') || status === 'working' || status === 'in review' || status === 'active') {
    return 'in_progress';
  }
  
  // Resolved/closed statuses
  if (status === 'done' || status === 'complete' || status === 'completed' || 
      status === 'closed' || status === 'resolved' || status === 'fixed') {
    return 'resolved';
  }
  
  return null;
}

// Map ClickUp status IDs to Hub statuses (for Automation payloads)
function mapClickUpStatusIdToHub(statusId: string): 'open' | 'in_progress' | 'resolved' | null {
  const statusMap: Record<string, 'open' | 'in_progress' | 'resolved'> = {
    'sc901113093436_osIH6GQo': 'open',        // not started
    'sc901113093436_fcd5I7DS': 'in_progress', // in progress
    'sc901113093436_pbrX12ce': 'resolved',    // resolved
  };
  return statusMap[statusId] || null;
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
    
    // Log incoming webhook for debugging
    console.log('Received support ticket webhook');
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.headers.get('x-signature') || req.headers.get('x-clickup-signature');
      if (signature) {
        const sigToVerify = signature.replace(/^sha256=/, '');
        const isValid = await verifySignature(webhookSecret, rawBody, sigToVerify);
        if (!isValid) {
          console.warn('Invalid webhook signature');
          return new Response(
            JSON.stringify({ error: 'Invalid signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('Signature verified successfully');
      }
    }

    const payload = JSON.parse(rawBody);
    console.log('Webhook payload:', JSON.stringify(payload).slice(0, 2000));

    // Detect ClickUp Automation format (payload wrapped in "payload" object)
    const isAutomationPayload = payload.auto_id && payload.trigger_id && payload.payload;
    const taskData = isAutomationPayload ? payload.payload : payload;
    
    console.log('Is Automation payload:', isAutomationPayload);

    // Extract task_id from various possible locations in the payload
    const taskId = taskData.id || payload.task_id || payload.task?.id || payload.history_items?.[0]?.parent_id;
    const event = payload.event;

    console.log('Event type:', event, 'Task ID:', taskId);

    if (!taskId) {
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
      .eq('clickup_task_id', taskId)
      .single();

    if (findError || !ticket) {
      console.log('No ticket found for ClickUp task:', taskId);
      return new Response(
        JSON.stringify({ success: true, message: 'No matching ticket found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found ticket:', ticket.id, 'for ClickUp task:', taskId);

    // Process updates based on event type and history items
    const updates: Record<string, unknown> = {};

    // Handle ClickUp Automation payloads (status_id based)
    if (isAutomationPayload && taskData.status_id) {
      const hubStatus = mapClickUpStatusIdToHub(taskData.status_id);
      console.log('Automation status_id:', taskData.status_id, '-> Hub status:', hubStatus);
      
      if (hubStatus && hubStatus !== ticket.status) {
        updates.status = hubStatus;
        if (hubStatus === 'resolved') {
          updates.resolved_at = new Date().toISOString();
        }
        console.log('Status update queued from Automation payload');
      }
    }

    // Handle taskStatusUpdated event
    if (event === 'taskStatusUpdated' && payload.history_items) {
      for (const item of payload.history_items) {
        if (item.field === 'status') {
          const newStatusName = item.after?.status || item.after;
          console.log('Status change detected:', item.before, '->', newStatusName);
          
          const hubStatus = mapClickUpStatusToHub(String(newStatusName));
          if (hubStatus) {
            updates.status = hubStatus;
            if (hubStatus === 'resolved') {
              updates.resolved_at = new Date().toISOString();
            }
            console.log('Mapped to hub status:', hubStatus);
          }
        }
      }
    }

    // Handle taskUpdated event (general updates)
    if (event === 'taskUpdated' && payload.history_items) {
      for (const item of payload.history_items) {
        // Status change
        if (item.field === 'status') {
          const newStatusName = item.after?.status || item.after;
          console.log('Status change detected:', item.before, '->', newStatusName);
          
          const hubStatus = mapClickUpStatusToHub(String(newStatusName));
          if (hubStatus) {
            updates.status = hubStatus;
            if (hubStatus === 'resolved') {
              updates.resolved_at = new Date().toISOString();
            }
            console.log('Mapped to hub status:', hubStatus);
          }
        }

        // Assignee change
        if (item.field === 'assignee_add' || item.field === 'assignee') {
          const assigneeName = item.after?.username || item.after?.email || item.after?.name || null;
          if (assigneeName) {
            updates.assigned_to = assigneeName;
            console.log('Assignee updated to:', assigneeName);
          }
        }

        // Assignee removed
        if (item.field === 'assignee_rem') {
          // Only clear if this was the only assignee
          console.log('Assignee removed');
        }
      }
    }

    // Handle taskAssigneeUpdated event
    if (event === 'taskAssigneeUpdated' && payload.history_items) {
      for (const item of payload.history_items) {
        if (item.field === 'assignee_add' || item.field === 'assignee') {
          const assigneeName = item.after?.username || item.after?.email || item.after?.name || null;
          if (assigneeName) {
            updates.assigned_to = assigneeName;
            console.log('Assignee updated to:', assigneeName);
          }
        }
      }
    }

    // Also check for direct status in payload (some webhook formats)
    if (payload.status && !updates.status) {
      const statusName = payload.status.status || payload.status;
      const hubStatus = mapClickUpStatusToHub(String(statusName));
      if (hubStatus && hubStatus !== ticket.status) {
        updates.status = hubStatus;
        if (hubStatus === 'resolved') {
          updates.resolved_at = new Date().toISOString();
        }
        console.log('Direct status mapped to:', hubStatus);
      }
    }

    // Update ticket if we have changes
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      
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
    } else {
      console.log('No updates to apply');
    }

    return new Response(
      JSON.stringify({ success: true, updated: Object.keys(updates).length > 0, updates }),
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

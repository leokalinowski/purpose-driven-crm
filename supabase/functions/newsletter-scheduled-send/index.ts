import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Allow cron jobs or authenticated admins
    const isCron = req.headers.get('X-Cron-Job') === 'true';

    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) throw new Error('Unauthorized');
      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
      const { data: { user }, error } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (error || !user) throw new Error('Unauthorized');
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roleData) throw new Error('Admin access required');
    }

    // Find scheduled campaigns that are due
    const { data: campaigns, error: fetchErr } = await supabase
      .from('newsletter_campaigns')
      .select('id, template_id, metadata, created_by')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (fetchErr) throw fetchErr;
    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${campaigns.length} scheduled campaigns`);
    let processed = 0;

    for (const campaign of campaigns) {
      try {
        const meta = campaign.metadata as any;
        if (!meta || !campaign.template_id) {
          console.error(`Campaign ${campaign.id} missing metadata or template_id`);
          await supabase.from('newsletter_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
          continue;
        }

        // Mark as sending
        await supabase.from('newsletter_campaigns').update({ status: 'sending' }).eq('id', campaign.id);

        // Call newsletter-template-send with X-Service-Key for auth bypass
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/newsletter-template-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'x-service-key': supabaseServiceKey,
          },
          body: JSON.stringify({
            template_id: campaign.template_id,
            agent_id: meta.agent_id || campaign.created_by,
            subject: meta.subject,
            sender_name: meta.sender_name,
            recipient_filter: meta.recipient_filter,
          }),
        });

        const result = await sendResponse.json();
        if (result.error) {
          console.error(`Campaign ${campaign.id} send failed:`, result.error);
          await supabase.from('newsletter_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
        } else {
          await supabase.from('newsletter_campaigns').update({
            status: 'sent',
            recipient_count: result.emails_sent,
            send_date: new Date().toISOString().split('T')[0],
          }).eq('id', campaign.id);
          processed++;
        }
      } catch (err: any) {
        console.error(`Campaign ${campaign.id} error:`, err.message);
        await supabase.from('newsletter_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
      }
    }

    return new Response(JSON.stringify({ success: true, processed, total: campaigns.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('newsletter-scheduled-send error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

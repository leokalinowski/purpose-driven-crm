import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManualSendRequest {
  event_id: string;
  email_type: 'confirmation' | 'reminder_7day' | 'reminder_1day' | 'thank_you' | 'no_show';
  recipient_email?: string; // Optional - if provided, sends only to this recipient
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { event_id, email_type, recipient_email }: ManualSendRequest = await req.json();

    if (!event_id || !email_type) {
      return new Response(
        JSON.stringify({ error: "Missing event_id or email_type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Call the appropriate event email function
    let functionName = '';
    let body: any = { eventId: event_id };

    if (email_type === 'reminder_7day' || email_type === 'reminder_1day') {
      functionName = 'event-reminder-email';
      body.emailType = email_type;
    } else if (email_type === 'confirmation') {
      // Confirmation emails are sent via RSVP, so this would need RSVP ID
      return new Response(
        JSON.stringify({ error: "Confirmation emails are sent via RSVP. Use rsvp-confirmation-email function." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else if (email_type === 'thank_you') {
      functionName = 'event-thank-you-email';
    } else if (email_type === 'no_show') {
      functionName = 'event-no-show-email';
    }

    if (!functionName) {
      return new Response(
        JSON.stringify({ error: "Invalid email_type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const response = await supabase.functions.invoke(functionName, { body });

    if (response.error) {
      throw new Error(response.error.message || `Failed to send ${email_type} email`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${email_type} email sent`,
        data: response.data
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in manual-send-event-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send event email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});


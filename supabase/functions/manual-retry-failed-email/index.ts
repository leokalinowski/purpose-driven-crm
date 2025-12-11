import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RetryRequest {
  email_log_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { email_log_id }: RetryRequest = await req.json();

    if (!email_log_id) {
      return new Response(
        JSON.stringify({ error: "Missing email_log_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch the failed email log
    const { data: emailLog, error: fetchError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', email_log_id)
      .single();

    if (fetchError || !emailLog) {
      return new Response(
        JSON.stringify({ error: "Email log not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (emailLog.status !== 'failed') {
      return new Response(
        JSON.stringify({ error: "Email is not in failed status" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Retry logic depends on email type - for now, we'll just update the retry count
    // The actual retry should be handled by the specific email function
    const { error: updateError } = await supabase
      .from('email_logs')
      .update({
        retry_count: (emailLog.retry_count || 0) + 1,
        last_retry_at: new Date().toISOString()
      })
      .eq('id', email_log_id);

    if (updateError) {
      throw new Error(`Failed to update retry count: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Retry count updated. Please use the specific email function to resend.",
        email_log_id,
        retry_count: (emailLog.retry_count || 0) + 1
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in manual-retry-failed-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to retry email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});


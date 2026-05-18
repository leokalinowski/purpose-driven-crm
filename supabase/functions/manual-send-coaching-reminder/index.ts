import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { requireAdminAuth } from "../_shared/authGuards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManualSendRequest {
  agent_id?: string; // Optional - if not provided, sends to all agents needing reminders
}

// SECURITY (hardened 2026-05-18):
//   - verify_jwt: true at deploy time
//   - Caller MUST hold role `admin` (this triggers an org-wide email blast)
// Before this hardening, anyone with the function URL could trigger
// a reminder-email send to every agent — denial-of-service + spam vector.
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

    const auth = await requireAdminAuth(req, supabaseUrl, supabaseServiceKey);
    if (auth.denied) return auth.denied;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { agent_id }: ManualSendRequest = await req.json().catch(() => ({}));

    // Call the coaching-reminder function
    // If agent_id is provided, we'll need to modify the function to support single agent
    // For now, it sends to all agents needing reminders
    const response = await supabase.functions.invoke('coaching-reminder', {
      body: agent_id ? { agent_id } : {}
    });

    if (response.error) {
      throw new Error(response.error.message || "Failed to send coaching reminder");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Coaching reminder sent",
        data: response.data
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in manual-send-coaching-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send coaching reminder" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});


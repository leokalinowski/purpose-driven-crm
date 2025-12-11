import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManualSendRequest {
  agent_id?: string; // Optional - if not provided, sends to all agents needing reminders
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
    const { agent_id }: ManualSendRequest = await req.json();

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


import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManualSendRequest {
  agent_id: string;
  week_number?: number;
  year?: number;
  force?: boolean;
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
    const { agent_id, week_number, year, force }: ManualSendRequest = await req.json();

    if (!agent_id) {
      return new Response(
        JSON.stringify({ error: "Missing agent_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Call the spheresync-email-function with force flag
    const response = await supabase.functions.invoke('spheresync-email-function', {
      body: {
        agent_id,
        week_number,
        year,
        force: force || true, // Force send by default for manual triggers
        source: 'manual_admin_trigger'
      }
    });

    if (response.error) {
      throw new Error(response.error.message || "Failed to send SphereSync email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "SphereSync email sent",
        data: response.data
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in manual-send-spheresync-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send SphereSync email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});


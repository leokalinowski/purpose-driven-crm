import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManualSendRequest {
  agent_id?: string;
  week_number?: number;
  year?: number;
  force?: boolean;
  dry_run?: boolean;
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
    const { agent_id, week_number, year, force, dry_run }: ManualSendRequest = await req.json();

    console.log('Manual SphereSync email trigger:', {
      agent_id: agent_id || 'all',
      week_number: week_number || 'current',
      year: year || 'current',
      force: force ?? true,
      dry_run: dry_run ?? false
    });

    // Build request body for spheresync-email-function
    const emailFunctionBody: Record<string, any> = {
      source: 'manual_admin_trigger',
      force: force ?? true, // Force send by default for manual triggers
    };

    // Add optional overrides
    if (agent_id) {
      emailFunctionBody.agent_id = agent_id;
    }
    if (week_number !== undefined) {
      emailFunctionBody.week_number = week_number;
    }
    if (year !== undefined) {
      emailFunctionBody.year = year;
    }
    if (dry_run) {
      emailFunctionBody.dry_run = true;
    }

    // Call the spheresync-email-function with all parameters
    const response = await supabase.functions.invoke('spheresync-email-function', {
      body: emailFunctionBody
    });

    if (response.error) {
      throw new Error(response.error.message || "Failed to send SphereSync email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: dry_run ? "Dry run completed" : "SphereSync email sent",
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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Calculate the current week number of the year (1-52)
 */
function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const weekNumber = Math.ceil(diff / oneWeek);
  
  // Ensure we stay within 1-52 range
  return Math.min(Math.max(weekNumber, 1), 52);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Starting coaching reminder process...");
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const currentWeek = getCurrentWeekNumber();
    const currentYear = new Date().getFullYear();
    
    console.log(`Checking for submissions for week ${currentWeek}, year ${currentYear}`);

    // Get all agents and admins from user_roles table
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['agent', 'admin']);

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      throw rolesError;
    }

    const userIds = userRoles?.map(r => r.user_id) || [];

    // Get profiles for these users
    const { data: agents, error: agentsError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .in('user_id', userIds);

    if (agentsError) {
      console.error("Error fetching agents:", agentsError);
      throw agentsError;
    }

    if (!agents || agents.length === 0) {
      console.log("No agents found");
      return new Response(
        JSON.stringify({ message: "No agents to remind", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${agents.length} agents`);

    // Get agents who have already submitted for current week
    const { data: submissions, error: submissionsError } = await supabase
      .from('coaching_submissions')
      .select('agent_id')
      .eq('week_number', currentWeek)
      .eq('year', currentYear);

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      throw submissionsError;
    }

    const submittedAgentIds = new Set(submissions?.map(s => s.agent_id) || []);
    
    // Find agents who haven't submitted yet
    const agentsNeedingReminder = agents.filter(agent => 
      !submittedAgentIds.has(agent.user_id) && agent.email
    );

    console.log(`${agentsNeedingReminder.length} agents need reminders`);

    if (agentsNeedingReminder.length === 0) {
      return new Response(
        JSON.stringify({ message: "All agents have submitted", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send reminder emails
    let emailsSent = 0;
    const emailResults = [];

    for (const agent of agentsNeedingReminder) {
      try {
        const emailHtml = `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb; margin-bottom: 24px;">Weekly Success Scoreboard Reminder</h2>
            
            <p>Hi ${agent.first_name || 'there'},</p>
            
            <p>This is a friendly reminder to submit your Weekly Success Scoreboard before tomorrow's Thursday coaching Zoom session.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; font-weight: 600;">What to submit in your scorecard:</p>
              <ul style="margin: 8px 0 0 16px;">
                <li>Attempts Made and Leads Contacted</li>
                <li>Appointments Set, Appointments Held, and Agreements Signed</li>
                <li>Offers Made, # of Closings, and $ Closed (Amount)</li>
                <li>Challenges and coaching notes</li>
                <li>Your ONE must-do task for next week</li>
              </ul>
            </div>
            
            <p>Please log in to the coaching system and submit your weekly data at your earliest convenience.</p>
            
            <div style="margin: 24px 0;">
              <a href="https://hub.realestateonpurpose.com/coaching" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                Submit Weekly Data
              </a>
            </div>
            
            <p>Thanks for your continued dedication to performance improvement!</p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              Best regards,<br>
              Your Performance Team
            </p>
          </div>
        `;

        // Call the send-email function
        const emailResponse = await supabase.functions.invoke('send-email', {
          body: {
            to: { email: agent.email, name: `${agent.first_name} ${agent.last_name}`.trim() },
            subject: "Reminder: Submit Your Weekly Performance Data",
            html: emailHtml,
            categories: ["coaching-reminder"]
          }
        });

        if (emailResponse.error) {
          console.error(`Failed to send email to ${agent.email}:`, emailResponse.error);
          emailResults.push({ 
            agent: agent.email, 
            success: false, 
            error: emailResponse.error.message 
          });
        } else {
          console.log(`Email sent successfully to ${agent.email}`);
          emailsSent++;
          emailResults.push({ 
            agent: agent.email, 
            success: true 
          });
        }
      } catch (error) {
        console.error(`Error sending email to ${agent.email}:`, error);
        emailResults.push({ 
          agent: agent.email, 
          success: false, 
          error: error.message 
        });
      }
    }

    const summary = {
      message: "Coaching reminders processed",
      totalAgents: agents.length,
      agentsNeedingReminder: agentsNeedingReminder.length,
      emailsSent,
      week: currentWeek,
      year: currentYear,
      results: emailResults
    };

    console.log("Reminder process completed:", summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in coaching reminder function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process coaching reminders", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
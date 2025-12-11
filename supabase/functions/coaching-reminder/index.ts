import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-job",
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

/**
 * Delay helper for rate limiting
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Background task to send reminder emails
 */
async function sendReminderEmails(
  agentsNeedingReminder: Array<{ user_id: string; first_name: string | null; last_name: string | null; email: string | null }>,
  supabase: any,
  currentWeek: number,
  currentYear: number
) {
  console.log(`[Background] Starting to send ${agentsNeedingReminder.length} reminder emails...`);
  
  let emailsSent = 0;
  const emailResults: Array<{ agent: string; success: boolean; error?: string }> = [];

  for (const agent of agentsNeedingReminder) {
    if (!agent.email) {
      console.log(`[Background] Skipping agent ${agent.user_id} - no email address`);
      continue;
    }

    try {
      // Check if we've already sent a reminder this week (idempotency)
      const { data: existingLog } = await supabase
        .from('coaching_reminder_logs')
        .select('id')
        .eq('agent_id', agent.user_id)
        .eq('week_number', currentWeek)
        .eq('year', currentYear)
        .single();

      if (existingLog) {
        console.log(`[Background] Skipping ${agent.email} - already sent reminder for week ${currentWeek}`);
        continue;
      }

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
      console.log(`[Background] Sending reminder to ${agent.email}...`);
      const emailResponse = await supabase.functions.invoke('send-email', {
        body: {
          to: { email: agent.email, name: `${agent.first_name || ''} ${agent.last_name || ''}`.trim() },
          subject: "Reminder: Submit Your Weekly Performance Data",
          html: emailHtml,
          categories: ["coaching-reminder"]
        }
      });

      if (emailResponse.error) {
        console.error(`[Background] Failed to send email to ${agent.email}:`, emailResponse.error);
        
        // Log the failure
        await supabase.from('coaching_reminder_logs').insert({
          agent_id: agent.user_id,
          week_number: currentWeek,
          year: currentYear,
          success: false,
          error_message: emailResponse.error.message || 'Unknown error'
        });
        
        emailResults.push({ 
          agent: agent.email, 
          success: false, 
          error: emailResponse.error.message 
        });
      } else {
        console.log(`[Background] Email sent successfully to ${agent.email}`);
        emailsSent++;
        
        // Log the success
        await supabase.from('coaching_reminder_logs').insert({
          agent_id: agent.user_id,
          week_number: currentWeek,
          year: currentYear,
          success: true
        });
        
        emailResults.push({ 
          agent: agent.email, 
          success: true 
        });
      }

      // Rate limiting: wait 1 second between emails to respect Resend's 2 req/sec limit
      console.log(`[Background] Waiting 1 second before next email (rate limiting)...`);
      await delay(1000);

    } catch (error) {
      console.error(`[Background] Error sending email to ${agent.email}:`, error);
      
      // Log the error
      await supabase.from('coaching_reminder_logs').insert({
        agent_id: agent.user_id,
        week_number: currentWeek,
        year: currentYear,
        success: false,
        error_message: error.message || 'Unknown error'
      }).catch(e => console.error('[Background] Failed to log error:', e));
      
      emailResults.push({ 
        agent: agent.email, 
        success: false, 
        error: error.message 
      });
      
      // Still rate limit even on errors
      await delay(1000);
    }
  }

  console.log(`[Background] Completed sending emails. Success: ${emailsSent}/${agentsNeedingReminder.length}`);
  console.log(`[Background] Results:`, JSON.stringify(emailResults));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("=== Starting coaching reminder process ===");
  
  // Check if this is a cron job call
  const isCronJob = req.headers.get('x-cron-job') === 'true';
  let requestBody: any = {};
  
  try {
    requestBody = await req.json().catch(() => ({}));
  } catch {
    requestBody = {};
  }
  
  const isCronSource = requestBody.source === 'cron' || requestBody.source === 'pg_cron';
  console.log(`Request source - isCronJob header: ${isCronJob}, body source: ${requestBody.source}`);

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
    console.log(`Found ${userIds.length} users with agent/admin roles`);

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No agents found", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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
      console.log("No agent profiles found");
      return new Response(
        JSON.stringify({ message: "No agents to remind", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${agents.length} agent profiles`);

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
    console.log(`${submittedAgentIds.size} agents have already submitted`);
    
    // Find agents who haven't submitted yet and have an email
    const agentsNeedingReminder = agents.filter(agent => 
      !submittedAgentIds.has(agent.user_id) && agent.email
    );

    console.log(`${agentsNeedingReminder.length} agents need reminders`);
    
    // Log agent names for debugging
    agentsNeedingReminder.forEach(agent => {
      console.log(`  - ${agent.first_name} ${agent.last_name} (${agent.email})`);
    });

    if (agentsNeedingReminder.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`=== Process complete in ${duration}ms - all agents have submitted ===`);
      return new Response(
        JSON.stringify({ message: "All agents have submitted", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Start background task to send emails (doesn't block response)
    console.log("Starting background email task...");
    EdgeRuntime.waitUntil(
      sendReminderEmails(agentsNeedingReminder, supabase, currentWeek, currentYear)
    );

    const duration = Date.now() - startTime;
    const summary = {
      message: "Coaching reminders queued for sending",
      totalAgents: agents.length,
      agentsWithSubmissions: submittedAgentIds.size,
      agentsNeedingReminder: agentsNeedingReminder.length,
      week: currentWeek,
      year: currentYear,
      processingTimeMs: duration,
      note: "Emails are being sent in background with rate limiting"
    };

    console.log(`=== Initial processing complete in ${duration}ms ===`);
    console.log("Summary:", JSON.stringify(summary));

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Error in coaching reminder function after ${duration}ms:`, error);
    return new Response(
      JSON.stringify({ error: "Failed to process coaching reminders", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

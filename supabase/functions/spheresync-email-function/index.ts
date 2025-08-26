import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Calculate the current week number of the year (1-52)
 */
function getCurrentWeekNumber(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const startDay = start.getDay();
  const daysSinceStart = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const adjustedDays = daysSinceStart + (startDay === 0 ? 6 : startDay - 1);
  const weekNumber = Math.ceil((adjustedDays + 1) / 7);
  return Math.min(Math.max(weekNumber, 1), 52);
}

/**
 * Format lead name from lead data
 */
function formatLeadName(lead: any): string {
  const firstName = lead.first_name || '';
  const lastName = lead.last_name || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown Contact';
}

/**
 * Send email using SendGrid
 */
async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
  const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL');
  const SENDGRID_FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME');

  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    throw new Error('SendGrid configuration missing');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }],
        subject: subject,
      }],
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME || 'SphereSync System',
      },
      content: [
        {
          type: 'text/plain',
          value: text,
        },
        {
          type: 'text/html',
          value: html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('SendGrid error:', response.status, errorText);
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('SphereSync email function started');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current week and year
    const currentWeek = getCurrentWeekNumber();
    const currentYear = new Date().getFullYear();

    console.log(`Fetching SphereSync tasks for week ${currentWeek}, year ${currentYear}`);

    // Fetch all spheresync_tasks for current week with contact details
    const { data: tasks, error: tasksError } = await supabase
      .from('spheresync_tasks')
      .select(`
        *,
        contacts (
          id,
          first_name,
          last_name,
          phone,
          email,
          category
        )
      `)
      .eq('week_number', currentWeek)
      .eq('year', currentYear)
      .order('agent_id');

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${tasks?.length || 0} SphereSync tasks`);

    // Get agent emails
    const agentIds = [...new Set(tasks?.map(task => task.agent_id) || [])];
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, first_name, last_name')
      .in('user_id', agentIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    const agentEmails = new Map(profiles?.map(p => [p.user_id, p]) || []);
    
    console.log(`Found ${agentEmails.size} agent profiles`);

    // Group tasks by agent
    const tasksByAgent = new Map<string, any[]>();
    
    tasks?.forEach(task => {
      if (!tasksByAgent.has(task.agent_id)) {
        tasksByAgent.set(task.agent_id, []);
      }
      tasksByAgent.get(task.agent_id)?.push(task);
    });

    let emailsSent = 0;

    // Send email to each agent
    for (const [agentId, agentTasks] of tasksByAgent) {
      const agent = agentEmails.get(agentId);
      
      if (!agent?.email) {
        console.log(`No email found for agent ${agentId}`);
        continue;
      }

      try {
        // Separate call and text tasks
        const callTasks = agentTasks.filter(task => task.task_type === 'call');
        const textTasks = agentTasks.filter(task => task.task_type === 'text');

        // Create email content
        const agentName = agent.first_name ? `${agent.first_name} ${agent.last_name}`.trim() : 'Agent';
        
        let plainTextContent = `Hello ${agentName},\n\n`;
        plainTextContent += `Your SphereSync tasks for Week ${currentWeek} (${currentYear}) are ready!\n\n`;
        
        let htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">SphereSync Weekly Tasks - Week ${currentWeek}</h2>
            <p>Hello ${agentName},</p>
            <p>Your SphereSync tasks for this week are ready! The system uses balanced letter distribution based on surname frequency analysis for optimal task distribution.</p>
        `;

        if (callTasks.length > 0) {
          plainTextContent += `CALL TASKS (${callTasks.length}):\n`;
          htmlContent += `
            <div style="margin: 20px 0;">
              <h3 style="color: #059669; margin-bottom: 10px;">📞 Call Tasks (${callTasks.length})</h3>
              <ul style="list-style: none; padding: 0;">
          `;
          
          callTasks.forEach(task => {
            const leadName = formatLeadName(task.contacts);
            const phone = task.contacts?.phone || 'No phone';
            const category = task.contacts?.category || 'N/A';
            
            plainTextContent += `  • ${leadName} (${phone}) - Category ${category}\n`;
            htmlContent += `
              <li style="background: #f0fdf4; padding: 10px; margin: 5px 0; border-left: 3px solid #059669; border-radius: 4px;">
                <strong>${leadName}</strong><br>
                <span style="color: #6b7280;">Phone: ${phone} | Category: ${category}</span>
              </li>
            `;
          });
          
          htmlContent += `</ul></div>`;
          plainTextContent += `\n`;
        }

        if (textTasks.length > 0) {
          plainTextContent += `TEXT TASKS (${textTasks.length}):\n`;
          htmlContent += `
            <div style="margin: 20px 0;">
              <h3 style="color: #dc2626; margin-bottom: 10px;">💬 Text Tasks (${textTasks.length})</h3>
              <ul style="list-style: none; padding: 0;">
          `;
          
          textTasks.forEach(task => {
            const leadName = formatLeadName(task.contacts);
            const phone = task.contacts?.phone || 'No phone';
            const category = task.contacts?.category || 'N/A';
            
            plainTextContent += `  • ${leadName} (${phone}) - Category ${category}\n`;
            htmlContent += `
              <li style="background: #fef2f2; padding: 10px; margin: 5px 0; border-left: 3px solid #dc2626; border-radius: 4px;">
                <strong>${leadName}</strong><br>
                <span style="color: #6b7280;">Phone: ${phone} | Category: ${category}</span>
              </li>
            `;
          });
          
          htmlContent += `</ul></div>`;
          plainTextContent += `\n`;
        }

        plainTextContent += `Total Tasks: ${agentTasks.length}\n\n`;
        plainTextContent += `Remember to log your completed tasks in the SphereSync system for accurate tracking.\n\n`;
        plainTextContent += `Best regards,\nSphereSync Automation System`;

        htmlContent += `
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Total Tasks: ${agentTasks.length}</strong></p>
              <p style="margin: 5px 0;">📊 Call Tasks: ${callTasks.length}</p>
              <p style="margin: 5px 0;">📱 Text Tasks: ${textTasks.length}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Remember to mark your completed tasks in the SphereSync system for accurate tracking and performance analytics.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              This email was sent automatically by the SphereSync task management system.<br>
              Balanced letter distribution ensures optimal task loads across all agents.
            </p>
          </div>
        `;

        // Send the email
        await sendEmail({
          to: agent.email,
          subject: `SphereSync Tasks - Week ${currentWeek} (${agentTasks.length} tasks assigned)`,
          html: htmlContent,
          text: plainTextContent
        });

        console.log(`Email sent to ${agent.email} (${agentTasks.length} tasks)`);
        emailsSent++;

      } catch (error) {
        console.error(`Failed to send email to agent ${agentId}:`, error);
        // Continue with other agents even if one fails
      }
    }

    console.log(`SphereSync email function completed. Sent ${emailsSent} emails.`);

    return new Response(JSON.stringify({
      success: true,
      message: `SphereSync weekly task emails sent successfully`,
      week_number: currentWeek,
      year: currentYear,
      emails_sent: emailsSent,
      agents_processed: tasksByAgent.size
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in spheresync-email-function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};

serve(handler);
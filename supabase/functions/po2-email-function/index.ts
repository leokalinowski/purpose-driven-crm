import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Helper function to get current week number
function getCurrentWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfYear = ((today.getTime() - start.getTime()) / 86400000) + 1;
  return Math.ceil(dayOfYear / 7);
}

// Helper function to format lead name
function formatLeadName(lead: any): string {
  const firstName = lead?.first_name || '';
  const lastName = lead?.last_name || '';
  return `${firstName} ${lastName}`.trim();
}

// Send email using SendGrid
async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
  const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL');
  const SENDGRID_FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME');

  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL || !SENDGRID_FROM_NAME) {
    console.error('Missing SendGrid configuration');
    throw new Error('SendGrid not configured');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('SendGrid error:', error);
    throw new Error(`SendGrid failed: ${response.status}`);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const currentWeek = getCurrentWeekNumber(new Date());
    const currentYear = new Date().getFullYear();
    
    console.log(`Processing PO2 email for week ${currentWeek}, year ${currentYear}`);

    // Fetch all tasks for the current week with DNC status
    const { data: tasks, error: tasksError } = await supabase
      .from('po2_tasks')
      .select(`
        *,
        lead:contacts(id, first_name, last_name, phone, dnc)
      `)
      .eq('week_number', currentWeek)
      .eq('year', currentYear);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    // Group tasks by agent_id
    const tasksByAgent = tasks?.reduce((acc: any, task: any) => {
      if (!acc[task.agent_id]) {
        acc[task.agent_id] = [];
      }
      acc[task.agent_id].push(task);
      return acc;
    }, {}) || {};

    // Get agent emails
    const agentIds = Object.keys(tasksByAgent);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, first_name, last_name')
      .in('user_id', agentIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    let emailsSent = 0;

    // Send email to each agent
    for (const profile of profiles || []) {
      const agentTasks = tasksByAgent[profile.user_id] || [];
      
      if (agentTasks.length === 0) {
        console.log(`No tasks for agent ${profile.email}, skipping email`);
        continue;
      }

      const callTasks = agentTasks.filter((task: any) => task.task_type === 'call');
      const textTasks = agentTasks.filter((task: any) => task.task_type === 'text');

      // Build email content
      const agentName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Agent';
      
      let emailContent = `Hi ${agentName},

Here are your PO2 tasks for Week ${currentWeek}:

Here are some conversation starters you can use when reaching out to your contacts this week:

FROG Call: Ask about their family, recreation, occupation, and goals. For example: "Hey, how's the family? What have you been doing for fun? How's work? Do you have any goals you're working on?"

Upcoming Event: Mention any upcoming events you have and encourage them to save the date or RSVP. For example: "We have an exciting event coming up! Be on the lookout for the official invitation." or "Have you had a chance to RSVP for our upcoming event?"

Real Estate Market: Discuss the current real estate market. For example: "I have so many people reaching out to me about the real estate market - it seems really confusing right now. Did you have any questions about the market? Who do you know that might be thinking about buying or selling and a conversation about the market would help them right now?"

`;
      
      if (callTasks.length > 0) {
        emailContent += `CALLS (${callTasks.length}):\n`;
        callTasks.forEach((task: any, index: number) => {
          const leadName = formatLeadName(task.lead);
          const phone = task.lead?.phone ? ` - ${task.lead.phone}` : '';
          const dncIndicator = task.lead?.dnc ? ' (DNC)' : '';
          emailContent += `${index + 1}. ${leadName}${phone}${dncIndicator}\n`;
        });
        emailContent += '\n';
      }

      if (textTasks.length > 0) {
        emailContent += `TEXTS (${textTasks.length}):\n`;
        textTasks.forEach((task: any, index: number) => {
          const leadName = formatLeadName(task.lead);
          const phone = task.lead?.phone ? ` - ${task.lead.phone}` : '';
          const dncIndicator = task.lead?.dnc ? ' (DNC)' : '';
          emailContent += `${index + 1}. ${leadName}${phone}${dncIndicator}\n`;
        });
        emailContent += '\n';
      }

      emailContent += `Total tasks: ${agentTasks.length}\n\nPlease reach out to these individuals this week. Remember, calling someone on the DNC list can be a risky proposition! Be sure you understand the rules before calling anyone on the list.\n\nBest regards,\nThe PO2 System`;

      // HTML version
      let htmlContent = `
        <h2>PO2 Tasks for Week ${currentWeek}</h2>
        <p>Hi ${agentName},</p>
        <p>Here are your PO2 tasks for this week:</p>
        
        <h3>Conversation Starters</h3>
        <p>Here are some conversation starters you can use when reaching out to your contacts this week:</p>
        <ul>
          <li><strong>FROG Call:</strong> Ask about their family, recreation, occupation, and goals. For example: "Hey, how's the family? What have you been doing for fun? How's work? Do you have any goals you're working on?"</li>
          <li><strong>Upcoming Event:</strong> Mention any upcoming events you have and encourage them to save the date or RSVP. For example: "We have an exciting event coming up! Be on the lookout for the official invitation." or "Have you had a chance to RSVP for our upcoming event?"</li>
          <li><strong>Real Estate Market:</strong> Discuss the current real estate market. For example: "I have so many people reaching out to me about the real estate market - it seems really confusing right now. Did you have any questions about the market? Who do you know that might be thinking about buying or selling and a conversation about the market would help them right now?"</li>
        </ul>
      `;

      if (callTasks.length > 0) {
        htmlContent += `
          <h3>CALLS (${callTasks.length})</h3>
          <ul>
        `;
        callTasks.forEach((task: any) => {
          const leadName = formatLeadName(task.lead);
          const phone = task.lead?.phone ? ` - ${task.lead.phone}` : '';
          const dncStyle = task.lead?.dnc ? ' style="background-color: #ffebee; color: #c62828;"' : '';
          const dncIndicator = task.lead?.dnc ? ' (DNC)' : '';
          htmlContent += `<li${dncStyle}>${leadName}${phone}${dncIndicator}</li>`;
        });
        htmlContent += '</ul>';
      }

      if (textTasks.length > 0) {
        htmlContent += `
          <h3>TEXTS (${textTasks.length})</h3>
          <ul>
        `;
        textTasks.forEach((task: any) => {
          const leadName = formatLeadName(task.lead);
          const phone = task.lead?.phone ? ` - ${task.lead.phone}` : '';
          const dncStyle = task.lead?.dnc ? ' style="background-color: #ffebee; color: #c62828;"' : '';
          const dncIndicator = task.lead?.dnc ? ' (DNC)' : '';
          htmlContent += `<li${dncStyle}>${leadName}${phone}${dncIndicator}</li>`;
        });
        htmlContent += '</ul>';
      }

      htmlContent += `
        <p><strong>Total tasks: ${agentTasks.length}</strong></p>
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 15px 0; border-radius: 5px;">
          <p><strong>Warning:</strong> Please reach out to these individuals this week. Remember, calling someone on the DNC list can be a risky proposition! Be sure you understand the rules before calling anyone on the list.</p>
        </div>
        <p>Best regards,<br>The PO2 System</p>
      `;

      try {
        await sendEmail({
          to: profile.email,
          subject: `PO2 Tasks - Week ${currentWeek}`,
          text: emailContent,
          html: htmlContent
        });
        
        console.log(`Email sent to ${profile.email} (${agentTasks.length} tasks)`);
        emailsSent++;
      } catch (emailError) {
        console.error(`Failed to send email to ${profile.email}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `PO2 emails sent for week ${currentWeek}`,
        emailsSent,
        totalAgents: agentIds.length
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Error in PO2 email function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
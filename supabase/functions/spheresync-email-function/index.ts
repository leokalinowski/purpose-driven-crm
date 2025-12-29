import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Calculate ISO 8601 week number and year
 * Handles year boundaries correctly (e.g., Dec 29, 2025 = Week 1 of 2026)
 */
function getISOWeekNumber(date: Date = new Date()): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNumber, year: d.getUTCFullYear() };
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
 * Send email using Resend
 */
async function sendEmail({ to, subject, html, text, bcc }: { to: string; subject: string; html: string; text: string; bcc?: string[] }): Promise<{ data?: { id: string }, error?: any }> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
  const FROM_NAME = Deno.env.get('RESEND_FROM_NAME') || 'SphereSync System';

  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY environment variable');
    throw new Error('Resend API key missing - check environment configuration');
  }

  if (!FROM_EMAIL || FROM_EMAIL === 'onboarding@resend.dev') {
    console.warn('Using default Resend email - consider setting RESEND_FROM_EMAIL to your verified domain');
  }

  console.log(`Sending email via Resend: ${FROM_NAME} <${FROM_EMAIL}> -> ${to}`);
  if (bcc && bcc.length > 0) {
    console.log(`BCC recipients: ${bcc.join(', ')}`);
  }
  
  const resend = new Resend(RESEND_API_KEY);

  const emailPayload: any = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject: subject,
    html: html,
    text: text,
  };

  // Add BCC if provided
  if (bcc && bcc.length > 0) {
    emailPayload.bcc = bcc;
  }

  const { data, error } = await resend.emails.send(emailPayload);

  if (error) {
    console.error('Resend API error details:', {
      error,
      recipient: to,
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      subject: subject.substring(0, 50) + '...'
    });
    throw new Error(`Resend API error: ${JSON.stringify(error)}`);
  }

  console.log('Email sent successfully via Resend:', { id: data?.id, to, subject: subject.substring(0, 50) + '...' });
  return { data, error };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestSource = 'manual';
  try {
    // Get source from request body or headers
    const requestBody = await req.json().catch(() => ({}));
    requestSource = requestBody.source || req.headers.get('x-request-source') || 'manual';
    const scheduledAt = requestBody.scheduled_at;
    
    console.log(`SphereSync email function started - Source: ${requestSource}`);
    console.log(`Request timestamp: ${new Date().toISOString()}`);
    if (scheduledAt) {
      console.log(`Scheduled execution time: ${scheduledAt}`);
    }

    // Check for optional overrides
    const forceSend = requestBody.force === true;
    const testEmail = requestBody.testEmail; // If provided, send only to this email as a test
    const dryRun = requestBody.dry_run === true;
    const overrideWeek = requestBody.week_number;
    const overrideYear = requestBody.year;
    const targetAgentId = requestBody.agent_id; // Optional: send only to specific agent
    
    if (forceSend) {
      console.log('Force send enabled - will send emails even if already sent this week');
    }
    
    if (testEmail) {
      console.log(`Test mode enabled - will send sample email only to ${testEmail}`);
    }

    if (dryRun) {
      console.log('Dry run mode - will NOT send emails, just return what would be sent');
    }

    if (overrideWeek && overrideYear) {
      console.log(`Using override week/year: Week ${overrideWeek}/${overrideYear}`);
    }

    if (targetAgentId) {
      console.log(`Targeting specific agent: ${targetAgentId}`);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine target week/year
    // Priority: 1) explicit week/year override, 2) scheduled_at, 3) now()
    let targetWeek: number;
    let targetYear: number;

    if (overrideWeek && overrideYear) {
      targetWeek = overrideWeek;
      targetYear = overrideYear;
    } else {
      const referenceDate = scheduledAt ? new Date(scheduledAt) : new Date();
      const { week: computedWeek, year: computedYear } = getISOWeekNumber(referenceDate);
      targetWeek = Math.min(computedWeek, 52); // Map to our 52-week system
      targetYear = computedYear;
    }

    console.log(`Fetching SphereSync tasks for week ${targetWeek}, year ${targetYear}`);

    // Build query for tasks
    let tasksQuery = supabase
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
      .eq('week_number', targetWeek)
      .eq('year', targetYear)
      .order('agent_id');

    // If targeting specific agent, add filter
    if (targetAgentId) {
      tasksQuery = tasksQuery.eq('agent_id', targetAgentId);
    }

    const { data: tasks, error: tasksError } = await tasksQuery;

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${tasks?.length || 0} SphereSync tasks for week ${targetWeek}, year ${targetYear}`);
    
    // If no tasks found, log warning but don't fail - this might be normal if no tasks were generated
    if (!tasks || tasks.length === 0) {
      const warningMessage = `WARNING: No SphereSync tasks found for week ${targetWeek}, year ${targetYear}. This might indicate that task generation did not run or failed.`;
      console.warn(warningMessage);
      return new Response(JSON.stringify({
        success: false,
        warning: true,
        message: warningMessage,
        week_number: targetWeek,
        year: targetYear,
        emails_sent: 0,
        emails_skipped: 0,
        source: requestSource
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 but with warning flag
      });
    }

    // Get agent emails
    const agentIds = [...new Set(tasks?.map(task => task.agent_id) || [])];
    
    console.log(`Found ${agentIds.length} unique agents with tasks`);
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, first_name, last_name')
      .in('user_id', agentIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    const agentEmails = new Map(profiles?.map(p => [p.user_id, p]) || []);
    
    console.log(`Found ${agentEmails.size} agent profiles with email addresses`);

    // Group tasks by agent
    const tasksByAgent = new Map<string, any[]>();
    
    tasks?.forEach(task => {
      if (!tasksByAgent.has(task.agent_id)) {
        tasksByAgent.set(task.agent_id, []);
      }
      tasksByAgent.get(task.agent_id)?.push(task);
    });

    console.log(`Grouped tasks for ${tasksByAgent.size} agents`);

    // Dry run mode - just return what would be sent
    if (dryRun) {
      const dryRunResults = [];
      for (const [agentId, agentTasks] of tasksByAgent) {
        const agent = agentEmails.get(agentId);
        const agentName = agent?.first_name ? `${agent.first_name} ${agent.last_name}`.trim() : agent?.email || 'Unknown';
        
        // Check if already sent
        let wouldSkip = false;
        let skipReason = '';
        if (!forceSend && !testEmail) {
          const { data: existingLog } = await supabase
            .from('spheresync_email_logs')
            .select('id, sent_at')
            .eq('agent_id', agentId)
            .eq('week_number', targetWeek)
            .eq('year', targetYear)
            .maybeSingle();
          
          if (existingLog) {
            wouldSkip = true;
            skipReason = `Already sent at ${existingLog.sent_at}`;
          }
        }

        dryRunResults.push({
          agent_id: agentId,
          agent_name: agentName,
          agent_email: agent?.email || null,
          task_count: agentTasks.length,
          call_tasks: agentTasks.filter(t => t.task_type === 'call').length,
          text_tasks: agentTasks.filter(t => t.task_type === 'text').length,
          would_skip: wouldSkip,
          skip_reason: skipReason,
          has_email: !!agent?.email
        });
      }

      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        message: 'Dry run completed - no emails sent',
        week_number: targetWeek,
        year: targetYear,
        agents_would_send: dryRunResults.filter(r => !r.would_skip && r.has_email).length,
        agents_would_skip: dryRunResults.filter(r => r.would_skip).length,
        agents_missing_email: dryRunResults.filter(r => !r.has_email).length,
        results: dryRunResults,
        source: requestSource
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let emailsSent = 0;
    let emailsSkipped = 0;
    const agentsProcessed: string[] = [];
    const agentsSkipped: { name: string; reason: string }[] = [];
    const agentsFailed: string[] = [];

    // Send email to each agent
    for (const [agentId, agentTasks] of tasksByAgent) {
      const agent = agentEmails.get(agentId);
      
      if (!agent?.email) {
        console.warn(`No email found for agent ${agentId} - skipping`);
        agentsSkipped.push({ name: `Agent ${agentId}`, reason: 'no email address' });
        continue;
      }

      // In test mode, only process the first agent (we'll override the email address)
      if (testEmail && emailsSent > 0) {
        console.log('Test mode: skipping remaining agents after first email');
        break;
      }

      // Check if we've already sent an email to this agent for this week (unless forced or test mode)
      if (!forceSend && !testEmail) {
        const { data: existingLog, error: logError } = await supabase
          .from('spheresync_email_logs')
          .select('id, sent_at')
          .eq('agent_id', agentId)
          .eq('week_number', targetWeek)
          .eq('year', targetYear)
          .maybeSingle();

        if (logError) {
          console.error(`Error checking email log for agent ${agentId}:`, logError);
          // Continue anyway - don't block on log check errors
        }

        if (existingLog) {
          const agentName = agent.first_name ? `${agent.first_name} ${agent.last_name}`.trim() : agent.email;
          console.log(`Skipping ${agentName} - already sent email for week ${targetWeek}/${targetYear} at ${existingLog.sent_at}`);
          agentsSkipped.push({ name: agentName, reason: `already sent at ${existingLog.sent_at}` });
          emailsSkipped++;
          continue;
        }
      }

      try {
        // Define agentName FIRST before using it
        const agentName = agent.first_name ? `${agent.first_name} ${agent.last_name}`.trim() : agent.email;
        
        // Separate call and text tasks
        const callTasks = agentTasks.filter(task => task.task_type === 'call');
        const textTasks = agentTasks.filter(task => task.task_type === 'text');

        // Create email content
        let plainTextContent = `Hello ${agentName},\n\n`;
        plainTextContent += `Your SphereSync tasks for Week ${targetWeek} (${targetYear}) are ready!\n\n`;
        
        let htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">SphereSync Weekly Tasks - Week ${targetWeek}</h2>
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
        
        // Add conversation starters to plain text
        plainTextContent += `CONVERSATION STARTERS:\n`;
        plainTextContent += `Not sure what to say? Try one of these proven openers:\n\n`;
        plainTextContent += `🐸 FROG Call: "Hey, how's the family? What have you been doing for fun? How's work? Do you have any goals you're working on?"\n\n`;
        plainTextContent += `📅 Upcoming Event: "We have an exciting event coming up! Be on the lookout for the official invitation." or "Have you had a chance to RSVP for our upcoming event?"\n\n`;
        plainTextContent += `🏠 Real Estate Market: "I have so many people reaching out about the market - it seems confusing right now. Did you have any questions? Who do you know thinking about buying or selling?"\n\n`;
        plainTextContent += `☕ Coffee Catch-Up: "I was thinking about you! Would love to grab coffee and catch up. What does your schedule look like?"\n\n`;
        plainTextContent += `🎁 Referral Ask: "I really appreciate you thinking of me. Do you know anyone right now who might be thinking about making a move?"\n\n`;
        plainTextContent += `📊 Market Report Offer: "I just put together a market report for our area. Would you like me to send it over? It's eye-opening!"\n\n`;
        
        plainTextContent += `Remember to log your completed tasks in the SphereSync system for accurate tracking.\n\n`;
        plainTextContent += `Best regards,\nSphereSync Automation System`;

        htmlContent += `
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Total Tasks: ${agentTasks.length}</strong></p>
              <p style="margin: 5px 0;">📊 Call Tasks: ${callTasks.length}</p>
              <p style="margin: 5px 0;">📱 Text Tasks: ${textTasks.length}</p>
            </div>

            <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb;">
              <h3 style="color: #1e40af; margin-top: 0;">💡 Conversation Starters</h3>
              <p style="color: #374151; margin-bottom: 15px;">Not sure what to say? Try one of these proven openers:</p>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #059669;">🐸 FROG Call</strong>
                <p style="color: #6b7280; margin: 5px 0; font-style: italic;">"Hey, how's the family? What have you been doing for fun? How's work? Do you have any goals you're working on?"</p>
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #7c3aed;">📅 Upcoming Event</strong>
                <p style="color: #6b7280; margin: 5px 0; font-style: italic;">"We have an exciting event coming up! Be on the lookout for the official invitation." or "Have you had a chance to RSVP for our upcoming event?"</p>
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #dc2626;">🏠 Real Estate Market</strong>
                <p style="color: #6b7280; margin: 5px 0; font-style: italic;">"I have so many people reaching out about the market - it seems confusing right now. Did you have any questions? Who do you know thinking about buying or selling?"</p>
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #ca8a04;">☕ Coffee Catch-Up</strong>
                <p style="color: #6b7280; margin: 5px 0; font-style: italic;">"I was thinking about you! Would love to grab coffee and catch up. What does your schedule look like?"</p>
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #db2777;">🎁 Referral Ask</strong>
                <p style="color: #6b7280; margin: 5px 0; font-style: italic;">"I really appreciate you thinking of me. Do you know anyone right now who might be thinking about making a move?"</p>
              </div>
              
              <div>
                <strong style="color: #0891b2;">📊 Market Report Offer</strong>
                <p style="color: #6b7280; margin: 5px 0; font-style: italic;">"I just put together a market report for our area. Would you like me to send it over? It's eye-opening!"</p>
              </div>
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

        // Send the email with admin BCC (or to test email in test mode)
        const adminBCC = Deno.env.get('SPHERESYNC_ADMIN_BCC') || 'leonardo@realestateonpurpose.com';
        const recipientEmail = testEmail || agent.email;
        const emailSubject = testEmail 
          ? `[TEST] SphereSync Tasks - Week ${targetWeek} (${agentTasks.length} tasks assigned)` 
          : `SphereSync Tasks - Week ${targetWeek} (${agentTasks.length} tasks assigned)`;
        
        // agentName already declared at start of try block
        agentsProcessed.push(`${agentName} (${agentTasks.length} tasks)`);
        let resendResponse: { data?: { id: string }, error?: any } | null = null;
        
        try {
          resendResponse = await sendEmail({
            to: recipientEmail,
            subject: emailSubject,
            html: htmlContent,
            text: plainTextContent,
            bcc: testEmail ? undefined : [adminBCC] // No BCC in test mode to avoid duplicate
          });

          console.log(`Email sent to ${recipientEmail} (${agentTasks.length} tasks)${testEmail ? ' [TEST MODE]' : ''}`);
          
          // Only log the email send in non-test mode to prevent duplicates
          if (!testEmail) {
            // Log to existing spheresync_email_logs table (for backward compatibility)
            const { error: logInsertError } = await supabase
              .from('spheresync_email_logs')
              .insert({
                agent_id: agentId,
                week_number: targetWeek,
                year: targetYear,
                task_count: agentTasks.length
              });

            if (logInsertError) {
              console.error(`Failed to log email send for agent ${agentId}:`, logInsertError);
              // Don't fail the whole process if logging fails
            }

            // Log to unified email_logs table
            const { error: unifiedLogError } = await supabase
              .from('email_logs')
              .insert({
                email_type: 'spheresync_reminder',
                recipient_email: recipientEmail,
                recipient_name: agentName,
                agent_id: agentId,
                subject: emailSubject,
                status: resendResponse?.error ? 'failed' : 'sent',
                resend_email_id: resendResponse?.data?.id,
                error_message: resendResponse?.error ? JSON.stringify(resendResponse.error) : null,
                metadata: {
                  week_number: targetWeek,
                  year: targetYear,
                  task_count: agentTasks.length,
                  call_tasks: callTasks.length,
                  text_tasks: textTasks.length
                },
                sent_at: new Date().toISOString()
              });

            if (unifiedLogError) {
              console.error(`Failed to log to unified email_logs for agent ${agentId}:`, unifiedLogError);
              // Don't fail the whole process if logging fails
            } else {
              console.log(`Logged email send to unified email_logs for agent ${agentId}`);
            }
          }
          
          emailsSent++;
        } catch (emailError) {
          // Log failed email to unified email_logs table
          if (!testEmail) {
            const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
            try {
              const { error: failedLogError } = await supabase
                .from('email_logs')
                .insert({
                  email_type: 'spheresync_reminder',
                  recipient_email: recipientEmail,
                  recipient_name: agentName,
                  agent_id: agentId,
                  subject: emailSubject,
                  status: 'failed',
                  error_message: errorMessage,
                  metadata: {
                    week_number: targetWeek,
                    year: targetYear,
                    task_count: agentTasks.length
                  }
                });
              if (failedLogError) {
                console.error('Failed to log failed email:', failedLogError);
              }
            } catch (logErr) {
              console.error('Exception logging failed email:', logErr);
            }
          }
          throw emailError; // Re-throw to be caught by outer catch block
        }

        // Rate limiting: Resend has 2 requests/second limit, so wait 1000ms between emails
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        const agentName = agentEmails.get(agentId)?.email || agentId;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to send email to agent ${agentId} (${agentName}):`, errorMessage);
        agentsFailed.push(`${agentName}: ${errorMessage}`);
        // Continue with other agents even if one fails
      }
    }

    const completionMessage = `SphereSync email function completed. Sent ${emailsSent} emails, skipped ${emailsSkipped}, failed ${agentsFailed.length}.`;
    console.log(completionMessage);
    console.log(`Agents processed: ${agentsProcessed.length}`);
    console.log(`Agents skipped: ${agentsSkipped.length}`);
    if (agentsFailed.length > 0) {
      console.error(`Agents failed: ${agentsFailed.length}`, agentsFailed);
    }
    
    // Log summary for monitoring
    if (emailsSent === 0 && emailsSkipped === 0 && agentsFailed.length === 0) {
      console.warn('WARNING: No emails were sent, skipped, or failed. This might indicate an issue.');
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Sent ${emailsSent} emails, skipped ${emailsSkipped} (already sent), failed ${agentsFailed.length}`,
      week_number: targetWeek,
      year: targetYear,
      emails_sent: emailsSent,
      emails_skipped: emailsSkipped,
      agents_processed: agentsProcessed,
      agents_skipped: agentsSkipped,
      agents_failed: agentsFailed,
      force_send: forceSend,
      execution_time: new Date().toISOString(),
      source: requestSource
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('ERROR in spheresync-email-function:', {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
      source: requestSource || 'unknown'
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      timestamp: new Date().toISOString(),
      source: requestSource || 'unknown'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  email: string;
  code: string;
  expiresAt: string;
}

const createEmailTemplate = (email: string, code: string, expiresAt: string) => {
  const signupUrl = `https://hub.realestateonpurpose.com/auth?inviteCode=${code}&email=${encodeURIComponent(email)}`;
  const expirationDate = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Real Estate on Purpose</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0 0 10px 0;">Welcome to Real Estate on Purpose</h1>
              <p style="color: #e0e7ff; font-size: 16px; margin: 0;">Your invitation to join the team</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi there! 👋
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                You've been invited to join <strong>Real Estate on Purpose</strong>. We're excited to have you on the team!
              </p>
              
              <!-- Invitation Code Box -->
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 30px 0;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your Invitation Code</p>
                <p style="color: #1f2937; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; font-family: 'Courier New', monospace;">${code}</p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 0 0 30px 0;">
                <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                  Sign Up Now
                </a>
              </div>
              
              <!-- Video Tutorial Section -->
              <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 6px; margin: 0 0 30px 0;">
                <p style="color: #1e40af; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">📹 Watch the Setup Tutorial</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                  We've created a quick video guide to help you get started. Watch the tutorial below to learn how to complete your signup and navigate the platform.
                </p>
                <!-- Placeholder for GIF/Video - You'll add your video URL here -->
                <div style="background-color: #dbeafe; border-radius: 6px; padding: 40px; text-align: center;">
                  <p style="color: #1e40af; font-size: 14px; margin: 0;">🎬 Video tutorial coming soon</p>
                  <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">Your admin will add a walkthrough GIF here</p>
                </div>
              </div>
              
              <!-- Instructions -->
              <div style="margin: 0 0 30px 0;">
                <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">Getting Started (3 Easy Steps)</h2>
                
                <div style="display: flex; align-items: start; margin-bottom: 16px;">
                  <div style="background-color: #2563eb; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; margin-right: 12px;">1</div>
                  <div>
                    <p style="color: #1f2937; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Click "Sign Up Now"</p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">The button above will take you to the signup page with your invitation code already filled in.</p>
                  </div>
                </div>
                
                <div style="display: flex; align-items: start; margin-bottom: 16px;">
                  <div style="background-color: #2563eb; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; margin-right: 12px;">2</div>
                  <div>
                    <p style="color: #1f2937; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Complete Your Profile</p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">Fill in your name, professional details, and licensing information across the 3-step signup form.</p>
                  </div>
                </div>
                
                <div style="display: flex; align-items: start;">
                  <div style="background-color: #2563eb; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; margin-right: 12px;">3</div>
                  <div>
                    <p style="color: #1f2937; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Confirm Your Email</p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">Check your inbox for a confirmation email to activate your account and start using the platform.</p>
                  </div>
                </div>
              </div>
              
              <!-- Manual Code Section -->
              <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin: 0 0 24px 0;">
                <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0;">
                  <strong>Prefer to enter manually?</strong> Visit <a href="https://hub.realestateonpurpose.com/auth" style="color: #2563eb; text-decoration: none;">hub.realestateonpurpose.com/auth</a> and use the code above.
                </p>
              </div>
              
              <!-- Expiration Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                  ⏰ <strong>This invitation expires on ${expirationDate}</strong>. Please complete your signup before then.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
                Need help? Contact us at <a href="https://realestateonpurpose.com" style="color: #2563eb; text-decoration: none;">realestateonpurpose.com</a>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Real Estate on Purpose. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code, expiresAt }: InvitationEmailRequest = await req.json();

    if (!email || !code || !expiresAt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, code, or expiresAt" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const htmlContent = createEmailTemplate(email, code, expiresAt);

    const emailResponse = await resend.emails.send({
      from: `${Deno.env.get("RESEND_FROM_NAME")} <${Deno.env.get("RESEND_FROM_EMAIL")}>`,
      to: [email],
      subject: "Welcome to Real Estate on Purpose - Your Invitation",
      html: htmlContent,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    // Log to unified email_logs table
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Try to find the invitation record to get agent_id if available
        const { data: invitation } = await supabase
          .from('invitations')
          .select('created_by')
          .eq('email', email)
          .eq('code', code)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
          .catch(() => ({ data: null }));

        await supabase
          .from('email_logs')
          .insert({
            email_type: 'team_invitation',
            recipient_email: email,
            recipient_name: null,
            agent_id: invitation?.created_by || null,
            subject: "Welcome to Real Estate on Purpose - Your Invitation",
            status: emailResponse.error ? 'failed' : 'sent',
            resend_email_id: emailResponse.data?.id || null,
            error_message: emailResponse.error ? JSON.stringify(emailResponse.error) : null,
            metadata: {
              invitation_code: code,
              expires_at: expiresAt
            },
            sent_at: emailResponse.error ? null : new Date().toISOString()
          })
          .catch(err => console.error('Failed to log invitation email:', err));
      }
    } catch (logError) {
      console.error('Error logging invitation email:', logError);
    }

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation-email function:", error);
    
    // Log failed email to unified email_logs table
    try {
      const { email, code, expiresAt }: InvitationEmailRequest = await req.json().catch(() => ({ email: '', code: '', expiresAt: '' }));
      if (email) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          const { data: invitation } = await supabase
            .from('invitations')
            .select('created_by')
            .eq('email', email)
            .eq('code', code)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
            .catch(() => ({ data: null }));

          await supabase
            .from('email_logs')
            .insert({
              email_type: 'team_invitation',
              recipient_email: email,
              recipient_name: null,
              agent_id: invitation?.created_by || null,
              subject: "Welcome to Real Estate on Purpose - Your Invitation",
              status: 'failed',
              error_message: error.message || error.toString(),
              metadata: {
                invitation_code: code,
                expires_at: expiresAt
              }
            })
            .catch(err => console.error('Failed to log failed invitation email:', err));
        }
      }
    } catch (logError) {
      console.error('Error logging failed invitation email:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { to } = await req.json();
    
    if (!to) {
      return new Response(JSON.stringify({ error: "Missing 'to' email address" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const FROM_NAME = Deno.env.get("RESEND_FROM_NAME") || "Test System";

    console.log("Environment check:", {
      hasApiKey: !!RESEND_API_KEY,
      fromEmail: FROM_EMAIL,
      fromName: FROM_NAME,
      recipient: to
    });

    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY environment variable");
      return new Response(
        JSON.stringify({ 
          error: "Server not configured for email (missing RESEND_API_KEY)",
          config: {
            hasApiKey: false,
            fromEmail: FROM_EMAIL,
            fromName: FROM_NAME
          }
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(RESEND_API_KEY);

    const emailData = {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: "Resend Email Test - Configuration Verification",
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">✅ Resend Email Test Successful</h1>
          
          <p>This is a test email to verify that your Resend email configuration is working correctly.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #1f2937;">Configuration Details:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>From Email:</strong> ${FROM_EMAIL}</li>
              <li><strong>From Name:</strong> ${FROM_NAME}</li>
              <li><strong>Recipient:</strong> ${to}</li>
              <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          ${FROM_EMAIL === 'onboarding@resend.dev' ? `
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
            <h4 style="margin: 0 0 8px 0; color: #92400e;">⚠️ Important Notice</h4>
            <p style="margin: 0; color: #92400e;">
              You're using the default Resend test email address. For production use:
            </p>
            <ol style="margin: 8px 0 0 20px; color: #92400e;">
              <li>Verify your domain at <a href="https://resend.com/domains" style="color: #1d4ed8;">https://resend.com/domains</a></li>
              <li>Set RESEND_FROM_EMAIL to use your verified domain</li>
            </ol>
          </div>
          ` : ''}
          
          <p style="color: #6b7280; margin-top: 32px;">
            If you received this email, your Resend configuration is working correctly!
          </p>
        </div>
      `,
      text: `Resend Email Test Successful\n\nThis is a test email to verify that your Resend email configuration is working correctly.\n\nConfiguration Details:\n- From Email: ${FROM_EMAIL}\n- From Name: ${FROM_NAME}\n- Recipient: ${to}\n- Timestamp: ${new Date().toISOString()}\n\nIf you received this email, your Resend configuration is working correctly!`
    };

    console.log("Attempting to send test email via Resend...");

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error("Resend API error:", error);
      return new Response(
        JSON.stringify({
          error: "Email sending failed",
          details: error,
          config: {
            fromEmail: FROM_EMAIL,
            fromName: FROM_NAME,
            recipient: to
          }
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Test email sent successfully via Resend:", data?.id);

    return new Response(JSON.stringify({ 
      success: true, 
      id: data?.id,
      message: "Test email sent successfully",
      config: {
        fromEmail: FROM_EMAIL,
        fromName: FROM_NAME,
        recipient: to,
        usingDefaultEmail: FROM_EMAIL === 'onboarding@resend.dev'
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("Error in test-email function:", error);
    return new Response(JSON.stringify({ 
      error: "Unexpected server error",
      details: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
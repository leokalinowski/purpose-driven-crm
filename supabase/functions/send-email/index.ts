
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EmailRecipient = { email: string; name?: string };

interface SendEmailRequest {
  to: string | EmailRecipient | Array<string | EmailRecipient>;
  subject: string;
  html?: string;
  text?: string;
  cc?: Array<string | EmailRecipient>;
  bcc?: Array<string | EmailRecipient>;
  reply_to?: EmailRecipient | string;
  from_name?: string;
  from_email?: string;
  categories?: string[];
  metadata?: {
    email_type?: string;
    agent_id?: string;
    [key: string]: any;
  };
}

function normalizeRecipients(
  input: SendEmailRequest["to"]
): EmailRecipient[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  return arr.map((r) =>
    typeof r === "string" ? { email: r } : { email: r.email, name: r.name }
  );
}

function footerHtml(): string {
  const rawAddress = Deno.env.get("COMPANY_PHYSICAL_ADDRESS") || "";
  // Sanitize to avoid accidentally leaking secrets (e.g., SendGrid keys starting with SG., OpenAI keys sk-...)
  const sanitized = rawAddress
    .replace(/(SG\.[A-Za-z0-9_\-.]+)/g, "[redacted]")
    .replace(/(sk-[A-Za-z0-9]{20,})/gi, "[redacted]")
    .replace(/[^\w\s\.,#\-\/]/g, "")
    .trim();

  const parts: string[] = [];
  if (sanitized) {
    parts.push(`<p style="margin: 8px 0; color:#6b7280; font-size:12px;">${sanitized}</p>`);
  }
  // Always include a generic unsubscribe line; do not depend on any secret presence
  parts.push(
    `<p style="margin: 8px 0; color:#6b7280; font-size:12px;">If you no longer wish to receive these emails, you can unsubscribe by replying with "UNSUBSCRIBE".</p>`
  );

  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />${parts.join("")}`;
}

function buildHtml(html?: string, textFallback?: string): string {
  const base =
    html ??
    `<div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans','Apple Color Emoji','Segoe UI Emoji';line-height:1.5;">
      <p>${(textFallback ?? "").replace(/\n/g, "<br/>")}</p>
     </div>`;
  return `${base}${footerHtml()}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const FROM_NAME = Deno.env.get("RESEND_FROM_NAME") ?? "Your Real Estate Team";

  if (!RESEND_API_KEY) {
    console.error("Missing required Resend API key.");
    return new Response(
      JSON.stringify({ error: "Server not configured for email (missing API key)." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const resend = new Resend(RESEND_API_KEY);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }


  let payload: SendEmailRequest;
  try {
    payload = await req.json();
  } catch (e) {
    console.error("Invalid JSON:", e);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const toList = normalizeRecipients(payload.to);
  if (!toList.length) {
    return new Response(JSON.stringify({ error: "Missing 'to' recipient(s)" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!payload.subject) {
    return new Response(JSON.stringify({ error: "Missing 'subject'" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const bodyHtml = buildHtml(payload.html, payload.text);

  // Convert recipients to simple email format for Resend
  const toEmails = toList.map(r => r.email);
  const ccEmails = payload.cc ? normalizeRecipients(payload.cc).map(r => r.email) : undefined;
  const bccEmails = payload.bcc ? normalizeRecipients(payload.bcc).map(r => r.email) : undefined;

  try {
    const senderName = payload.from_name || FROM_NAME;
    const senderEmail = payload.from_email || FROM_EMAIL;
    const emailData: any = {
      from: senderName ? `${senderName} <${senderEmail}>` : senderEmail,
      to: toEmails,
      subject: payload.subject,
      html: bodyHtml,
    };

    if (payload.text) {
      emailData.text = payload.text;
    }

    if (ccEmails && ccEmails.length > 0) {
      emailData.cc = ccEmails;
    }

    if (bccEmails && bccEmails.length > 0) {
      emailData.bcc = bccEmails;
    }

    if (payload.reply_to) {
      emailData.reply_to = typeof payload.reply_to === 'string' ? payload.reply_to : payload.reply_to.email;
    }

    console.log("Sending email via Resend:", { 
      to: toEmails.length, 
      cc: ccEmails?.length || 0, 
      bcc: bccEmails?.length || 0 
    });

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error("Resend error:", error);
      
      // Log failed email to unified email_logs if metadata.email_type is provided
      if (payload.metadata?.email_type) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          if (supabaseUrl && supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const firstRecipient = toList[0];
            const { error: logError } = await supabase
              .from('email_logs')
              .insert({
                email_type: payload.metadata.email_type,
                recipient_email: firstRecipient.email,
                recipient_name: firstRecipient.name,
                agent_id: payload.metadata.agent_id || null,
                subject: payload.subject,
                status: 'failed',
                error_message: JSON.stringify(error),
                metadata: payload.metadata
              });
            if (logError) {
              console.error('Failed to log failed email:', logError);
            }
          }
        } catch (logErr) {
          console.error('Error logging failed email:', logErr);
        }
      }
      
      return new Response(
        JSON.stringify({
          error: "Email sending failed",
          details: error,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully via Resend:", data?.id);

    // Log successful email to unified email_logs if metadata.email_type is provided
    if (payload.metadata?.email_type) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const firstRecipient = toList[0];
          const { error: logError } = await supabase
            .from('email_logs')
            .insert({
              email_type: payload.metadata.email_type,
              recipient_email: firstRecipient.email,
              recipient_name: firstRecipient.name,
              agent_id: payload.metadata.agent_id || null,
              subject: payload.subject,
              status: 'sent',
              resend_email_id: data?.id,
              metadata: payload.metadata,
              sent_at: new Date().toISOString()
            });
          if (logError) {
            console.error('Failed to log email to unified table:', logError);
          }
        }
      } catch (logErr) {
        console.error('Error logging email:', logErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

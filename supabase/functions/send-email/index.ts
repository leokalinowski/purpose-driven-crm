
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
  reply_to?: EmailRecipient;
  categories?: string[];
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
  const companyAddress = Deno.env.get("COMPANY_PHYSICAL_ADDRESS");
  const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SECRET");
  // Simple footer. If UNSUBSCRIBE_SECRET is present you can implement a real unsubscribe mechanism later.
  const parts: string[] = [];
  if (companyAddress) {
    parts.push(`<p style="margin: 8px 0; color:#6b7280; font-size:12px;">${companyAddress}</p>`);
  }
  if (unsubscribeSecret) {
    parts.push(
      `<p style="margin: 8px 0; color:#6b7280; font-size:12px;">If you no longer wish to receive these emails, you can unsubscribe by replying with "UNSUBSCRIBE".</p>`
    );
  }
  if (parts.length === 0) return "";
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

  const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
  const FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL");
  const FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") ?? undefined;

  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    console.error("Missing required SendGrid env vars.");
    return new Response(
      JSON.stringify({ error: "Server not configured for email (missing env vars)." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

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

  const personalizations: any = [
    {
      to: toList,
      ...(payload.cc ? { cc: normalizeRecipients(payload.cc) } : {}),
      ...(payload.bcc ? { bcc: normalizeRecipients(payload.bcc) } : {}),
      ...(payload.categories ? { categories: payload.categories } : {}),
      subject: payload.subject,
    },
  ];

  const sendgridBody = {
    personalizations,
    from: { email: FROM_EMAIL, ...(FROM_NAME ? { name: FROM_NAME } : {}) },
    ...(payload.reply_to ? { reply_to: payload.reply_to } : {}),
    content: [
      ...(payload.text ? [{ type: "text/plain", value: payload.text }] : []),
      { type: "text/html", value: bodyHtml },
    ],
  };

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendgridBody),
    });

    const ok = res.status === 202;
    const respText = await res.text();
    console.log("SendGrid response:", res.status, respText);

    if (!ok) {
      return new Response(
        JSON.stringify({
          error: "SendGrid request failed",
          status: res.status,
          body: respText,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ ok: true, status: res.status }), {
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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getCurrentWeekNumber(date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  const week = Math.floor(day / 7) + 1;
  return Math.max(1, Math.min(52, week));
}

function formatLeadName(lead: any): string {
  if (!lead) return "Unknown Lead";
  if (lead.name && lead.name.trim().length > 0) return lead.name;
  return `${lead.first_name ? lead.first_name + " " : ""}${lead.last_name ?? ""}`.trim() || "Unknown Lead";
}

async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "no-reply@example.com";
  const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "PO2 Tasks";

  if (!sendgridKey) {
    console.error("SENDGRID_API_KEY not configured");
    throw new Error("Missing SENDGRID_API_KEY");
  }

  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sendgridKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        { to: [{ email: to }] }
      ],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html }
      ]
    })
  });

  if (resp.status !== 202) {
    const body = await resp.text();
    console.error("SendGrid error", resp.status, body);
    throw new Error(`SendGrid error ${resp.status}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRole);

    const now = new Date();
    const week = getCurrentWeekNumber(now);
    const year = now.getFullYear();

    let payload: any = {};
    try {
      payload = await req.json();
    } catch (_) {}

    const mode = payload?.mode ?? "global"; // "global" or a specific user_id

    // Fetch tasks for current week/year
    const { data: tasks, error: tasksError } = await supabase
      .from("po2_tasks")
      .select("id, task_type, completed, agent_id, lead:leads(name, first_name, last_name, phone_number, category)")
      .eq("week_number", week)
      .eq("year", year);

    if (tasksError) throw tasksError;

    // Group by agent
    const byAgent = new Map<string, any[]>();
    for (const t of tasks || []) {
      if (mode !== "global" && t.agent_id !== mode) continue;
      if (!byAgent.has(t.agent_id)) byAgent.set(t.agent_id, []);
      byAgent.get(t.agent_id)!.push(t);
    }

    const agentIds = Array.from(byAgent.keys());
    if (agentIds.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks to email" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch agent emails
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email")
      .in("user_id", agentIds);
    if (profilesError) throw profilesError;

    const profileMap = new Map<string, { email: string | null; name: string }>();
    for (const p of profiles || []) {
      profileMap.set(p.user_id, { email: p.email, name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() });
    }

    let sent = 0;
    for (const agentId of agentIds) {
      const agentTasks = byAgent.get(agentId)!;
      const profile = profileMap.get(agentId);
      const toEmail = profile?.email;
      if (!toEmail) {
        console.warn(`Skipping agent ${agentId} due to missing email`);
        continue;
      }

      const callTasks = agentTasks.filter((t) => t.task_type === "call");
      const textTasks = agentTasks.filter((t) => t.task_type === "text");

      const lines: string[] = [];
      lines.push(`PO2 Tasks for Week ${week} - ${year}`);
      lines.push("");
      lines.push(`Call Tasks (${callTasks.length})`);
      for (const t of callTasks) {
        lines.push(`- ${formatLeadName(t.lead)}${t.lead?.category ? ` (Category ${t.lead.category})` : ""}${t.lead?.phone_number ? ` - ${t.lead.phone_number}` : ""}`);
      }
      lines.push("");
      lines.push(`Text Tasks (${textTasks.length})`);
      for (const t of textTasks) {
        lines.push(`- ${formatLeadName(t.lead)}${t.lead?.category ? ` (Category ${t.lead.category})` : ""}${t.lead?.phone_number ? ` - ${t.lead.phone_number}` : ""}`);
      }

      const text = lines.join("\n");
      const html = `
        <div>
          <h2>PO2 Tasks for Week ${week} - ${year}</h2>
          <p>Hi ${profile?.name || "Agent"}, here are your assignments:</p>
          <h3>Call Tasks (${callTasks.length})</h3>
          <ul>
            ${callTasks.map((t: any) => `<li>${formatLeadName(t.lead)}${t.lead?.category ? ` (Category ${t.lead.category})` : ""}${t.lead?.phone_number ? ` - ${t.lead.phone_number}` : ""}</li>`).join("")}
          </ul>
          <h3>Text Tasks (${textTasks.length})</h3>
          <ul>
            ${textTasks.map((t: any) => `<li>${formatLeadName(t.lead)}${t.lead?.category ? ` (Category ${t.lead.category})` : ""}${t.lead?.phone_number ? ` - ${t.lead.phone_number}` : ""}</li>`).join("")}
          </ul>
          <p style="color:#666">This list is generated automatically every Monday at 5:30 AM.</p>
        </div>`;

      await sendEmail({ to: toEmail, subject: `PO2 Tasks - Week ${week}`, html, text });
      sent++;
    }

    return new Response(JSON.stringify({ sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("po2-email-function error", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
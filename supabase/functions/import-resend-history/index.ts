import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Infer email type from subject line
function inferEmailType(subject: string): string {
  const subjectLower = subject.toLowerCase();
  
  if (subjectLower.includes("invited to join") || subjectLower.includes("invitation")) {
    return "team_invitation";
  }
  if (subjectLower.includes("scoreboard") || subjectLower.includes("coaching reminder")) {
    return "success_scoreboard_reminder";
  }
  if (subjectLower.includes("rsvp") || subjectLower.includes("registration confirmed")) {
    return "event_confirmation";
  }
  if (subjectLower.includes("event reminder")) {
    return "event_reminder";
  }
  if (subjectLower.includes("market report") || subjectLower.includes("newsletter")) {
    return "newsletter";
  }
  if (subjectLower.includes("spheresync") || subjectLower.includes("weekly tasks") || subjectLower.includes("contacts to reach")) {
    return "spheresync_weekly";
  }
  if (subjectLower.includes("dnc") || subjectLower.includes("do not call")) {
    return "dnc_report";
  }
  
  return "other";
}

// Map Resend status to our status
function mapStatus(lastEvent: string | null): string {
  if (!lastEvent) return "sent";
  
  const eventLower = lastEvent.toLowerCase();
  if (eventLower === "delivered") return "delivered";
  if (eventLower === "opened") return "opened";
  if (eventLower === "clicked") return "clicked";
  if (eventLower === "bounced") return "bounced";
  if (eventLower === "complained") return "complained";
  if (eventLower === "unsubscribed") return "unsubscribed";
  
  return "sent";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resend = new Resend(resendApiKey);

    console.log("Starting Resend history import...");

    // Fetch emails from Resend with pagination
    const allEmails: any[] = [];
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 50; // Safety limit

    // Resend uses cursor-based pagination
    let lastEmailId: string | undefined = undefined;

    while (hasMore && pageCount < maxPages) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);

      try {
        // Note: Resend's list API returns most recent first
        const listParams: any = { limit: 100 };
        if (lastEmailId) {
          listParams.starting_after = lastEmailId;
        }

        const response = await resend.emails.list(listParams);
        
        if (!response.data || !response.data.data) {
          console.log("No more emails or invalid response");
          hasMore = false;
          break;
        }

        const emails = response.data.data;
        console.log(`Got ${emails.length} emails on page ${pageCount}`);

        if (emails.length === 0) {
          hasMore = false;
          break;
        }

        allEmails.push(...emails);
        lastEmailId = emails[emails.length - 1].id;

        // Check if there are more pages
        hasMore = emails.length === 100;

        // Rate limiting - wait 500ms between requests
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (fetchError: any) {
        console.error(`Error fetching page ${pageCount}:`, fetchError);
        hasMore = false;
      }
    }

    console.log(`Total emails fetched: ${allEmails.length}`);

    if (allEmails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No emails found in Resend",
          imported: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map emails to our schema
    const emailLogs = allEmails.map((email: any) => {
      const toEmail = Array.isArray(email.to) ? email.to[0] : email.to;
      
      return {
        resend_email_id: email.id,
        recipient_email: toEmail || "unknown",
        subject: email.subject || "No Subject",
        email_type: inferEmailType(email.subject || ""),
        status: mapStatus(email.last_event),
        sent_at: email.created_at,
        created_at: email.created_at,
        // These will be NULL for imported records
        agent_id: null,
        recipient_name: null,
        metadata: {
          imported_from_resend: true,
          import_date: new Date().toISOString(),
          original_data: {
            from: email.from,
            last_event: email.last_event,
          }
        }
      };
    });

    // Upsert in batches to avoid timeout
    const batchSize = 50;
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < emailLogs.length; i += batchSize) {
      const batch = emailLogs.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from("email_logs")
        .upsert(batch, { 
          onConflict: "resend_email_id",
          ignoreDuplicates: true 
        })
        .select();

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        errorCount += batch.length;
      } else {
        importedCount += data?.length || 0;
        skippedCount += batch.length - (data?.length || 0);
      }
    }

    console.log(`Import complete: ${importedCount} imported, ${skippedCount} skipped (duplicates), ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email history import complete",
        stats: {
          fetched: allEmails.length,
          imported: importedCount,
          skipped: skippedCount,
          errors: errorCount
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

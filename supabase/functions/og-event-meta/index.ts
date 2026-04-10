import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CRAWLER_PATTERNS = [
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "WhatsApp",
  "TelegramBot",
  "Discordbot",
  "Googlebot",
  "bingbot",
  "iMessageLinkPreviews",
  "Applebot",
  "Pinterest",
  "Embedly",
  "Quora Link Preview",
  "Showyoubot",
  "outbrain",
  "vkShare",
  "W3C_Validator",
];

const DEFAULT_OG_IMAGE = "https://purpose-driven-crm.lovable.app/og-image.png";
const SITE_URL = "https://purpose-driven-crm.lovable.app";

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some((p) => ua.includes(p.toLowerCase()));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response("Missing slug", { status: 400, headers: corsHeaders });
  }

  const userAgent = req.headers.get("user-agent");
  const spaUrl = `${SITE_URL}/event/${slug}`;

  // Regular browsers get a fast redirect to the SPA
  if (!isCrawler(userAgent)) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: spaUrl },
    });
  }

  // Crawlers: fetch event data and return OG meta HTML
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: event, error } = await supabase
      .from("events")
      .select("title, description, header_image_url, event_date, location, is_published")
      .eq("public_slug", slug)
      .eq("is_published", true)
      .single();

    if (error || !event) {
      // Fallback: redirect crawler to SPA anyway
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: spaUrl },
      });
    }

    const ogTitle = event.title;
    const ogImage = event.header_image_url || DEFAULT_OG_IMAGE;

    const datePart = event.event_date
      ? new Date(event.event_date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";
    const locationPart = event.location || "";
    const ogDescription = [datePart, locationPart].filter(Boolean).join(" · ") ||
      event.description ||
      "You're invited! RSVP now.";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(ogTitle)}</title>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${spaUrl}"/>
  <meta property="og:title" content="${escapeHtml(ogTitle)}"/>
  <meta property="og:description" content="${escapeHtml(ogDescription)}"/>
  <meta property="og:image" content="${escapeHtml(ogImage)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}"/>
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}"/>
  <meta name="twitter:image" content="${escapeHtml(ogImage)}"/>
  <meta http-equiv="refresh" content="0;url=${spaUrl}"/>
</head>
<body>
  <p>Redirecting to <a href="${spaUrl}">${escapeHtml(ogTitle)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("og-event-meta error:", err);
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: spaUrl },
    });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

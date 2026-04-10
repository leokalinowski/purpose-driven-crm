import { corsHeaders } from "../_shared/cors.ts";

const CRAWLER_PATTERNS = [
  "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot",
  "Slackbot", "WhatsApp", "TelegramBot", "Discordbot", "Googlebot",
  "bingbot", "iMessageLinkPreviews", "Applebot", "Pinterest", "Embedly",
];

const DEFAULT_OG_IMAGE = "https://hub.realestateonpurpose.com/og-image.png";
const OG_SITE_URL = "https://hub.realestateonpurpose.com";
const REDIRECT_URL = "https://purpose-driven-crm.lovable.app";

function isCrawler(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CRAWLER_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

  const spaUrl = `${SITE_URL}/event/${slug}`;

  if (!isCrawler(req.headers.get("user-agent"))) {
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: spaUrl } });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/events?public_slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=title,description,header_image_url,event_date,location&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );

    const rows = await res.json();
    const event = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!event) {
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: spaUrl } });
    }

    const ogTitle = event.title;
    const ogImage = event.header_image_url || DEFAULT_OG_IMAGE;
    const datePart = event.event_date
      ? new Date(event.event_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "";
    const locationPart = event.location || "";
    const ogDescription = [datePart, locationPart].filter(Boolean).join(" · ") || event.description || "You're invited! RSVP now.";

    const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><title>${esc(ogTitle)}</title>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${spaUrl}"/>
<meta property="og:title" content="${esc(ogTitle)}"/>
<meta property="og:description" content="${esc(ogDescription)}"/>
<meta property="og:image" content="${esc(ogImage)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(ogTitle)}"/>
<meta name="twitter:description" content="${esc(ogDescription)}"/>
<meta name="twitter:image" content="${esc(ogImage)}"/>
<meta http-equiv="refresh" content="0;url=${spaUrl}"/>
</head><body><p>Redirecting…</p></body></html>`;

    return new Response(html, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    console.error("og-event-meta error:", err);
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: spaUrl } });
  }
});

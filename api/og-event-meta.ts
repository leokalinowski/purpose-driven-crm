import type { VercelRequest, VercelResponse } from "@vercel/node";

const CRAWLER_PATTERNS = [
  "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot",
  "Slackbot", "WhatsApp", "TelegramBot", "Discordbot", "Googlebot",
  "bingbot", "iMessageLinkPreviews", "Applebot", "Pinterest", "Embedly",
];

const SUPABASE_URL = "https://cguoaokqwgqvzkqqezcq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU";
const DEFAULT_OG_IMAGE = "https://hub.realestateonpurpose.com/og-image.png";
const SITE_URL = "https://hub.realestateonpurpose.com";
const SPA_ORIGIN = "https://purpose-driven-crm.lovable.app";

function isCrawler(ua: string | undefined): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CRAWLER_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug as string | undefined;
  if (!slug) {
    return res.status(400).send("Missing slug");
  }

  const spaUrl = `${SITE_URL}/event/${slug}`;
  const ua = req.headers["user-agent"] as string | undefined;

  // Human browsers: proxy the SPA with <base> tag
  if (!isCrawler(ua)) {
    try {
      const spaRes = await fetch(`${SPA_ORIGIN}/event/${slug}`, {
        headers: { Accept: "text/html" },
        redirect: "follow",
      });
      let html = await spaRes.text();
      html = html.replace("<head>", `<head><base href="${SPA_ORIGIN}/">`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      return res.status(200).send(html);
    } catch (e) {
      // Fallback redirect
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"/><script>window.location.replace("${spaUrl}");</script></head><body></body></html>`
      );
    }
  }

  // Crawlers: serve OG meta tags
  try {
    const apiRes = await fetch(
      `${SUPABASE_URL}/rest/v1/events?public_slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=title,description,header_image_url,event_date,location&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await apiRes.json();
    const event = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!event) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="refresh" content="0;url=${spaUrl}"/></head><body><p>Redirecting…</p></body></html>`
      );
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

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="refresh" content="0;url=${spaUrl}"/></head><body><p>Redirecting…</p></body></html>`
    );
  }
}

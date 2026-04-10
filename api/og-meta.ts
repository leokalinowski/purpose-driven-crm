import type { VercelRequest, VercelResponse } from "@vercel/node";

const CRAWLER_PATTERNS = [
  "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot",
  "Slackbot", "WhatsApp", "TelegramBot", "Discordbot", "Googlebot",
  "bingbot", "iMessageLinkPreviews", "Applebot", "Pinterest", "Embedly",
];

const SUPABASE_URL = "https://cguoaokqwgqvzkqqezcq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBnn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU";
const DEFAULT_OG_IMAGE = "https://hub.realestateonpurpose.com/og-image.png";
const SITE_URL = "https://hub.realestateonpurpose.com";
const SPA_ORIGIN = "https://purpose-driven-crm.lovable.app";

// Static page metadata
const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Real Estate on Purpose — CRM & Coaching Hub",
    description: "The all-in-one CRM, coaching, and marketing platform built for purpose-driven real estate professionals.",
  },
  "/pricing": {
    title: "Pricing — Real Estate on Purpose",
    description: "Explore plans and pricing for the Real Estate on Purpose platform. Find the right fit for your team.",
  },
  "/newsletter": {
    title: "Newsletter — Real Estate on Purpose",
    description: "Stay connected with your sphere through automated, branded market-report newsletters.",
  },
  "/pipeline": {
    title: "Pipeline — Real Estate on Purpose",
    description: "Track deals from lead to close with a visual pipeline built for real estate agents.",
  },
  "/coaching": {
    title: "Coaching — Real Estate on Purpose",
    description: "Weekly accountability coaching to help you grow your real estate business on purpose.",
  },
  "/resources": {
    title: "Resources — Real Estate on Purpose",
    description: "Tools, guides, and resources to help purpose-driven agents succeed.",
  },
  "/support": {
    title: "Support — Real Estate on Purpose",
    description: "Get help and submit support tickets for the Real Estate on Purpose platform.",
  },
  "/transactions": {
    title: "Transactions — Real Estate on Purpose",
    description: "View and manage your real estate transactions and commission tracking.",
  },
  "/database": {
    title: "Database — Real Estate on Purpose",
    description: "Manage your contacts and sphere of influence in one organized database.",
  },
  "/events": {
    title: "Events — Real Estate on Purpose",
    description: "Plan, promote, and manage client appreciation events and community gatherings.",
  },
  "/settings": {
    title: "Settings — Real Estate on Purpose",
    description: "Manage your account settings and preferences.",
  },
};

function isCrawler(ua: string | undefined): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CRAWLER_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildOgHtml(title: string, description: string, image: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><title>${esc(title)}</title>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${esc(url)}"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:image" content="${esc(image)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${esc(image)}"/>
<meta http-equiv="refresh" content="0;url=${esc(url)}"/>
</head><body><p>Redirecting…</p></body></html>`;
}

async function getEventMeta(slug: string): Promise<{ title: string; description: string; image: string } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/events?public_slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=title,description,header_image_url,event_date,location&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await res.json();
    const event = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!event) return null;

    const datePart = event.event_date
      ? new Date(event.event_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "";
    const locationPart = event.location || "";
    const description = [datePart, locationPart].filter(Boolean).join(" · ") || event.description || "You're invited! RSVP now.";

    return {
      title: event.title,
      description,
      image: event.header_image_url || DEFAULT_OG_IMAGE,
    };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.query.path as string) || "/";
  const fullUrl = `${SITE_URL}${path}`;
  const ua = req.headers["user-agent"] as string | undefined;

  // ── Human browsers: serve the SPA shell ──
  if (!isCrawler(ua)) {
    try {
      const spaRes = await fetch(`${SPA_ORIGIN}/`, {
        headers: { Accept: "text/html" },
        redirect: "follow",
      });
      const html = await spaRes.text();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(html);
    } catch {
      return res.redirect(302, `${SPA_ORIGIN}${path}`);
    }
  }

  // ── Crawlers: serve OG meta tags ──

  // Check if this is an event page
  const eventMatch = path.match(/^\/event\/([^/]+)$/);
  if (eventMatch) {
    const slug = eventMatch[1];
    const meta = await getEventMeta(slug);
    if (meta) {
      const html = buildOgHtml(meta.title, meta.description, meta.image, fullUrl);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
      return res.status(200).send(html);
    }
  }

  // Static page or fallback
  const pageMeta = PAGE_META[path] || {
    title: "Real Estate on Purpose",
    description: "The all-in-one CRM, coaching, and marketing platform built for purpose-driven real estate professionals.",
  };

  const html = buildOgHtml(pageMeta.title, pageMeta.description, DEFAULT_OG_IMAGE, fullUrl);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
  return res.status(200).send(html);
}

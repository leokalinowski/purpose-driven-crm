import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-service-key',
};

const DELAY_BETWEEN_EMAILS_MS = 200;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateUnsubscribeToken(email: string, agentId: string): Promise<string> {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET');
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET must be configured');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const data = encoder.encode(`${email}:${agentId}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Server-side template renderer ───────────────────────────────────────────

interface AgentProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  office_number: string | null;
  office_address: string | null;
  brokerage: string | null;
  license_number: string | null;
  website: string | null;
  team_name: string | null;
}

interface MarketingSettings {
  headshot_url: string | null;
  logo_colored_url: string | null;
}

interface BlockProps { [key: string]: any; }
interface Block { id: string; type: string; props: BlockProps; children?: Block[][]; }
interface GlobalStyles { backgroundColor: string; contentWidth: number; fontFamily: string; bodyColor: string; }

const DEFAULT_GLOBAL_STYLES: GlobalStyles = {
  backgroundColor: '#f4f4f5',
  contentWidth: 640,
  fontFamily: 'Georgia, serif',
  bodyColor: '#1a1a1a',
};

function convertNewlines(html: string): string {
  if (/<(p|div|br|ul|ol|li|h[1-6])\b/i.test(html)) return html;
  return html.replace(/\n/g, '<br />');
}

function renderHeading(p: BlockProps): string {
  const tag = `h${p.level || 2}`;
  const sizes: Record<number, string> = { 1: '32px', 2: '26px', 3: '22px', 4: '18px' };
  const color = p.color ? `color:${p.color};` : '';
  return `<${tag} style="margin:0;padding:0;text-align:${p.align||'center'};${color}font-size:${sizes[p.level||2]};line-height:1.3;">${escapeHtml(p.text||'')}</${tag}>`;
}

function renderText(p: BlockProps): string {
  const color = p.color ? `color:${p.color};` : '';
  return `<div style="text-align:${p.align||'left'};${color}font-size:${p.fontSize||16}px;line-height:1.6;">${convertNewlines(p.html||'')}</div>`;
}

function renderImage(p: BlockProps): string {
  const img = `<img src="${p.src||''}" alt="${escapeHtml(p.alt||'')}" style="max-width:100%;width:${p.width||'100%'};height:auto;display:inline-block;border-radius:${p.borderRadius||0}px;" />`;
  const wrapped = p.linkUrl ? `<a href="${p.linkUrl}" target="_blank">${img}</a>` : img;
  return `<div style="text-align:${p.align||'center'};">${wrapped}</div>`;
}

function renderButton(p: BlockProps): string {
  const width = p.fullWidth ? 'display:block;width:100%;' : 'display:inline-block;';
  return `<div style="text-align:${p.align||'center'};padding:8px 0;">
    <a href="${p.url||'#'}" target="_blank" style="${width}background-color:${p.backgroundColor||'#2563eb'};color:${p.textColor||'#ffffff'};padding:14px 28px;border-radius:${p.borderRadius||6}px;text-decoration:none;font-weight:600;font-size:16px;text-align:center;">${escapeHtml(p.text||'Click Here')}</a>
  </div>`;
}

function renderDivider(p: BlockProps): string {
  return `<hr style="border:none;border-top:${p.thickness||1}px ${p.style||'solid'} ${p.color||'#e5e7eb'};width:${p.width||'100%'};margin:0 auto;" />`;
}

function renderSpacer(p: BlockProps): string {
  return `<div style="height:${p.height||24}px;line-height:${p.height||24}px;font-size:1px;">&nbsp;</div>`;
}

function renderAgentBio(p: BlockProps): string {
  const imageSections: string[] = [];
  const textSections: string[] = [];

  if (p.showHeadshot !== false) imageSections.push('<div class="agent-headshot">{{agent_headshot}}</div>');
  if (p.showLogo !== false) imageSections.push('<div class="agent-logo">{{agent_logo}}</div>');
  textSections.push('<p style="margin:4px 0;font-weight:bold;font-size:16px;">{{agent_name}}</p>');
  if (p.showLicense !== false) textSections.push('<p style="margin:2px 0;font-size:12px;opacity:0.6;">License: {{agent_license}}</p>');
  if (p.showBrokerage !== false) textSections.push('<p style="margin:2px 0;font-size:13px;">{{agent_brokerage}}</p>');
  if (p.showPhone !== false) textSections.push('<p style="margin:2px 0;font-size:13px;">📱 {{agent_phone}}</p>');
  if (p.showOfficePhone !== false) textSections.push('<p style="margin:2px 0;font-size:13px;">☎️ {{agent_office_phone}}</p>');
  if (p.showEmail !== false) textSections.push('<p style="margin:2px 0;font-size:13px;">✉️ {{agent_email}}</p>');
  if (p.showOfficeAddress !== false) textSections.push('<p style="margin:2px 0;font-size:12px;opacity:0.6;">{{agent_office_address}}</p>');
  if (p.showWebsite !== false) textSections.push('<p style="margin:2px 0;font-size:13px;"><a href="{{agent_website}}" style="color:#2563eb;">{{agent_website}}</a></p>');
  if (p.showEqualHousing !== false) {
    textSections.push('<p style="margin:8px 0 0;font-size:11px;opacity:0.5;">Equal Housing Opportunity. Each office independently owned and operated.</p>');
  }

  if (p.layout === 'horizontal') {
    return `<div style="background:#f8fafc;border-radius:8px;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${imageSections.length > 0 ? `<td style="width:100px;vertical-align:top;text-align:center;padding-right:16px;">${imageSections.join('\n')}</td>` : ''}
        <td style="vertical-align:top;text-align:left;">${textSections.join('\n')}</td>
      </tr></table>
    </div>`;
  }

  const allSections = [...imageSections, ...textSections];
  return `<div style="background:#f8fafc;border-radius:8px;padding:20px;text-align:center;">${allSections.join('\n    ')}</div>`;
}

function renderListings(p: BlockProps): string {
  const listings = p.listings || [];
  if (listings.length === 0) return '';
  const isGrid = (p.style || 'grid') === 'grid';
  let html = `<div style="padding:4px 0;"><h3 style="margin:0 0 16px;font-size:20px;font-weight:600;">Featured Listings</h3>`;
  if (isGrid) {
    html += `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`;
    listings.forEach((l: any, i: number) => {
      if (i > 0 && i % 2 === 0) html += `</tr><tr>`;
      const cardContent = `<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#ffffff;">
          ${l.image_url ? `<img src="${l.image_url}" alt="${escapeHtml(l.address)}" style="width:100%;height:140px;object-fit:cover;display:block;" />` : ''}
          <div style="padding:12px;">
            <p style="margin:0;font-weight:700;font-size:16px;">${escapeHtml(l.price)}</p>
            <p style="margin:4px 0 0;font-size:13px;">${escapeHtml(l.address)}</p>
            ${l.city ? `<p style="margin:2px 0 0;font-size:12px;opacity:0.7;">${escapeHtml(l.city)}</p>` : ''}
            <p style="margin:6px 0 0;font-size:12px;opacity:0.5;">${l.beds} bed · ${l.baths} bath · ${escapeHtml(String(l.sqft))} sqft</p>
            ${l.url ? `<p style="margin:8px 0 0;"><a href="${l.url}" target="_blank" style="color:#2563eb;font-size:13px;font-weight:600;text-decoration:none;">View Listing →</a></p>` : ''}
          </div>
        </div>`;
      html += `<td style="width:50%;vertical-align:top;padding:6px;">
        ${l.url ? `<a href="${l.url}" target="_blank" style="text-decoration:none;color:inherit;">${cardContent}</a>` : cardContent}
      </td>`;
    });
    if (listings.length % 2 !== 0) html += `<td style="width:50%;"></td>`;
    html += `</tr></table>`;
  } else {
    listings.forEach((l: any) => {
      html += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#ffffff;">
        <tr>
          ${l.image_url ? `<td style="width:120px;"><img src="${l.image_url}" alt="${escapeHtml(l.address)}" style="width:120px;height:90px;object-fit:cover;display:block;" /></td>` : ''}
          <td style="padding:12px;vertical-align:top;">
            <p style="margin:0;font-weight:700;font-size:16px;">${escapeHtml(l.price)}</p>
            <p style="margin:4px 0 0;font-size:13px;">${escapeHtml(l.address)}</p>
            ${l.city ? `<p style="margin:2px 0 0;font-size:12px;opacity:0.7;">${escapeHtml(l.city)}</p>` : ''}
            <p style="margin:6px 0 0;font-size:12px;opacity:0.5;">${l.beds} bed · ${l.baths} bath · ${escapeHtml(String(l.sqft))} sqft</p>
            ${l.url ? `<p style="margin:8px 0 0;"><a href="${l.url}" target="_blank" style="color:#2563eb;font-size:13px;font-weight:600;text-decoration:none;">View Listing →</a></p>` : ''}
          </td>
        </tr>
      </table>`;
    });
  }
  html += `</div>`;
  return html;
}

function renderSocialIcons(p: BlockProps): string {
  const align = p.align || 'center';
  const iconSize = p.iconSize || 24;
  const links: { platform: string; url: string }[] = p.links || [];
  const colors: Record<string, string> = { facebook: '#1877F2', instagram: '#E4405F', linkedin: '#0A66C2', twitter: '#000000', youtube: '#FF0000', tiktok: '#000000' };
  if (links.length === 0) return '';
  const fontSize = Math.max(11, Math.round(iconSize * 0.55));
  const padding = `${Math.round(iconSize * 0.25)}px ${Math.round(iconSize * 0.58)}px`;
  const icons = links.map(l => {
    const c = colors[l.platform] || '#6b7280';
    const name = l.platform.charAt(0).toUpperCase() + l.platform.slice(1);
    return `<a href="${l.url}" target="_blank" style="display:inline-block;background-color:${c};color:#ffffff;padding:${padding};border-radius:20px;text-decoration:none;font-size:${fontSize}px;font-weight:600;margin:0 4px;">${name}</a>`;
  }).join('\n    ');
  return `<div style="text-align:${align};padding:8px 0;">${icons}</div>`;
}

function renderBlock(block: Block, gs: GlobalStyles): string {
  let content = '';
  switch (block.type) {
    case 'heading': content = renderHeading(block.props); break;
    case 'text': content = renderText(block.props); break;
    case 'image': content = renderImage(block.props); break;
    case 'button': content = renderButton(block.props); break;
    case 'divider': content = renderDivider(block.props); break;
    case 'spacer': content = renderSpacer(block.props); break;
    case 'agent_bio': content = renderAgentBio(block.props); break;
    case 'listings': content = renderListings(block.props); break;
    case 'social_icons': content = renderSocialIcons(block.props); break;
    case 'columns': {
      const cols = block.children || [];
      const colCount = cols.length || 2;
      const gap = block.props.gap || 16;
      const colWidth = Math.floor(100 / colCount);
      content = `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`;
      cols.forEach((col, i) => {
        content += `<td class="nl-col" style="width:${colWidth}%;vertical-align:top;${i < cols.length - 1 ? `padding-right:${gap}px;` : ''}">`;
        col.forEach(child => { content += renderBlock(child, gs); });
        content += `</td>`;
      });
      content += `</tr></table>`;
      break;
    }
    case 'html_raw': content = block.props.html || ''; break;
    default: content = '';
  }
  return `<div style="padding:8px 0;">${content}</div>`;
}

function renderBlocksToHtml(blocks: Block[], styles: Partial<GlobalStyles>): string {
  const gs = { ...DEFAULT_GLOBAL_STYLES, ...styles };
  const inner = blocks.map(b => renderBlock(b, gs)).join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  @media only screen and (max-width: 600px) {
    .nl-col { display: block !important; width: 100% !important; padding-right: 0 !important; padding-bottom: 12px; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${gs.backgroundColor};font-family:${gs.fontFamily};color:${gs.bodyColor};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${gs.backgroundColor};">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="${gs.contentWidth}" cellpadding="0" cellspacing="0" border="0" style="max-width:${gs.contentWidth}px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px 24px;">
          ${inner}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function replaceAgentPlaceholders(html: string, agent: AgentProfile, marketing: MarketingSettings | null): string {
  const name = agent.full_name || [agent.first_name, agent.last_name].filter(Boolean).join(' ') || '';

  const replacements: Record<string, string | undefined> = {
    '{{agent_name}}': name,
    '{{agent_email}}': agent.email || undefined,
    '{{agent_phone}}': agent.phone_number || undefined,
    '{{agent_office_phone}}': agent.office_number || undefined,
    '{{agent_office_address}}': agent.office_address || undefined,
    '{{agent_brokerage}}': agent.brokerage || undefined,
    '{{agent_license}}': agent.license_number || undefined,
    '{{agent_website}}': agent.website || undefined,
  };

  if (marketing?.headshot_url) {
    html = html.replace('{{agent_headshot}}', `<img src="${marketing.headshot_url}" alt="Agent headshot" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:inline-block;margin-bottom:8px;" />`);
  } else {
    html = html.replace(/<div class="agent-headshot">[^<]*\{\{agent_headshot\}\}[^<]*<\/div>/g, '');
  }

  if (marketing?.logo_colored_url) {
    html = html.replace('{{agent_logo}}', `<img src="${marketing.logo_colored_url}" alt="Logo" style="max-width:160px;height:auto;display:inline-block;margin-bottom:8px;" />`);
  } else {
    html = html.replace(/<div class="agent-logo">[^<]*\{\{agent_logo\}\}[^<]*<\/div>/g, '');
  }

  for (const [placeholder, value] of Object.entries(replacements)) {
    const escaped = placeholder.replace(/[{}]/g, '\\$&');
    if (value) {
      html = html.replace(new RegExp(`href="${escaped}"`, 'g'), `href="${value}"`);
      html = html.replace(new RegExp(escaped, 'g'), escapeHtml(value));
    } else {
      html = html.replace(new RegExp(`<p[^>]*>[^<]*${escaped}[^<]*</p>`, 'g'), '');
      html = html.replace(new RegExp(`<a[^>]*>[^<]*${escaped}[^<]*</a>`, 'g'), '');
    }
  }

  return html;
}

function generateUnsubscribeFooter(unsubscribeUrl: string, agentName: string, companyAddress: string): string {
  return `
    <div style="padding: 20px 0; margin-top: 20px; border-top: 1px solid #e5e5e5; text-align: center;">
      <p style="font-size: 12px; color: #999; margin: 3px 0;">
        This email was sent because you are a valued contact in our sphere.
      </p>
      ${companyAddress ? `<p style="font-size: 12px; color: #999; margin: 3px 0;">${escapeHtml(companyAddress)}</p>` : ''}
      <p style="font-size: 12px; color: #999; margin: 8px 0;">
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe from these emails</a>
      </p>
      <p style="font-size: 12px; color: #999; margin: 3px 0;">
        © ${new Date().getFullYear()} ${escapeHtml(agentName)}. All rights reserved.
      </p>
    </div>`;
}

function generatePlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: validate caller's JWT, service-key bypass, or cron ──
    const authHeader = req.headers.get('Authorization');
    const xServiceKey = req.headers.get('x-service-key');
    const isServiceCall = xServiceKey === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let callerId: string | null = null;

    if (isServiceCall) {
      // Trusted internal call from newsletter-scheduled-send — skip JWT check
      callerId = null; // will be set from body.agent_id
    } else {
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user: callerUser }, error: userError } = await supabaseAuth.auth.getUser(token);
      if (userError || !callerUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      callerId = callerUser.id;
    }

    const body = await req.json();
    const { template_id, agent_id, subject, sender_name, recipient_filter, test_mode, test_email } = body;

    if (!template_id || !agent_id) {
      throw new Error('template_id and agent_id are required');
    }

    // Verify caller is either the agent themselves, an admin, or a service call
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (callerId && callerId !== agent_id) {
      // Check if caller is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', callerId)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Forbidden: only the agent or an admin can send newsletters' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // 1. Fetch template
    const { data: template, error: tplErr } = await supabase
      .from('newsletter_templates')
      .select('blocks_json, global_styles, name')
      .eq('id', template_id)
      .single();

    if (tplErr || !template) throw new Error('Template not found');

    // 2. Fetch agent profile
    const { data: agent, error: agentErr } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, full_name, email, phone_number, office_number, office_address, brokerage, license_number, website, team_name')
      .eq('user_id', agent_id)
      .single();

    if (agentErr || !agent) throw new Error('Agent profile not found');

    // 3. Fetch marketing settings (headshot, logo)
    const { data: marketing } = await supabase
      .from('agent_marketing_settings')
      .select('headshot_url, logo_colored_url')
      .eq('user_id', agent_id)
      .single();

    // 4. Render blocks to HTML
    const blocks: Block[] = template.blocks_json || [];
    const globalStyles = template.global_styles || {};
    let emailHtml = renderBlocksToHtml(blocks, globalStyles);
    emailHtml = replaceAgentPlaceholders(emailHtml, agent, marketing);

    const agentName = agent.full_name || [agent.first_name, agent.last_name].filter(Boolean).join(' ') || 'Your Agent';
    const companyAddress = Deno.env.get('COMPANY_PHYSICAL_ADDRESS') || agent.office_address || '';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || '';
    const fromName = sender_name || agentName;
    const emailSubject = subject || template.name;

    // ── Test mode: send only to the caller ──
    if (test_mode) {
      const to = test_email || agent.email;
      if (!to) throw new Error('No test email address available');

      const tokenVal = await generateUnsubscribeToken(to, agent_id);
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const unsubUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe?email=${encodeURIComponent(to)}&agent_id=${agent_id}&token=${tokenVal}`;
      const finalHtml = emailHtml.replace('</body>', generateUnsubscribeFooter(unsubUrl, agentName, companyAddress) + '</body>');

      const { error: sendErr } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: `[TEST] ${emailSubject}`,
        html: finalHtml,
        text: generatePlainText(finalHtml),
        reply_to: agent.email || undefined,
      });

      if (sendErr) throw new Error(sendErr.message);

      return new Response(JSON.stringify({ success: true, test: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Production send ──

    // 4b. Create a newsletter_campaigns record for tracking
    const campaignName = `Template: ${template.name} - ${new Date().toLocaleDateString()}`;
    const { data: campaignRecord, error: campaignErr } = await supabase
      .from('newsletter_campaigns')
      .insert({
        campaign_name: campaignName,
        created_by: agent_id,
        send_date: new Date().toISOString().split('T')[0],
        status: 'sending',
        open_rate: 0,
        click_through_rate: 0,
      })
      .select()
      .single();

    if (campaignErr) console.error('Failed to create campaign record:', campaignErr);

    // 5. Get unsubscribed emails
    const { data: unsubs } = await supabase
      .from('newsletter_unsubscribes')
      .select('email')
      .or(`agent_id.eq.${agent_id},agent_id.is.null`);
    const unsubSet = new Set((unsubs || []).map(u => u.email.toLowerCase()));

    // 6. Fetch contacts based on filter
    let contactQuery = supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('agent_id', agent_id)
      .not('email', 'is', null)
      .neq('email', '');

    if (recipient_filter?.type === 'tag' && recipient_filter.tag) {
      contactQuery = contactQuery.contains('tags', [recipient_filter.tag]);
    }

    const { data: contacts, error: contactsErr } = await contactQuery;
    if (contactsErr) throw new Error(`Failed to fetch contacts: ${contactsErr.message}`);

    // Deduplicate and filter
    const emailMap = new Map<string, typeof contacts[0]>();
    for (const c of (contacts || [])) {
      const email = c.email?.toLowerCase().trim();
      if (!email || !EMAIL_REGEX.test(email) || unsubSet.has(email)) continue;
      if (!emailMap.has(email)) emailMap.set(email, c);
    }

    const recipients = Array.from(emailMap.values());
    console.log(`Sending template "${template.name}" to ${recipients.length} recipients`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
      const contact = recipients[i];
      const contactEmail = contact.email!.toLowerCase().trim();

      try {
        const tokenVal = await generateUnsubscribeToken(contactEmail, agent_id);
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const unsubUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe?email=${encodeURIComponent(contactEmail)}&agent_id=${agent_id}&token=${tokenVal}`;
        const finalHtml = emailHtml.replace('</body>', generateUnsubscribeFooter(unsubUrl, agentName, companyAddress) + '</body>');

        const result = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [contactEmail],
          subject: emailSubject,
          html: finalHtml,
          text: generatePlainText(finalHtml),
          reply_to: agent.email || undefined,
          headers: {
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'X-Entity-Ref-ID': `nl-tpl-${contact.id}-${Date.now()}`,
          },
        });

        if (result.error) throw new Error(result.error.message);

        sent++;

        // Log to email_logs
        const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || null;
        const { error: logErr } = await supabase.from('email_logs').insert({
          email_type: 'newsletter',
          recipient_email: contactEmail,
          recipient_name: contactName,
          agent_id: agent_id,
          subject: emailSubject,
          status: 'sent',
          resend_email_id: result.data?.id || null,
          campaign_id: campaignRecord?.id || null,
          metadata: { template_id, template_name: template.name, contact_id: contact.id },
          sent_at: new Date().toISOString(),
        });
        if (logErr) console.error('Failed to log email:', logErr);

        // Log contact activity
        const { error: actErr } = await supabase.rpc('log_newsletter_activity', {
          p_contact_id: contact.id,
          p_agent_id: agent_id,
          p_campaign_name: `Template: ${template.name}`,
        });
        if (actErr) console.error('Failed to log activity:', actErr);

        if (i < recipients.length - 1) await delay(DELAY_BETWEEN_EMAILS_MS);
      } catch (err: any) {
        failed++;
        console.error(`Failed to send to ${contactEmail}:`, err.message);

        const { error: logErr } = await supabase.from('email_logs').insert({
          email_type: 'newsletter',
          recipient_email: contactEmail,
          agent_id: agent_id,
          subject: emailSubject,
          status: 'failed',
          error_message: err.message,
          campaign_id: campaignRecord?.id || null,
          metadata: { template_id, template_name: template.name, contact_id: contact.id },
        });
        if (logErr) console.error('Failed to log failed email:', logErr);
      }
    }

    console.log(`Template send complete: ${sent} sent, ${failed} failed`);

    // Update campaign record with final results
    if (campaignRecord) {
      await supabase.from('newsletter_campaigns').update({
        status: failed > 0 && sent === 0 ? 'failed' : 'sent',
        recipient_count: sent,
        open_rate: 0,
        click_through_rate: 0,
      }).eq('id', campaignRecord.id);
    }

    return new Response(JSON.stringify({
      success: true,
      emails_sent: sent,
      emails_failed: failed,
      total_recipients: recipients.length,
      campaign_id: campaignRecord?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in newsletter-template-send:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { NewsletterBlock, GlobalStyles, DEFAULT_GLOBAL_STYLES } from './types';

export interface AgentData {
  name?: string;
  email?: string;
  phone?: string;
  office_phone?: string;
  office_address?: string;
  brokerage?: string;
  license?: string;
  website?: string;
  headshot_url?: string;
  logo_url?: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHeading(props: Record<string, any>): string {
  const tag = `h${props.level || 2}`;
  const sizes: Record<number, string> = { 1: '32px', 2: '26px', 3: '22px', 4: '18px' };
  return `<${tag} style="margin:0;padding:0;text-align:${props.align || 'center'};color:${props.color || '#1a1a1a'};font-family:${props.fontFamily || 'Georgia, serif'};font-size:${sizes[props.level || 2]};line-height:1.3;">${escapeHtml(props.text || '')}</${tag}>`;
}

function convertNewlines(html: string): string {
  if (/<(p|div|br|ul|ol|li|h[1-6])\b/i.test(html)) return html;
  return html.replace(/\n/g, '<br />');
}

function renderText(props: Record<string, any>): string {
  return `<div style="text-align:${props.align || 'left'};color:${props.color || '#374151'};font-size:${props.fontSize || 16}px;line-height:1.6;font-family:${props.fontFamily || 'Georgia, serif'};">${convertNewlines(props.html || '')}</div>`;
}

function renderImage(props: Record<string, any>): string {
  const alignMap: Record<string, string> = { left: 'left', center: 'center', right: 'right' };
  const img = `<img src="${props.src || ''}" alt="${escapeHtml(props.alt || '')}" style="max-width:100%;width:${props.width || '100%'};height:auto;display:block;border-radius:${props.borderRadius || 0}px;" />`;
  const wrapped = props.linkUrl ? `<a href="${props.linkUrl}" target="_blank">${img}</a>` : img;
  return `<div style="text-align:${alignMap[props.align] || 'center'};">${wrapped}</div>`;
}

function renderButton(props: Record<string, any>): string {
  const width = props.fullWidth ? 'display:block;width:100%;' : 'display:inline-block;';
  return `<div style="text-align:${props.align || 'center'};padding:8px 0;">
    <a href="${props.url || '#'}" target="_blank" style="${width}background-color:${props.backgroundColor || '#2563eb'};color:${props.textColor || '#ffffff'};padding:14px 28px;border-radius:${props.borderRadius || 6}px;text-decoration:none;font-weight:600;font-size:16px;font-family:Arial,sans-serif;text-align:center;">${escapeHtml(props.text || 'Click Here')}</a>
  </div>`;
}

function renderDivider(props: Record<string, any>): string {
  return `<hr style="border:none;border-top:${props.thickness || 1}px ${props.style || 'solid'} ${props.color || '#e5e7eb'};width:${props.width || '100%'};margin:0 auto;" />`;
}

function renderSpacer(props: Record<string, any>): string {
  return `<div style="height:${props.height || 24}px;line-height:${props.height || 24}px;font-size:1px;">&nbsp;</div>`;
}

function renderAgentBio(props: Record<string, any>): string {
  const sections: string[] = [];
  if (props.showHeadshot !== false) sections.push('{{agent_headshot}}');
  if (props.showLogo !== false) sections.push('{{agent_logo}}');
  sections.push('<p style="margin:4px 0;font-weight:bold;font-size:16px;color:#1a1a1a;">{{agent_name}}</p>');
  if (props.showLicense !== false) sections.push('<p style="margin:2px 0;font-size:12px;color:#64748b;">License: {{agent_license}}</p>');
  if (props.showBrokerage !== false) sections.push('<p style="margin:2px 0;font-size:13px;color:#374151;">{{agent_brokerage}}</p>');
  if (props.showPhone !== false) sections.push('<p style="margin:2px 0;font-size:13px;color:#374151;">📱 {{agent_phone}}</p>');
  if (props.showOfficePhone !== false) sections.push('<p style="margin:2px 0;font-size:13px;color:#374151;">☎️ {{agent_office_phone}}</p>');
  if (props.showEmail !== false) sections.push('<p style="margin:2px 0;font-size:13px;color:#374151;">✉️ {{agent_email}}</p>');
  if (props.showOfficeAddress !== false) sections.push('<p style="margin:2px 0;font-size:12px;color:#64748b;">{{agent_office_address}}</p>');
  if (props.showWebsite !== false) sections.push('<p style="margin:2px 0;font-size:13px;"><a href="{{agent_website}}" style="color:#2563eb;">{{agent_website}}</a></p>');
  if (props.showEqualHousing !== false) {
    sections.push('<p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">Equal Housing Opportunity. Each office independently owned and operated.</p>');
  }
  return `<div style="background:#f8fafc;border-radius:8px;padding:20px;text-align:center;">${sections.join('\n    ')}</div>`;
}

function renderListings(props: Record<string, any>): string {
  const listings = props.listings || [];
  const style = props.style || 'grid';

  if (listings.length === 0) {
    return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center;">
      <p style="color:#6b7280;font-size:14px;margin:0;">No listings added</p>
    </div>`;
  }

  const isGrid = style === 'grid';
  let html = `<div style="padding:4px 0;">
    <h3 style="margin:0 0 16px;color:#1a1a1a;font-family:Georgia,serif;font-size:20px;font-weight:600;">Featured Listings</h3>`;

  if (isGrid) {
    html += `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`;
    listings.forEach((l: any, i: number) => {
      if (i > 0 && i % 2 === 0) html += `</tr><tr>`;
      html += `<td style="width:50%;vertical-align:top;padding:6px;">
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#ffffff;">
          ${l.image_url ? `<img src="${l.image_url}" alt="${escapeHtml(l.address)}" style="width:100%;height:140px;object-fit:cover;display:block;" />` : `<div style="height:140px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;text-align:center;color:#9ca3af;font-size:14px;">No Image</div>`}
          <div style="padding:12px;">
            <p style="margin:0;font-weight:700;font-size:16px;color:#1a1a1a;font-family:Georgia,serif;">${escapeHtml(l.price)}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#4b5563;">${escapeHtml(l.address)}</p>
            ${l.city ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(l.city)}</p>` : ''}
            <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">${l.beds} bed · ${l.baths} bath · ${escapeHtml(l.sqft)} sqft</p>
          </div>
        </div>
      </td>`;
    });
    if (listings.length % 2 !== 0) html += `<td style="width:50%;"></td>`;
    html += `</tr></table>`;
  } else {
    listings.forEach((l: any) => {
      html += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#ffffff;">
        <tr>
          ${l.image_url ? `<td style="width:120px;"><img src="${l.image_url}" alt="${escapeHtml(l.address)}" style="width:120px;height:90px;object-fit:cover;display:block;" /></td>` : `<td style="width:120px;background:#f3f4f6;text-align:center;font-size:13px;color:#9ca3af;vertical-align:middle;">No Image</td>`}
          <td style="padding:12px;vertical-align:top;">
            <p style="margin:0;font-weight:700;font-size:16px;color:#1a1a1a;font-family:Georgia,serif;">${escapeHtml(l.price)}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#4b5563;">${escapeHtml(l.address)}</p>
            ${l.city ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(l.city)}</p>` : ''}
            <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">${l.beds} bed · ${l.baths} bath · ${escapeHtml(l.sqft)} sqft</p>
          </td>
        </tr>
      </table>`;
    });
  }

  html += `</div>`;
  return html;
}

function renderSocialIcons(props: Record<string, any>): string {
  const align = props.align || 'center';
  const size = props.iconSize || 32;
  return `<div style="text-align:${align};padding:8px 0;">
    <p style="color:#64748b;font-size:14px;margin:0;">Social media icons (${size}px) auto-populated from profile.</p>
  </div>`;
}

function renderBlock(block: NewsletterBlock, globalStyles: GlobalStyles): string {
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
        col.forEach(child => { content += renderBlock(child, globalStyles); });
        content += `</td>`;
      });
      content += `</tr></table>`;
      break;
    }
    case 'html_raw':
      content = block.props.html || '';
      break;
    default: content = `<div style="color:#999;font-size:14px;padding:12px;">[${block.type} block]</div>`;
  }
  return `<div style="padding:8px 0;">${content}</div>`;
}

function replaceAgentPlaceholders(html: string, agent: AgentData): string {
  const replacements: Record<string, { value?: string; isImage?: boolean }> = {
    '{{agent_name}}': { value: agent.name },
    '{{agent_email}}': { value: agent.email },
    '{{agent_phone}}': { value: agent.phone },
    '{{agent_office_phone}}': { value: agent.office_phone },
    '{{agent_office_address}}': { value: agent.office_address },
    '{{agent_brokerage}}': { value: agent.brokerage },
    '{{agent_license}}': { value: agent.license },
    '{{agent_website}}': { value: agent.website },
  };

  // Replace headshot placeholder
  if (agent.headshot_url) {
    html = html.replace('{{agent_headshot}}', `<img src="${agent.headshot_url}" alt="Agent headshot" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:inline-block;margin-bottom:8px;" />`);
  } else {
    // Remove the entire line containing the placeholder
    html = html.replace(/[^\n]*\{\{agent_headshot\}\}[^\n]*/g, '');
  }

  // Replace logo placeholder
  if (agent.logo_url) {
    html = html.replace('{{agent_logo}}', `<img src="${agent.logo_url}" alt="Logo" style="max-width:160px;height:auto;display:inline-block;margin-bottom:8px;" />`);
  } else {
    html = html.replace(/[^\n]*\{\{agent_logo\}\}[^\n]*/g, '');
  }

  // Replace text placeholders
  for (const [placeholder, { value }] of Object.entries(replacements)) {
    if (value) {
      html = html.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), escapeHtml(value));
    } else {
      // Remove the entire <p> or <a> element containing this placeholder
      const escaped = placeholder.replace(/[{}]/g, '\\$&');
      html = html.replace(new RegExp(`<p[^>]*>[^<]*${escaped}[^<]*</p>`, 'g'), '');
      html = html.replace(new RegExp(`<a[^>]*>[^<]*${escaped}[^<]*</a>`, 'g'), '');
    }
  }

  // Fix website link href if we replaced the value
  if (agent.website) {
    html = html.replace(`href="${escapeHtml(agent.website)}"`, `href="${agent.website}"`);
  }

  return html;
}

export function renderBlocksToHtml(blocks: NewsletterBlock[], styles?: Partial<GlobalStyles>, agentData?: AgentData): string {
  const gs = { ...DEFAULT_GLOBAL_STYLES, ...styles };
  const inner = blocks.map(b => renderBlock(b, gs)).join('');

  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  @media only screen and (max-width: 600px) {
    .nl-col {
      display: block !important;
      width: 100% !important;
      padding-right: 0 !important;
      padding-bottom: 12px;
    }
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

  if (agentData) {
    html = replaceAgentPlaceholders(html, agentData);
  }

  return html;
}

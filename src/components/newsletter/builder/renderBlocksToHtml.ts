import { NewsletterBlock, GlobalStyles, DEFAULT_GLOBAL_STYLES } from './types';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHeading(props: Record<string, any>): string {
  const tag = `h${props.level || 2}`;
  const sizes: Record<number, string> = { 1: '32px', 2: '26px', 3: '22px', 4: '18px' };
  return `<${tag} style="margin:0;padding:0;text-align:${props.align || 'center'};color:${props.color || '#1a1a1a'};font-family:${props.fontFamily || 'Georgia, serif'};font-size:${sizes[props.level || 2]};line-height:1.3;">${escapeHtml(props.text || '')}</${tag}>`;
}

function renderText(props: Record<string, any>): string {
  return `<div style="text-align:${props.align || 'left'};color:${props.color || '#374151'};font-size:${props.fontSize || 16}px;line-height:1.6;">${props.html || ''}</div>`;
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

function renderMarketData(props: Record<string, any>): string {
  return `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;">
    <h3 style="margin:0 0 12px;color:#0369a1;font-family:Georgia,serif;font-size:20px;">${escapeHtml(props.headerText || 'Market Update')}</h3>
    <p style="color:#64748b;font-size:14px;margin:0;">Dynamic market data will appear here based on recipient ZIP code.</p>
  </div>`;
}

function renderAgentBio(props: Record<string, any>): string {
  return `<div style="background:#f8fafc;border-radius:8px;padding:20px;text-align:center;">
    <p style="color:#64748b;font-size:14px;margin:0;">Agent bio & branding auto-populated at send time.</p>
  </div>`;
}

function renderListings(props: Record<string, any>): string {
  const count = props.count || 3;
  const style = props.style || 'grid';
  return `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;">
    <h3 style="margin:0 0 12px;color:#166534;font-family:Georgia,serif;font-size:18px;">🏠 Featured Listings</h3>
    <p style="color:#64748b;font-size:14px;margin:0;">${count} listing${count !== 1 ? 's' : ''} in ${style} layout — populated from your pipeline at send time.</p>
  </div>`;
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
    case 'market_data': content = renderMarketData(block.props); break;
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
        content += `<td style="width:${colWidth}%;vertical-align:top;${i < cols.length - 1 ? `padding-right:${gap}px;` : ''}">`;
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

export function renderBlocksToHtml(blocks: NewsletterBlock[], styles?: Partial<GlobalStyles>): string {
  const gs = { ...DEFAULT_GLOBAL_STYLES, ...styles };
  const inner = blocks.map(b => renderBlock(b, gs)).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
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

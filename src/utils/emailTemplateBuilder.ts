// Utility functions for building beautiful email templates with agent branding

export interface EmailTemplateData {
  event_title: string
  event_date: string
  event_time: string
  event_description?: string
  event_location?: string
  agent_name: string
  agent_email?: string
  agent_phone?: string
  agent_office_number?: string
  agent_office_address?: string
  agent_website?: string
  agent_brokerage?: string
  agent_team_name?: string
  primary_color?: string
  secondary_color?: string
  logo_colored_url?: string
  logo_white_url?: string
  headshot_url?: string
}

export function buildEmailTemplate(
  templateHtml: string,
  data: EmailTemplateData
): string {
  let html = templateHtml

  // Replace all variables
  html = html.replace(/{event_title}/g, escapeHtml(data.event_title || 'Event'))
  html = html.replace(/{event_date}/g, escapeHtml(data.event_date || ''))
  html = html.replace(/{event_time}/g, escapeHtml(data.event_time || ''))
  html = html.replace(/{event_description}/g, escapeHtml(data.event_description || ''))
  html = html.replace(/{event_location}/g, escapeHtml(data.event_location || ''))
  html = html.replace(/{agent_name}/g, escapeHtml(data.agent_name || 'Event Organizer'))
  html = html.replace(/{agent_email}/g, escapeHtml(data.agent_email || ''))
  html = html.replace(/{agent_phone}/g, escapeHtml(data.agent_phone || ''))
  html = html.replace(/{agent_office_number}/g, escapeHtml(data.agent_office_number || ''))
  html = html.replace(/{agent_office_address}/g, escapeHtml(data.agent_office_address || ''))
  html = html.replace(/{agent_website}/g, escapeHtml(data.agent_website || ''))
  html = html.replace(/{agent_brokerage}/g, escapeHtml(data.agent_brokerage || ''))
  html = html.replace(/{agent_team_name}/g, escapeHtml(data.agent_team_name || ''))
  html = html.replace(/{primary_color}/g, data.primary_color || '#2563eb')
  html = html.replace(/{secondary_color}/g, data.secondary_color || '#1e40af')

  // Handle conditional blocks for optional fields
  html = html.replace(/\{#if headshot_url\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.headshot_url ? content : ''
  })
  html = html.replace(/\{#if logo_colored_url\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.logo_colored_url ? content : ''
  })
  html = html.replace(/\{#if logo_white_url\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.logo_white_url ? content : ''
  })
  html = html.replace(/\{#if event_location\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.event_location ? content : ''
  })
  html = html.replace(/\{#if event_description\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.event_description ? content : ''
  })
  html = html.replace(/\{#if agent_phone\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.agent_phone ? content : ''
  })
  html = html.replace(/\{#if agent_email\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.agent_email ? content : ''
  })
  html = html.replace(/\{#if agent_office_number\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.agent_office_number ? content : ''
  })
  html = html.replace(/\{#if agent_office_address\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.agent_office_address ? content : ''
  })
  html = html.replace(/\{#if agent_website\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.agent_website ? content : ''
  })
  html = html.replace(/\{#if agent_brokerage\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.agent_brokerage ? content : ''
  })
  html = html.replace(/\{#if agent_team_name\}([\s\S]*?)\{\/if\}/g, (match, content) => {
    return data.agent_team_name ? content : ''
  })

  return html
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

export function getDefaultEmailTemplate(emailType: string): string {
  const templates: Record<string, string> = {
    confirmation: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header with Logo and Headshot -->
          <tr>
            <td style="background: linear-gradient(135deg, {primary_color} 0%, {secondary_color} 100%); padding: 40px 30px; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    {#if headshot_url}
                    <img src="{headshot_url}" alt="{agent_name}" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid rgba(255,255,255,0.3); object-fit: cover; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                    {#if logo_colored_url}
                    <img src="{logo_colored_url}" alt="Logo" style="max-width: 200px; max-height: 60px; margin-top: 15px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: {primary_color}; margin: 0 0 20px 0; font-size: 28px; font-weight: 700;">RSVP Confirmed! 🎉</h1>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi there,</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                You're all set for <strong style="color: {primary_color};">{event_title}</strong>!
              </p>
              
              <!-- Event Details Card -->
              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid {primary_color};">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Event Details</p>
                    <p style="margin: 5px 0; color: #333333; font-size: 16px;"><strong>📅 Date:</strong> {event_date}</p>
                    <p style="margin: 5px 0; color: #333333; font-size: 16px;"><strong>🕐 Time:</strong> {event_time}</p>
                    {#if event_location}
                    <p style="margin: 5px 0; color: #333333; font-size: 16px;"><strong>📍 Location:</strong> {event_location}</p>
                    {/if}
                    {#if event_description}
                    <p style="margin: 15px 0 5px 0; color: #333333; font-size: 16px; line-height: 1.6;">{event_description}</p>
                    {/if}
                  </td>
                </tr>
              </table>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                Hosted by <strong>{agent_name}</strong>
                {#if agent_team_name}
                <br><span style="color: #666666; font-size: 14px;">{agent_team_name}</span>
                {/if}
                {#if agent_brokerage}
                <br><span style="color: #666666; font-size: 14px;">{agent_brokerage}</span>
                {/if}
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                We're excited to see you there! If you have any questions or need to make changes to your RSVP, just reply to this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; font-weight: 600;">Contact Information</p>
                    {#if agent_phone}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">📞 {agent_phone}</p>
                    {/if}
                    {#if agent_office_number}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">🏢 Office: {agent_office_number}</p>
                    {/if}
                    {#if agent_email}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">✉️ <a href="mailto:{agent_email}" style="color: {primary_color}; text-decoration: none;">{agent_email}</a></p>
                    {/if}
                    {#if agent_office_address}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">📍 {agent_office_address}</p>
                    {/if}
                    {#if agent_website}
                    <p style="margin: 15px 0 5px 0;"><a href="{agent_website}" style="color: {primary_color}; text-decoration: none; font-size: 14px;">Visit Website</a></p>
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    reminder_7day: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, {primary_color} 0%, {secondary_color} 100%); padding: 40px 30px; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    {#if headshot_url}
                    <img src="{headshot_url}" alt="{agent_name}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); object-fit: cover; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                    {#if logo_colored_url}
                    <img src="{logo_colored_url}" alt="Logo" style="max-width: 180px; max-height: 50px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: {primary_color}; margin: 0 0 20px 0; font-size: 28px; font-weight: 700;">Event Reminder 📅</h1>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi there,</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                This is a friendly reminder that <strong style="color: {primary_color};">{event_title}</strong> is coming up in <strong style="color: {primary_color};">7 days</strong>!
              </p>
              
              <!-- Event Details -->
              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid {primary_color};">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Event Details</p>
                    <p style="margin: 5px 0; color: #333333; font-size: 16px;"><strong>📅 Date:</strong> {event_date}</p>
                    <p style="margin: 5px 0; color: #333333; font-size: 16px;"><strong>🕐 Time:</strong> {event_time}</p>
                    {#if event_location}
                    <p style="margin: 5px 0; color: #333333; font-size: 16px;"><strong>📍 Location:</strong> {event_location}</p>
                    {/if}
                    {#if event_description}
                    <p style="margin: 15px 0 5px 0; color: #333333; font-size: 16px; line-height: 1.6;">{event_description}</p>
                    {/if}
                  </td>
                </tr>
              </table>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                Hosted by <strong>{agent_name}</strong>
                {#if agent_team_name}
                <br><span style="color: #666666; font-size: 14px;">{agent_team_name}</span>
                {/if}
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                We're looking forward to seeing you there! If you have any questions, feel free to reply to this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; font-weight: 600;">Contact Information</p>
                    {#if agent_phone}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">📞 {agent_phone}</p>
                    {/if}
                    {#if agent_email}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">✉️ <a href="mailto:{agent_email}" style="color: {primary_color}; text-decoration: none;">{agent_email}</a></p>
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    reminder_1day: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, {primary_color} 0%, {secondary_color} 100%); padding: 40px 30px; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    {#if headshot_url}
                    <img src="{headshot_url}" alt="{agent_name}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); object-fit: cover; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                    {#if logo_colored_url}
                    <img src="{logo_colored_url}" alt="Logo" style="max-width: 180px; max-height: 50px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: {primary_color}; margin: 0 0 20px 0; font-size: 28px; font-weight: 700;">Event Tomorrow! ⏰</h1>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi there,</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Just a quick reminder that <strong style="color: {primary_color};">{event_title}</strong> is <strong style="color: {primary_color};">tomorrow</strong>!
              </p>
              
              <!-- Event Details -->
              <table role="presentation" style="width: 100%; background-color: #fff3cd; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid {primary_color};">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; color: #856404; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📅 Event Details</p>
                    <p style="margin: 5px 0; color: #333333; font-size: 16px;"><strong>Date:</strong> {event_date}</p>
                    <p style="margin: 5px 0; color: #333333; font-size: 16px;"><strong>Time:</strong> {event_time}</p>
                    {#if event_location}
                    <p style="margin: 5px 0; color: #333333; font-size: 16px;"><strong>📍 Location:</strong> {event_location}</p>
                    {/if}
                    {#if event_description}
                    <p style="margin: 15px 0 5px 0; color: #333333; font-size: 16px; line-height: 1.6;">{event_description}</p>
                    {/if}
                  </td>
                </tr>
              </table>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                Hosted by <strong>{agent_name}</strong>
                {#if agent_team_name}
                <br><span style="color: #666666; font-size: 14px;">{agent_team_name}</span>
                {/if}
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                We're looking forward to seeing you tomorrow! If you have any questions, feel free to reply to this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; font-weight: 600;">Contact Information</p>
                    {#if agent_phone}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">📞 {agent_phone}</p>
                    {/if}
                    {#if agent_email}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">✉️ <a href="mailto:{agent_email}" style="color: {primary_color}; text-decoration: none;">{agent_email}</a></p>
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    thank_you: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, {primary_color} 0%, {secondary_color} 100%); padding: 40px 30px; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    {#if headshot_url}
                    <img src="{headshot_url}" alt="{agent_name}" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid rgba(255,255,255,0.3); object-fit: cover; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                    {#if logo_colored_url}
                    <img src="{logo_colored_url}" alt="Logo" style="max-width: 200px; max-height: 60px; margin-top: 15px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: {primary_color}; margin: 0 0 20px 0; font-size: 28px; font-weight: 700;">Thank You! 🙏</h1>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi there,</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for attending <strong style="color: {primary_color};">{event_title}</strong>! We hope you had a wonderful time.
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                Hosted by <strong>{agent_name}</strong>
                {#if agent_team_name}
                <br><span style="color: #666666; font-size: 14px;">{agent_team_name}</span>
                {/if}
                {#if agent_brokerage}
                <br><span style="color: #666666; font-size: 14px;">{agent_brokerage}</span>
                {/if}
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                We'd love to hear your feedback and see you at future events. If you have any questions or need anything, don't hesitate to reach out!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; font-weight: 600;">Contact Information</p>
                    {#if agent_phone}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">📞 {agent_phone}</p>
                    {/if}
                    {#if agent_email}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">✉️ <a href="mailto:{agent_email}" style="color: {primary_color}; text-decoration: none;">{agent_email}</a></p>
                    {/if}
                    {#if agent_website}
                    <p style="margin: 15px 0 5px 0;"><a href="{agent_website}" style="color: {primary_color}; text-decoration: none; font-size: 14px;">Visit Website</a></p>
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    no_show: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, {primary_color} 0%, {secondary_color} 100%); padding: 40px 30px; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    {#if headshot_url}
                    <img src="{headshot_url}" alt="{agent_name}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); object-fit: cover; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                    {#if logo_colored_url}
                    <img src="{logo_colored_url}" alt="Logo" style="max-width: 180px; max-height: 50px; display: block; margin-left: auto; margin-right: auto;">
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: {primary_color}; margin: 0 0 20px 0; font-size: 28px; font-weight: 700;">We Missed You! 😔</h1>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi there,</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                We noticed you weren't able to make it to <strong style="color: {primary_color};">{event_title}</strong>. We hope everything is okay!
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                Hosted by <strong>{agent_name}</strong>
                {#if agent_team_name}
                <br><span style="color: #666666; font-size: 14px;">{agent_team_name}</span>
                {/if}
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                We'd love to have you at our next event. Let us know if you'd like details about upcoming events, or if there's anything we can help you with.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; font-weight: 600;">Contact Information</p>
                    {#if agent_phone}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">📞 {agent_phone}</p>
                    {/if}
                    {#if agent_email}
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">✉️ <a href="mailto:{agent_email}" style="color: {primary_color}; text-decoration: none;">{agent_email}</a></p>
                    {/if}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }

  return templates[emailType] || templates.confirmation
}

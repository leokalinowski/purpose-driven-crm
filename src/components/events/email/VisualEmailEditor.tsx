import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { VariableInsertBar } from './VariableInsertBar'
import { Plus, Trash2, Code, Palette, GripVertical } from 'lucide-react'

export interface VisualEditorData {
  heading: string
  paragraphs: string[]
  showHeadshot: boolean
  showLogo: boolean
  showAgentName: boolean
  showTeamName: boolean
  showBrokerage: boolean
  showPhone: boolean
  showEmail: boolean
  showOfficeNumber: boolean
  showOfficeAddress: boolean
  showWebsite: boolean
  showEventDetails: boolean
  primaryColor: string
  secondaryColor: string
}

const DEFAULT_HEADINGS: Record<string, string> = {
  confirmation: 'RSVP Confirmed! 🎉',
  invitation: "You're Invited! ✉️",
  reminder_7day: 'Event Reminder 📅',
  reminder_1day: 'Event Tomorrow! ⏰',
  thank_you: 'Thank You for Attending! 🙏',
  no_show: 'We Missed You! 💌',
}

const DEFAULT_PARAGRAPHS: Record<string, string[]> = {
  confirmation: [
    'Hi there,',
    "You're all set for {event_title}!",
    "We're excited to see you there! If you have any questions or need to make changes to your RSVP, just reply to this email.",
  ],
  invitation: [
    'Hi there,',
    '{agent_name} would love for you to join us for {event_title}!',
    'Click the link below to RSVP and reserve your spot.',
  ],
  reminder_7day: [
    'Hi there,',
    'This is a friendly reminder that {event_title} is coming up in 7 days!',
    "We're looking forward to seeing you there! If you have any questions, feel free to reply to this email.",
  ],
  reminder_1day: [
    'Hi there,',
    'Just a quick reminder that {event_title} is tomorrow!',
    "We can't wait to see you! If you need directions or have any last-minute questions, just reply to this email.",
  ],
  thank_you: [
    'Hi there,',
    'Thank you for attending {event_title}! We hope you had a wonderful time.',
    "Your presence made the event truly special. If you have any feedback or questions, don't hesitate to reach out.",
  ],
  no_show: [
    'Hi there,',
    "We missed you at {event_title}! We're sorry you couldn't make it.",
    "We'd love to see you at our next event. Stay tuned for upcoming opportunities!",
  ],
}

interface VisualEmailEditorProps {
  emailType: string
  htmlContent: string
  onHtmlChange: (html: string) => void
}

export const VisualEmailEditor: React.FC<VisualEmailEditorProps> = ({
  emailType,
  htmlContent,
  onHtmlChange,
}) => {
  const [mode, setMode] = useState<'visual' | 'html'>('visual')
  const [data, setData] = useState<VisualEditorData>(() => {
    if (htmlContent && htmlContent.trim().length > 0) {
      const defaults = getDefaultData(emailType)
      const parsed = parseHtmlToData(htmlContent)
      return { ...defaults, ...parsed }
    }
    return getDefaultData(emailType)
  })
  const [initializedType, setInitializedType] = useState(emailType)
  const isInitialMount = useRef(true)
  const paragraphRefs = useRef<(HTMLTextAreaElement | null)[]>([])
  const htmlRef = useRef<HTMLTextAreaElement>(null)

  // Reset when emailType changes
  useEffect(() => {
    if (emailType !== initializedType) {
      if (htmlContent && htmlContent.trim().length > 0) {
        const defaults = getDefaultData(emailType)
        const parsed = parseHtmlToData(htmlContent)
        setData({ ...defaults, ...parsed })
      } else {
        setData(getDefaultData(emailType))
      }
      setInitializedType(emailType)
      isInitialMount.current = true
    }
  }, [emailType, initializedType, htmlContent])

  // Generate HTML whenever data changes in visual mode — skip initial mount
  useEffect(() => {
    if (mode === 'visual') {
      if (isInitialMount.current) {
        isInitialMount.current = false
        return
      }
      onHtmlChange(dataToHtml(data))
    }
  }, [data, mode])

  const updateField = useCallback(<K extends keyof VisualEditorData>(key: K, value: VisualEditorData[K]) => {
    setData(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateParagraph = useCallback((index: number, value: string) => {
    setData(prev => {
      const paragraphs = [...prev.paragraphs]
      paragraphs[index] = value
      return { ...prev, paragraphs }
    })
  }, [])

  const addParagraph = useCallback(() => {
    setData(prev => ({ ...prev, paragraphs: [...prev.paragraphs, ''] }))
  }, [])

  const removeParagraph = useCallback((index: number) => {
    setData(prev => ({
      ...prev,
      paragraphs: prev.paragraphs.filter((_, i) => i !== index),
    }))
  }, [])

  if (mode === 'html') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Editing raw HTML</p>
          <Button variant="outline" size="sm" onClick={() => setMode('visual')}>
            <Palette className="h-4 w-4 mr-1" /> Visual Mode
          </Button>
        </div>
        <VariableInsertBar
          textareaRef={htmlRef as React.RefObject<HTMLTextAreaElement>}
          onInsert={(v) => {
            const el = htmlRef.current
            if (el) {
              const start = el.selectionStart ?? el.value.length
              const newVal = el.value.slice(0, start) + v + el.value.slice(el.selectionEnd ?? start)
              onHtmlChange(newVal)
            }
          }}
        />
        <Textarea
          ref={htmlRef}
          value={htmlContent}
          onChange={(e) => onHtmlChange(e.target.value)}
          rows={20}
          className="font-mono text-sm"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Visual block editor — HTML is generated automatically</p>
        <Button variant="outline" size="sm" onClick={() => setMode('html')}>
          <Code className="h-4 w-4 mr-1" /> HTML Mode
        </Button>
      </div>

      {/* Header toggles */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-sm">Header</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={data.showHeadshot} onCheckedChange={(v) => updateField('showHeadshot', v)} id="show-headshot" />
            <Label htmlFor="show-headshot" className="text-sm">Headshot</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={data.showLogo} onCheckedChange={(v) => updateField('showLogo', v)} id="show-logo" />
            <Label htmlFor="show-logo" className="text-sm">Logo</Label>
          </div>
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Heading</Label>
        <Input
          value={data.heading}
          onChange={(e) => updateField('heading', e.target.value)}
          placeholder="e.g. RSVP Confirmed! 🎉"
        />
      </div>

      {/* Body Paragraphs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Body Paragraphs</Label>
          <Button variant="outline" size="sm" onClick={addParagraph}>
            <Plus className="h-4 w-4 mr-1" /> Add Paragraph
          </Button>
        </div>
        {data.paragraphs.map((p, i) => (
          <div key={i} className="space-y-1">
            <VariableInsertBar
              textareaRef={{ current: paragraphRefs.current[i] } as React.RefObject<HTMLTextAreaElement>}
              onInsert={(v) => updateParagraph(i, (paragraphRefs.current[i]?.value ?? '') + v)}
            />
            <div className="flex gap-2">
              <Textarea
                ref={(el) => { paragraphRefs.current[i] = el }}
                value={p}
                onChange={(e) => updateParagraph(i, e.target.value)}
                rows={2}
                placeholder="Write a paragraph..."
                className="flex-1"
              />
              {data.paragraphs.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeParagraph(i)} className="shrink-0 mt-1">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Event Details Card toggle */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-sm">Event Details Card</h3>
        <div className="flex items-center gap-2">
          <Switch checked={data.showEventDetails} onCheckedChange={(v) => updateField('showEventDetails', v)} id="show-event-details" />
          <Label htmlFor="show-event-details" className="text-sm">Show Event Details</Label>
          <span className="text-xs text-muted-foreground ml-2">Include date, time, location, and description card</span>
        </div>
      </div>

      {/* Host Info */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-sm">Host Info</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={data.showAgentName} onCheckedChange={(v) => updateField('showAgentName', v)} id="show-agent" />
            <Label htmlFor="show-agent" className="text-sm">Agent Name</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={data.showTeamName} onCheckedChange={(v) => updateField('showTeamName', v)} id="show-team" />
            <Label htmlFor="show-team" className="text-sm">Team Name</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={data.showBrokerage} onCheckedChange={(v) => updateField('showBrokerage', v)} id="show-brokerage" />
            <Label htmlFor="show-brokerage" className="text-sm">Brokerage</Label>
          </div>
        </div>
      </div>

      {/* Footer / Contact */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-sm">Footer — Contact Info</h3>
        <div className="flex flex-wrap gap-6">
          {[
            { key: 'showPhone' as const, label: 'Phone' },
            { key: 'showEmail' as const, label: 'Email' },
            { key: 'showOfficeNumber' as const, label: 'Office #' },
            { key: 'showOfficeAddress' as const, label: 'Office Address' },
            { key: 'showWebsite' as const, label: 'Website' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Switch checked={data[key]} onCheckedChange={(v) => updateField(key, v)} id={key} />
              <Label htmlFor={key} className="text-sm">{label}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-sm">Colors</h3>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Primary</Label>
            <input type="color" value={data.primaryColor} onChange={(e) => updateField('primaryColor', e.target.value)} className="h-8 w-10 rounded border cursor-pointer" />
            <span className="text-xs text-muted-foreground font-mono">{data.primaryColor}</span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Secondary</Label>
            <input type="color" value={data.secondaryColor} onChange={(e) => updateField('secondaryColor', e.target.value)} className="h-8 w-10 rounded border cursor-pointer" />
            <span className="text-xs text-muted-foreground font-mono">{data.secondaryColor}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function parseHtmlToData(html: string): Partial<VisualEditorData> {
  const result: Partial<VisualEditorData> = {}

  result.showEventDetails = html.includes('Event Details') && html.includes('{event_date}')
  result.showHeadshot = html.includes('{headshot_url}')
  result.showLogo = html.includes('{logo_colored_url}')
  result.showAgentName = html.includes('{agent_name}') && html.includes('Hosted by')
  result.showTeamName = html.includes('{agent_team_name}')
  result.showBrokerage = html.includes('{agent_brokerage}')
  result.showPhone = html.includes('{agent_phone}')
  result.showEmail = html.includes('{agent_email}')
  result.showOfficeNumber = html.includes('{agent_office_number}')
  result.showOfficeAddress = html.includes('{agent_office_address}')
  result.showWebsite = html.includes('{agent_website}')

  // Extract heading from <h1> tag
  const headingMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s)
  if (headingMatch) {
    result.heading = headingMatch[1].replace(/<[^>]*>/g, '').trim()
  }

  // Extract body paragraphs from main content area
  // These are <p> tags after the <h1> and before Event Details card, Host Info, or Footer
  const mainContentMatch = html.match(/<\/h1>([\s\S]*?)(?:<!-- Event Details|Hosted by|<\/td>\s*<\/tr>\s*<!-- Footer)/i)
  if (mainContentMatch) {
    const paragraphs = [...mainContentMatch[1].matchAll(/<p[^>]*>(.*?)<\/p>/gs)]
      .map(m => m[1].replace(/<[^>]*>/g, '').trim())
      .filter(p => p.length > 0)
    if (paragraphs.length > 0) {
      result.paragraphs = paragraphs
    }
  }

  // Extract colors from inline styles
  const gradientMatch = html.match(/linear-gradient\(135deg,\s*(#[0-9a-fA-F]{6})/)
  if (gradientMatch) result.primaryColor = gradientMatch[1]
  const secondaryMatch = html.match(/linear-gradient\(135deg,\s*#[0-9a-fA-F]{6}\s+0%,\s*(#[0-9a-fA-F]{6})/)
  if (secondaryMatch) result.secondaryColor = secondaryMatch[1]

  return result
}

function getDefaultData(emailType: string): VisualEditorData {
  return {
    heading: DEFAULT_HEADINGS[emailType] || 'Your Event',
    paragraphs: DEFAULT_PARAGRAPHS[emailType] || ['Hi there,', 'Thank you for your interest in {event_title}.'],
    showHeadshot: true,
    showLogo: true,
    showAgentName: true,
    showTeamName: true,
    showBrokerage: true,
    showPhone: true,
    showEmail: true,
    showOfficeNumber: true,
    showOfficeAddress: true,
    showWebsite: true,
    showEventDetails: emailType !== 'thank_you' && emailType !== 'no_show',
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
  }
}

function dataToHtml(data: VisualEditorData): string {
  const pc = data.primaryColor
  const sc = data.secondaryColor

  const headerImages = [
    data.showHeadshot ? `{#if headshot_url}<img src="{headshot_url}" alt="{agent_name}" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid rgba(255,255,255,0.3); object-fit: cover; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">{/if}` : '',
    data.showLogo ? `{#if logo_colored_url}<img src="{logo_colored_url}" alt="Logo" style="max-width: 200px; max-height: 60px; margin-top: 15px; display: block; margin-left: auto; margin-right: auto;">{/if}` : '',
  ].filter(Boolean).join('\n                    ')

  const paragraphsHtml = data.paragraphs
    .map((p) => `<p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">${p}</p>`)
    .join('\n              ')

  const hostParts = [
    data.showAgentName ? `Hosted by <strong>{agent_name}</strong>` : '',
    data.showTeamName ? `{#if agent_team_name}<br><span style="color: #666666; font-size: 14px;">{agent_team_name}</span>{/if}` : '',
    data.showBrokerage ? `{#if agent_brokerage}<br><span style="color: #666666; font-size: 14px;">{agent_brokerage}</span>{/if}` : '',
  ].filter(Boolean)

  const hostHtml = hostParts.length > 0
    ? `<p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">\n                ${hostParts.join('\n                ')}\n              </p>`
    : ''

  const footerLines = [
    data.showPhone ? `{#if agent_phone}<p style="margin: 5px 0; color: #333333; font-size: 14px;">📞 {agent_phone}</p>{/if}` : '',
    data.showOfficeNumber ? `{#if agent_office_number}<p style="margin: 5px 0; color: #333333; font-size: 14px;">🏢 Office: {agent_office_number}</p>{/if}` : '',
    data.showEmail ? `{#if agent_email}<p style="margin: 5px 0; color: #333333; font-size: 14px;">✉️ <a href="mailto:{agent_email}" style="color: ${pc}; text-decoration: none;">{agent_email}</a></p>{/if}` : '',
    data.showOfficeAddress ? `{#if agent_office_address}<p style="margin: 5px 0; color: #333333; font-size: 14px;">📍 {agent_office_address}</p>{/if}` : '',
    data.showWebsite ? `{#if agent_website}<p style="margin: 15px 0 5px 0;"><a href="{agent_website}" style="color: ${pc}; text-decoration: none; font-size: 14px;">Visit Website</a></p>{/if}` : '',
  ].filter(Boolean).join('\n                    ')

  return `<!DOCTYPE html>
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
            <td style="background: linear-gradient(135deg, ${pc} 0%, ${sc} 100%); padding: 40px 30px; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    ${headerImages}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="color: ${pc}; margin: 0 0 20px 0; font-size: 28px; font-weight: 700;">${data.heading}</h1>
              
              ${paragraphsHtml}
              
              ${data.showEventDetails ? `<!-- Event Details Card -->
              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid ${pc};">
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
              </table>` : ''}
              
              ${hostHtml}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; font-weight: 600;">Contact Information</p>
                    ${footerLines}
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

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useEmailTemplates, EmailTemplate } from '@/hooks/useEmailTemplates'
import { Loader2, Save, Eye } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getDefaultEmailTemplate } from '@/utils/emailTemplateBuilder'
import { useGlobalEmailTemplates } from '@/hooks/useGlobalEmailTemplates'
import { VisualEmailEditor } from './VisualEmailEditor'

export interface EventPreviewData {
  title?: string
  event_date?: string
  location?: string
  description?: string
  agent_name?: string
  agent_email?: string
  agent_phone?: string
  agent_office_number?: string
  agent_office_address?: string
  agent_website?: string
  agent_brokerage?: string
  agent_team_name?: string
  primary_color?: string
  secondary_color?: string
  headshot_url?: string
  logo_colored_url?: string
  logo_white_url?: string
}

interface EmailTemplateEditorProps {
  eventId: string
  emailType: 'confirmation' | 'reminder_7day' | 'reminder_1day' | 'thank_you' | 'no_show'
  onSave?: () => void
  eventData?: EventPreviewData
}

const EMAIL_TYPE_LABELS = {
  confirmation: 'RSVP Confirmation',
  reminder_7day: '7-Day Reminder',
  reminder_1day: '1-Day Reminder',
  thank_you: 'Thank You (Post-Event)',
  no_show: 'No-Show Follow-up'
}

export const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  eventId,
  emailType,
  onSave,
  eventData
}) => {
  const { templates, createTemplate, updateTemplate, getTemplateByType } = useEmailTemplates(eventId)
  const { getTemplateByType: getGlobalTemplate } = useGlobalEmailTemplates()
  const { toast } = useToast()

  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [textContent, setTextContent] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const existingTemplate = getTemplateByType(emailType)
  const globalTemplate = getGlobalTemplate(emailType)

  useEffect(() => {
    if (existingTemplate) {
      // Use event-specific template
      setSubject(existingTemplate.subject)
      setHtmlContent(existingTemplate.html_content)
      setTextContent(existingTemplate.text_content || '')
      setIsActive(existingTemplate.is_active)
    } else if (globalTemplate) {
      // Use global template as default
      setSubject(globalTemplate.subject)
      setHtmlContent(globalTemplate.html_content)
      setTextContent(globalTemplate.text_content || '')
      setIsActive(true)
    } else {
      // Use built-in default template
      const defaultTemplate = getDefaultEmailTemplate(emailType)
      setSubject(`You're confirmed for {event_title}`)
      setHtmlContent(defaultTemplate)
      setTextContent('')
      setIsActive(true)
    }
  }, [existingTemplate, globalTemplate, emailType])

  const handleSave = async () => {
    if (!subject.trim() || !htmlContent.trim()) {
      toast({
        title: "Missing content",
        description: "Please fill in both subject and HTML content.",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const templateData = {
        event_id: eventId,
        email_type: emailType,
        subject: subject.trim(),
        html_content: htmlContent.trim(),
        text_content: textContent.trim() || undefined,
        is_active: isActive
      }

      if (existingTemplate) {
        await updateTemplate(existingTemplate.id, templateData)
        toast({
          title: "Template updated",
          description: `${EMAIL_TYPE_LABELS[emailType]} template has been updated.`
        })
      } else {
        await createTemplate(templateData)
        toast({
          title: "Template created",
          description: `${EMAIL_TYPE_LABELS[emailType]} template has been created.`
        })
      }

      onSave?.()
    } catch (error) {
      console.error('Error saving template:', error)
      toast({
        title: "Error saving template",
        description: "There was an error saving the email template.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const renderPreview = () => {
    const d = eventData
    const eventDate = d?.event_date ? new Date(d.event_date) : null
    const formattedDate = eventDate ? eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Saturday, March 15, 2025'
    const formattedTime = eventDate ? eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '6:00 PM'

    let previewContent = htmlContent
      .replace(/{event_title}/g, d?.title || 'Sample Event Title')
      .replace(/{event_date}/g, formattedDate)
      .replace(/{event_time}/g, formattedTime)
      .replace(/{event_description}/g, d?.description || 'Join us for an exciting event with great networking opportunities.')
      .replace(/{event_location}/g, d?.location || '123 Main Street, Suite 100')
      .replace(/{agent_name}/g, d?.agent_name || 'Jane Smith')
      .replace(/{agent_email}/g, d?.agent_email || 'agent@example.com')
      .replace(/{agent_phone}/g, d?.agent_phone || '(555) 123-4567')
      .replace(/{agent_office_number}/g, d?.agent_office_number || '(555) 987-6543')
      .replace(/{agent_office_address}/g, d?.agent_office_address || '123 Main St, City, State 12345')
      .replace(/{agent_website}/g, d?.agent_website || 'https://example.com')
      .replace(/{agent_brokerage}/g, d?.agent_brokerage || 'Premier Realty')
      .replace(/{agent_team_name}/g, d?.agent_team_name || 'The Smith Team')
      .replace(/{primary_color}/g, d?.primary_color || '#2563eb')
      .replace(/{secondary_color}/g, d?.secondary_color || '#1e40af')
      .replace(/{headshot_url}/g, d?.headshot_url || 'https://via.placeholder.com/100')
      .replace(/{logo_colored_url}/g, d?.logo_colored_url || 'https://via.placeholder.com/200x60')
      .replace(/{logo_white_url}/g, d?.logo_white_url || 'https://via.placeholder.com/200x60/ffffff/000000')

    // Handle conditional blocks - show all for preview
    previewContent = previewContent.replace(/\{#if ([^}]+)\}([\s\S]*?)\{\/if\}/g, '$2')

    return (
      <div className="border rounded p-4 bg-white max-h-[600px] overflow-auto">
        <iframe
          srcDoc={previewContent}
          className="w-full border-0"
          style={{ minHeight: '500px' }}
          title="Email Preview"
        />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Event-Specific Template - {EMAIL_TYPE_LABELS[emailType]}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewMode ? 'Edit' : 'Preview'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewMode ? (
          <div className="space-y-4">
            <div>
              <Label>Subject Preview</Label>
              <div className="p-2 bg-gray-50 rounded border text-sm font-medium">
                {subject.replace(/{event_title}/g, eventData?.title || 'Sample Event Title')}
              </div>
            </div>
            <div>
              <Label>Email Preview</Label>
              {renderPreview()}
            </div>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Available variables: {'{event_title}'}, {'{event_date}'}, {'{event_time}'}, {'{event_description}'}, {'{event_location}'}, {'{agent_name}'}
              </p>
            </div>

            <div>
              <Label>Email Content</Label>
              <VisualEmailEditor
                emailType={emailType}
                htmlContent={htmlContent}
                onHtmlChange={setHtmlContent}
              />
            </div>

            <div>
              <Label htmlFor="text-content">Plain Text Content (Optional)</Label>
              <Textarea
                id="text-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
                placeholder="Enter plain text version..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}


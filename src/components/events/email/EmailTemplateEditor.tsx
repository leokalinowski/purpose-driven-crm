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

interface EmailTemplateEditorProps {
  eventId: string
  emailType: 'confirmation' | 'reminder_7day' | 'reminder_1day' | 'thank_you' | 'no_show'
  onSave?: () => void
}

const EMAIL_TYPE_LABELS = {
  confirmation: 'RSVP Confirmation',
  reminder_7day: '7-Day Reminder',
  reminder_1day: '1-Day Reminder',
  thank_you: 'Thank You (Post-Event)',
  no_show: 'No-Show Follow-up'
}

const DEFAULT_TEMPLATES = {
  confirmation: {
    subject: 'You\'re confirmed for {event_title}',
    html_content: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">RSVP Confirmed!</h1>
  <p>Hi there,</p>
  <p>You\'re all set for <strong>{event_title}</strong> on {event_date}.</p>
  <p>Hosted by {agent_name}</p>
  <p>We\'re excited to see you there!</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px;">
    Reply to this email if you need to make any changes to your RSVP.
  </p>
</body>
</html>`,
    text_content: `RSVP Confirmed!

Hi there,

You're all set for {event_title} on {event_date}.

Hosted by {agent_name}

We're excited to see you there!

---
Reply to this email if you need to make any changes to your RSVP.`
  }
}

export const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  eventId,
  emailType,
  onSave
}) => {
  const { templates, createTemplate, updateTemplate, getTemplateByType } = useEmailTemplates(eventId)
  const { toast } = useToast()

  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [textContent, setTextContent] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const existingTemplate = getTemplateByType(emailType)

  useEffect(() => {
    if (existingTemplate) {
      setSubject(existingTemplate.subject)
      setHtmlContent(existingTemplate.html_content)
      setTextContent(existingTemplate.text_content || '')
      setIsActive(existingTemplate.is_active)
    } else {
      // Load default template
      const defaultTemplate = DEFAULT_TEMPLATES[emailType] || DEFAULT_TEMPLATES.confirmation
      setSubject(defaultTemplate.subject)
      setHtmlContent(defaultTemplate.html_content)
      setTextContent(defaultTemplate.text_content)
      setIsActive(true)
    }
  }, [existingTemplate, emailType])

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
    const previewContent = htmlContent
      .replace(/{event_title}/g, '[Event Title]')
      .replace(/{event_date}/g, '[Event Date]')
      .replace(/{agent_name}/g, '[Agent Name]')

    return (
      <div
        className="border rounded p-4 bg-white"
        dangerouslySetInnerHTML={{ __html: previewContent }}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {EMAIL_TYPE_LABELS[emailType]} Template
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
                {subject.replace(/{event_title}/g, '[Event Title]')}
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
                Use {'{event_title}'} for dynamic event title
              </p>
            </div>

            <div>
              <Label htmlFor="html-content">HTML Content</Label>
              <Textarea
                id="html-content"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={12}
                placeholder="Enter HTML email content..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Available variables: {'{event_title}'}, {'{event_date}'}, {'{agent_name}'}
              </p>
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

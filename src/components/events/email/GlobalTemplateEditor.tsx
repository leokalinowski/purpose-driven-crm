import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useGlobalEmailTemplates, GlobalEmailTemplate } from '@/hooks/useGlobalEmailTemplates'
import { Loader2, Save, Eye, Globe } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getDefaultEmailTemplate } from '@/utils/emailTemplateBuilder'
import { VisualEmailEditor } from './VisualEmailEditor'

interface GlobalTemplateEditorProps {
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

export const GlobalTemplateEditor: React.FC<GlobalTemplateEditorProps> = ({
  emailType,
  onSave
}) => {
  const { templates, createTemplate, updateTemplate, getTemplateByType } = useGlobalEmailTemplates()
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
      const defaultTemplate = getDefaultEmailTemplate(emailType)
      setSubject(defaultTemplate.match(/<title>(.*?)<\/title>/)?.[1] || `You're confirmed for {event_title}`)
      setHtmlContent(defaultTemplate)
      setTextContent('')
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
        email_type: emailType,
        subject: subject.trim(),
        html_content: htmlContent.trim(),
        text_content: textContent.trim() || undefined,
        is_active: isActive
      }

      if (existingTemplate) {
        await updateTemplate(existingTemplate.id, templateData)
        toast({
          title: "Global template updated",
          description: `${EMAIL_TYPE_LABELS[emailType]} global template has been updated.`
        })
      } else {
        await createTemplate(templateData)
        toast({
          title: "Global template created",
          description: `${EMAIL_TYPE_LABELS[emailType]} global template has been created.`
        })
      }

      onSave?.()
    } catch (error) {
      console.error('Error saving global template:', error)
      toast({
        title: "Error saving template",
        description: "There was an error saving the global email template.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const renderPreview = () => {
    const previewContent = htmlContent
      .replace(/{event_title}/g, 'Annual Client Appreciation Night')
      .replace(/{event_date}/g, 'Saturday, April 12, 2025')
      .replace(/{event_time}/g, '6:00 PM')
      .replace(/{event_description}/g, 'Join us for an evening of great food, drinks, and networking with fellow homeowners and industry professionals.')
      .replace(/{event_location}/g, '500 Park Avenue, Suite 200, Austin, TX')
      .replace(/{agent_name}/g, 'Jane Smith')
      .replace(/{primary_color}/g, '#2563eb')
      .replace(/{secondary_color}/g, '#1e40af')

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
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <span>Global Template - {EMAIL_TYPE_LABELS[emailType]}</span>
          </div>
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Global Templates</strong> are used as defaults for all events. Individual events can override these with their own custom templates.
          </p>
        </div>

        {previewMode ? (
          <div className="space-y-4">
            <div>
              <Label>Subject Preview</Label>
              <div className="p-2 bg-gray-50 rounded border text-sm font-medium">
                {subject.replace(/{event_title}/g, 'Annual Client Appreciation Night')}
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
                Available variables: {'{event_title}'}, {'{event_date}'}, {'{event_time}'}, {'{agent_name}'}
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
                rows={10}
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
                Save Global Template
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}


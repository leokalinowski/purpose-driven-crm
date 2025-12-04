import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmailTemplateEditor } from './EmailTemplateEditor'
import { EmailMetricsDashboard } from './EmailMetricsDashboard'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { Send, Mail, Calendar, Heart, UserX } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

interface EmailManagementProps {
  eventId?: string
  eventTitle?: string
}

interface EventOption {
  id: string
  title: string
  event_date: string
  agent_name: string
}

const EMAIL_TYPES = [
  {
    key: 'confirmation' as const,
    label: 'RSVP Confirmation',
    icon: Mail,
    description: 'Sent immediately when someone RSVPs'
  },
  {
    key: 'reminder_7day' as const,
    label: '7-Day Reminder',
    icon: Calendar,
    description: 'Sent 7 days before the event'
  },
  {
    key: 'reminder_1day' as const,
    label: '1-Day Reminder',
    icon: Calendar,
    description: 'Sent 1 day before the event'
  },
  {
    key: 'thank_you' as const,
    label: 'Thank You',
    icon: Heart,
    description: 'Sent after the event to attendees'
  },
  {
    key: 'no_show' as const,
    label: 'No-Show Follow-up',
    icon: UserX,
    description: 'Sent after the event to no-shows'
  }
]

export const EmailManagement: React.FC<EmailManagementProps> = ({ eventId: initialEventId, eventTitle: initialEventTitle }) => {
  const [selectedType, setSelectedType] = useState<'confirmation' | 'reminder_7day' | 'reminder_1day' | 'thank_you' | 'no_show'>('confirmation')
  const [sending, setSending] = useState(false)
  const [events, setEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId || '')
  const [selectedEventTitle, setSelectedEventTitle] = useState<string>(initialEventTitle || '')
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Use the selected event or the initial event
  const currentEventId = selectedEventId || initialEventId
  const currentEventTitle = selectedEventTitle || initialEventTitle

  const { sendReminderEmails, sendThankYouEmails, sendNoShowEmails, getTemplateByType } = useEmailTemplates(currentEventId)
  const { toast } = useToast()

  // Load available events if no eventId provided
  useEffect(() => {
    if (!initialEventId) {
      loadEvents()
    }
  }, [initialEventId])

  const loadEvents = async () => {
    setLoadingEvents(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          event_date,
          profiles:agent_id (
            first_name,
            last_name
          )
        `)
        .eq('is_published', true)
        .order('event_date', { ascending: false })

      if (error) throw error

      const formattedEvents: EventOption[] = (data || []).map(event => ({
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        agent_name: event.profiles ?
          `${event.profiles.first_name || ''} ${event.profiles.last_name || ''}`.trim() || 'Unknown Agent' :
          'Unknown Agent'
      }))

      setEvents(formattedEvents)
    } catch (error) {
      console.error('Error loading events:', error)
      toast({
        title: "Error loading events",
        description: "Could not load available events for email management.",
        variant: "destructive"
      })
    } finally {
      setLoadingEvents(false)
    }
  }

  const handleEventSelect = (eventId: string) => {
    const event = events.find(e => e.id === eventId)
    if (event) {
      setSelectedEventId(event.id)
      setSelectedEventTitle(event.title)
    }
  }

  const handleSendTestEmails = async () => {
    if (!currentEventId) {
      toast({
        title: "No event selected",
        description: "Please select an event first.",
        variant: "destructive"
      })
      return
    }

    const template = getTemplateByType(selectedType)
    if (!template) {
      toast({
        title: "No template found",
        description: "Please create and save an email template first.",
        variant: "destructive"
      })
      return
    }

    setSending(true)
    try {
      let result
      switch (selectedType) {
        case 'reminder_7day':
        case 'reminder_1day':
          result = await sendReminderEmails(currentEventId, selectedType)
          break
        case 'thank_you':
          result = await sendThankYouEmails(currentEventId)
          break
        case 'no_show':
          result = await sendNoShowEmails(currentEventId)
          break
        default:
          throw new Error('Manual sending not supported for this email type')
      }

      toast({
        title: "Emails sent successfully",
        description: result.message || `${EMAIL_TYPES.find(t => t.key === selectedType)?.label} emails sent.`
      })
    } catch (error) {
      console.error('Error sending emails:', error)
      toast({
        title: "Error sending emails",
        description: "There was an error sending the emails. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSending(false)
    }
  }

  const canSendManually = ['reminder_7day', 'reminder_1day', 'thank_you', 'no_show'].includes(selectedType)

  if (!currentEventId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Event for Email Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Choose an event to manage its email templates and view metrics:</label>
                <Select onValueChange={handleEventSelect} disabled={loadingEvents}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={loadingEvents ? "Loading events..." : "Select an event"} />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{event.title}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(event.event_date).toLocaleDateString()} • {event.agent_name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {events.length === 0 && !loadingEvents && (
                <p className="text-sm text-gray-500">
                  No published events found. Create and publish events first to manage their emails.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Email Management - {currentEventTitle}</span>
            {canSendManually && (
              <Button
                onClick={handleSendTestEmails}
                disabled={sending}
                variant="outline"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send Now'}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedType} onValueChange={(value) => setSelectedType(value as any)}>
            <TabsList className="grid w-full grid-cols-5">
              {EMAIL_TYPES.map((type) => (
                <TabsTrigger key={type.key} value={type.key} className="flex items-center gap-2">
                  <type.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{type.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-4">
              {EMAIL_TYPES.map((type) => (
                <TabsContent key={type.key} value={type.key}>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                      <type.icon className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-gray-600">{type.description}</div>
                      </div>
                    </div>

                    <EmailTemplateEditor
                      eventId={currentEventId}
                      emailType={type.key}
                    />
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <EmailMetricsDashboard eventId={currentEventId} />

      <Card>
        <CardHeader>
          <CardTitle>Email Automation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-green-700">Automatic Emails</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• RSVP Confirmation: Sent immediately on RSVP</li>
                <li>• 7-Day Reminder: Sent automatically 7 days before event</li>
                <li>• 1-Day Reminder: Sent automatically 1 day before event</li>
                <li>• Thank You: Sent automatically day after event to attendees</li>
                <li>• No-Show: Sent automatically day after event to no-shows</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-700">Manual Sending</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• 7-Day & 1-Day Reminders: Can send manually anytime</li>
                <li>• Thank You & No-Show: Can send manually after event</li>
                <li>• All emails respect template settings</li>
                <li>• Duplicate prevention built-in</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Badge variant="outline">Reply Forwarding</Badge>
              <span>All replies to automated emails are automatically forwarded to the agent's email address.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


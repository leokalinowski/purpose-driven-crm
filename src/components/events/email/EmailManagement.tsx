import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailTemplateEditor, EventPreviewData } from './EmailTemplateEditor'
import { EmailMetricsDashboard } from './EmailMetricsDashboard'
import { useEmailTemplates, useEmailMetrics } from '@/hooks/useEmailTemplates'
import { Send, Mail, Calendar, Heart, UserX, Users, RefreshCw, Clock, Save } from 'lucide-react'
import { toast } from 'sonner'
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
    key: 'invitation' as const,
    label: 'Invitation',
    icon: Users,
    description: 'Invite contacts from the agent database to RSVP'
  },
  {
    key: 'invitation_followup_1' as const,
    label: 'Follow-Up #1',
    icon: RefreshCw,
    description: 'Re-invite contacts who haven\'t RSVP\'d yet'
  },
  {
    key: 'invitation_followup_2' as const,
    label: 'Follow-Up #2',
    icon: RefreshCw,
    description: 'Final reminder for contacts who still haven\'t RSVP\'d'
  },
  {
    key: 'confirmation' as const,
    label: 'Confirmation',
    icon: Mail,
    description: 'Sent immediately when someone RSVPs'
  },
  {
    key: 'reminder_7day' as const,
    label: '7-Day',
    icon: Calendar,
    description: 'Sent 7 days before the event'
  },
  {
    key: 'reminder_1day' as const,
    label: '1-Day',
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
    label: 'No-Show',
    icon: UserX,
    description: 'Sent after the event to no-shows'
  }
]

const AutoFollowUpSettings: React.FC<{ eventId: string }> = ({ eventId }) => {
  const [enabled, setEnabled] = useState(false)
  const [followup1Days, setFollowup1Days] = useState(3)
  const [followup2Days, setFollowup2Days] = useState(7)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [followup1Sent, setFollowup1Sent] = useState(false)
  const [followup2Sent, setFollowup2Sent] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: ev }, { data: fu1 }, { data: fu2 }] = await Promise.all([
        supabase.from('events').select('auto_followup_enabled, followup_1_days, followup_2_days').eq('id', eventId).single(),
        supabase.from('event_emails').select('id').eq('event_id', eventId).eq('email_type', 'invitation_followup_1').in('status', ['sent', 'delivered', 'opened', 'clicked']).limit(1).maybeSingle(),
        supabase.from('event_emails').select('id').eq('event_id', eventId).eq('email_type', 'invitation_followup_2').in('status', ['sent', 'delivered', 'opened', 'clicked']).limit(1).maybeSingle(),
      ])
      if (ev) {
        setEnabled(ev.auto_followup_enabled ?? false)
        setFollowup1Days(ev.followup_1_days ?? 3)
        setFollowup2Days(ev.followup_2_days ?? 7)
      }
      setFollowup1Sent(!!fu1)
      setFollowup2Sent(!!fu2)
      setLoaded(true)
    }
    load()
  }, [eventId])

  const handleSave = async () => {
    if (followup2Days <= followup1Days) {
      toast.error('Follow-Up #2 days must be greater than Follow-Up #1 days')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('events').update({
        auto_followup_enabled: enabled,
        followup_1_days: followup1Days,
        followup_2_days: followup2Days,
      }).eq('id', eventId)
      if (error) throw error
      toast.success('Auto follow-up settings saved')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Automatic Follow-Up Scheduling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="auto-followup-toggle" className="font-medium">Enable Automatic Follow-Ups</Label>
            <p className="text-sm text-muted-foreground">Automatically send follow-up invitations to contacts who haven't RSVP'd</p>
          </div>
          <Switch id="auto-followup-toggle" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <div className="space-y-4 pt-2 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fu1-days">Follow-Up #1 after (days)</Label>
                <div className="flex items-center gap-2">
                  <Input id="fu1-days" type="number" min={1} max={30} value={followup1Days} onChange={(e) => setFollowup1Days(Number(e.target.value))} className="w-20" />
                  <span className="text-sm text-muted-foreground">days after initial invitation</span>
                </div>
                {followup1Sent && <Badge variant="secondary" className="text-xs">✅ Already sent</Badge>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fu2-days">Follow-Up #2 after (days)</Label>
                <div className="flex items-center gap-2">
                  <Input id="fu2-days" type="number" min={2} max={60} value={followup2Days} onChange={(e) => setFollowup2Days(Number(e.target.value))} className="w-20" />
                  <span className="text-sm text-muted-foreground">days after initial invitation</span>
                </div>
                {followup2Sent && <Badge variant="secondary" className="text-xs">✅ Already sent</Badge>}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              ⚠️ Templates for "Follow-Up #1" and "Follow-Up #2" must exist before the scheduler will send them. The scheduler runs daily at 10 AM ET.
            </p>

            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const EmailManagement: React.FC<EmailManagementProps> = ({ eventId: initialEventId, eventTitle: initialEventTitle }) => {
  const [selectedType, setSelectedType] = useState<'confirmation' | 'reminder_7day' | 'reminder_1day' | 'thank_you' | 'no_show' | 'invitation' | 'invitation_followup_1' | 'invitation_followup_2'>('invitation')
  const [sending, setSending] = useState(false)
  const [events, setEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId || '')
  const [selectedEventTitle, setSelectedEventTitle] = useState<string>(initialEventTitle || '')
  const [loadingEvents, setLoadingEvents] = useState(false)
  // templateMode removed - always event-specific
  const [eventPreviewData, setEventPreviewData] = useState<EventPreviewData>({})

  // Use the selected event or the initial event
  const currentEventId = selectedEventId || initialEventId
  const currentEventTitle = selectedEventTitle || initialEventTitle

  const { sendReminderEmails, sendThankYouEmails, sendNoShowEmails, sendInvitationEmails, sendFollowUpEmails, getTemplateByType } = useEmailTemplates(currentEventId)
  

  // Load available events if no eventId provided
  useEffect(() => {
    if (!initialEventId) {
      loadEvents()
    }
  }, [initialEventId])

  // Load event preview data when a current event is selected
  useEffect(() => {
    if (!currentEventId) return
    const loadPreviewData = async () => {
      try {
        const { data: ev } = await supabase
          .from('events')
          .select('title, event_date, location, description, agent_id, brand_color')
          .eq('id', currentEventId)
          .single()
        if (!ev) return

        let agentData: EventPreviewData = {}
        if (ev.agent_id) {
          const [profileRes, brandingRes] = await Promise.all([
            supabase
              .from('profiles')
              .select('first_name, last_name, email, phone_number, office_number, office_address, website, brokerage, team_name')
              .eq('user_id', ev.agent_id)
              .single(),
            supabase
              .from('agent_marketing_settings')
              .select('primary_color, secondary_color, headshot_url, logo_colored_url, logo_white_url')
              .eq('user_id', ev.agent_id)
              .maybeSingle()
          ])
          const profile = profileRes.data
          const branding = brandingRes.data
          if (profile) {
            agentData = {
              agent_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || undefined,
              agent_email: profile.email || undefined,
              agent_phone: profile.phone_number || undefined,
              agent_office_number: profile.office_number || undefined,
              agent_office_address: profile.office_address || undefined,
              agent_website: profile.website || undefined,
              agent_brokerage: profile.brokerage || undefined,
              agent_team_name: profile.team_name || undefined,
              primary_color: branding?.primary_color || ev.brand_color || undefined,
              secondary_color: branding?.secondary_color || undefined,
              headshot_url: branding?.headshot_url || undefined,
              logo_colored_url: branding?.logo_colored_url || undefined,
              logo_white_url: branding?.logo_white_url || undefined,
            }
          }
        }

        setEventPreviewData({
          title: ev.title,
          event_date: ev.event_date,
          location: ev.location || undefined,
          description: ev.description || undefined,
          ...agentData,
        })
      } catch (err) {
        console.error('Error loading event preview data:', err)
      }
    }
    loadPreviewData()
  }, [currentEventId])

  const loadEvents = async () => {
    setLoadingEvents(true)
    try {
      // Fetch events and profiles separately to avoid relationship query issues
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, event_date, agent_id')
        .eq('is_published', true)
        .order('event_date', { ascending: false })

      if (eventsError) throw eventsError

      // Fetch profiles for all unique agent_ids
      const agentIds = [...new Set((eventsData || []).map(e => e.agent_id).filter(Boolean))]
      let profilesMap: Record<string, { first_name?: string; last_name?: string }> = {}

      if (agentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', agentIds)

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.user_id] = p
            return acc
          }, {} as Record<string, { first_name?: string; last_name?: string }>)
        }
      }

      const formattedEvents: EventOption[] = (eventsData || []).map(event => {
        const profile = profilesMap[event.agent_id]
        return {
          id: event.id,
          title: event.title,
          event_date: event.event_date,
          agent_name: profile ?
            `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Agent' :
            'Unknown Agent'
        }
      })

      setEvents(formattedEvents)
    } catch (error: any) {
      console.error('Error loading events:', error)
      toast.error(error.message || "Could not load available events for email management.")
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
      toast.error("Please select an event first.")
      return
    }

    const template = getTemplateByType(selectedType)
    if (!template) {
      toast.error("Please create and save an email template first.")
      return
    }

    setSending(true)
    try {
      let result
      switch (selectedType) {
        case 'invitation':
          result = await sendInvitationEmails(currentEventId)
          break
        case 'invitation_followup_1':
          result = await sendFollowUpEmails(currentEventId, 1)
          break
        case 'invitation_followup_2':
          result = await sendFollowUpEmails(currentEventId, 2)
          break
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

      toast.success(result.message || `${EMAIL_TYPES.find(t => t.key === selectedType)?.label} emails sent.`)
    } catch (error: any) {
      console.error('Error sending emails:', error)
      const errorMessage = error?.message || error?.context?.body || "There was an error sending the emails. Please try again."
      toast.error(errorMessage)
    } finally {
      setSending(false)
    }
  }

  const canSendManually = ['invitation', 'invitation_followup_1', 'invitation_followup_2', 'reminder_7day', 'reminder_1day', 'thank_you', 'no_show'].includes(selectedType)

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
          <CardTitle className="flex items-center justify-between flex-wrap gap-4">
            <span>Email Templates - {currentEventTitle}</span>
            <div className="flex items-center gap-2">
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
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedType} onValueChange={(value) => setSelectedType(value as any)}>
            <TabsList className="grid w-full grid-cols-8">
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
                      eventData={eventPreviewData}
                    />
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <AutoFollowUpSettings eventId={currentEventId} />

      <EmailMetricsDashboard eventId={currentEventId} />

      <Card>
        <CardHeader>
          <CardTitle>Email Automation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <li>• Event Invitation: Blast to agent's contact database</li>
                <li>• 7-Day & 1-Day Reminders: Can send manually anytime</li>
                <li>• Thank You & No-Show: Can send manually after event</li>
                <li>• All emails respect template settings</li>
                <li>• Duplicate prevention built-in</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-purple-700">Invitation Emails</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Sends to all contacts (DNC excluded)</li>
                <li>• Event must be published first</li>
                <li>• Includes RSVP link to public page</li>
                <li>• Deduplication prevents double-sends</li>
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


import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface EmailTemplate {
  id: string
  event_id: string
  email_type: 'confirmation' | 'reminder_7day' | 'reminder_1day' | 'thank_you' | 'no_show' | 'invitation'
  subject: string
  html_content: string
  text_content?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmailMetrics {
  total_sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  failed: number
}

export interface EmailRecord {
  id: string
  event_id: string
  rsvp_id?: string
  email_type: string
  recipient_email: string
  subject: string
  sent_at?: string
  delivered_at?: string
  opened_at?: string
  clicked_at?: string
  replied_at?: string
  bounced_at?: string
  status: string
  resend_id?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export const useEmailTemplates = (eventId?: string) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const fetchTemplates = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('event_email_templates')
        .select('*')
        .eq('event_id', eventId)
        .order('email_type')

      if (error) throw error
      setTemplates((data || []) as unknown as EmailTemplate[])
    } catch (error) {
      console.error('Error fetching event email templates:', error)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [eventId])

  const createTemplate = async (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<EmailTemplate> => {
    const { data, error } = await supabase
      .from('event_email_templates')
      .insert(template)
      .select()
      .single()

    if (error) throw error
    await fetchTemplates()
    return data as unknown as EmailTemplate
  }

  const updateTemplate = async (id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> => {
    const { data, error } = await supabase
      .from('event_email_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    await fetchTemplates()
    return data as unknown as EmailTemplate
  }

  const deleteTemplate = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('event_email_templates')
      .delete()
      .eq('id', id)

    if (error) throw error
    await fetchTemplates()
  }

  const getTemplateByType = (emailType: string) => {
    return templates.find(t => t.email_type === emailType && t.is_active)
  }

  const sendReminderEmails = async (eventId: string, emailType: 'reminder_7day' | 'reminder_1day') => {
    const { data, error } = await supabase.functions.invoke('event-reminder-email', {
      body: { eventId, emailType }
    })
    if (error) throw error
    return data
  }

  const sendThankYouEmails = async (eventId: string) => {
    const { data, error } = await supabase.functions.invoke('event-reminder-email', {
      body: { eventId, emailType: 'thank_you' }
    })
    if (error) throw error
    return data
  }

  const sendNoShowEmails = async (eventId: string) => {
    const { data, error } = await supabase.functions.invoke('event-reminder-email', {
      body: { eventId, emailType: 'no_show' }
    })
    if (error) throw error
    return data
  }

  const sendInvitationEmails = async (eventId: string) => {
    const { data, error } = await supabase.functions.invoke('send-event-invitation', {
      body: { eventId }
    })
    if (error) throw error
    return data
  }

  useEffect(() => {
    if (eventId) {
      fetchTemplates()
    }
  }, [eventId, fetchTemplates])

  return {
    templates,
    loading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateByType,
    sendReminderEmails,
    sendThankYouEmails,
    sendNoShowEmails,
    sendInvitationEmails
  }
}

export const useEmailMetrics = (eventId?: string) => {
  const [metrics, setMetrics] = useState<EmailMetrics>({
    total_sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    bounced: 0,
    failed: 0
  })
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchMetrics = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('event_emails')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const records = (data || []) as unknown as EmailRecord[]
      setEmails(records)

      setMetrics({
        total_sent: records.filter(e => e.status === 'sent').length,
        delivered: records.filter(e => e.delivered_at).length,
        opened: records.filter(e => e.opened_at).length,
        clicked: records.filter(e => e.clicked_at).length,
        replied: records.filter(e => e.replied_at).length,
        bounced: records.filter(e => e.bounced_at).length,
        failed: records.filter(e => e.status === 'failed').length
      })
    } catch (error) {
      console.error('Error fetching email metrics:', error)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (eventId) {
      fetchMetrics()
    }
  }, [eventId, fetchMetrics])

  return {
    metrics,
    emails,
    loading,
    fetchMetrics
  }
}

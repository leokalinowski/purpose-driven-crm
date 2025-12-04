import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface EmailTemplate {
  id: string
  event_id: string
  email_type: 'confirmation' | 'reminder_7day' | 'reminder_1day' | 'thank_you' | 'no_show'
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

  const fetchTemplates = async () => {
    if (!eventId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('event_email_templates')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching email templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTemplate = async (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('event_email_templates')
        .insert(template)
        .select()
        .single()

      if (error) throw error
      setTemplates(prev => [data, ...prev])
      return data
    } catch (error) {
      console.error('Error creating email template:', error)
      throw error
    }
  }

  const updateTemplate = async (id: string, updates: Partial<EmailTemplate>) => {
    try {
      const { data, error } = await supabase
        .from('event_email_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setTemplates(prev => prev.map(t => t.id === id ? data : t))
      return data
    } catch (error) {
      console.error('Error updating email template:', error)
      throw error
    }
  }

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('event_email_templates')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting email template:', error)
      throw error
    }
  }

  const getTemplateByType = (emailType: string) => {
    return templates.find(t => t.email_type === emailType && t.is_active)
  }

  const sendReminderEmails = async (eventId: string, emailType: 'reminder_7day' | 'reminder_1day') => {
    try {
      const { data, error } = await supabase.functions.invoke('event-reminder-email', {
        body: { eventId, emailType }
      })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error sending reminder emails:', error)
      throw error
    }
  }

  const sendThankYouEmails = async (eventId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('event-thank-you-email', {
        body: { eventId }
      })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error sending thank you emails:', error)
      throw error
    }
  }

  const sendNoShowEmails = async (eventId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('event-no-show-email', {
        body: { eventId }
      })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error sending no-show emails:', error)
      throw error
    }
  }

  useEffect(() => {
    if (eventId) {
      fetchTemplates()
    }
  }, [eventId])

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
    sendNoShowEmails
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

  const fetchMetrics = async () => {
    if (!eventId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('event_emails')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const emailRecords = data || []
      setEmails(emailRecords)

      const calculatedMetrics = emailRecords.reduce((acc, email) => {
        acc.total_sent++
        if (email.status === 'delivered' || email.delivered_at) acc.delivered++
        if (email.status === 'opened' || email.opened_at) acc.opened++
        if (email.status === 'clicked' || email.clicked_at) acc.clicked++
        if (email.status === 'replied' || email.replied_at) acc.replied++
        if (email.status === 'bounced' || email.bounced_at) acc.bounced++
        if (email.status === 'failed') acc.failed++
        return acc
      }, {
        total_sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0,
        failed: 0
      })

      setMetrics(calculatedMetrics)
    } catch (error) {
      console.error('Error fetching email metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) {
      fetchMetrics()
    }
  }, [eventId])

  return {
    metrics,
    emails,
    loading,
    fetchMetrics
  }
}

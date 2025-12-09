import { useState, useEffect, useCallback } from 'react'
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

// Note: event_email_templates and event_emails tables don't exist in the database schema
// This hook provides stub implementations that return empty data
// The email functionality needs database tables to be created first

export const useEmailTemplates = (eventId?: string) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const fetchTemplates = useCallback(async () => {
    if (!eventId) return
    // Table event_email_templates doesn't exist - return empty array
    console.warn('event_email_templates table does not exist in database')
    setTemplates([])
  }, [eventId])

  const createTemplate = async (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<EmailTemplate> => {
    console.warn('Cannot create template - event_email_templates table does not exist')
    throw new Error('Email templates feature requires database setup')
  }

  const updateTemplate = async (id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> => {
    console.warn('Cannot update template - event_email_templates table does not exist')
    throw new Error('Email templates feature requires database setup')
  }

  const deleteTemplate = async (id: string): Promise<void> => {
    console.warn('Cannot delete template - event_email_templates table does not exist')
    throw new Error('Email templates feature requires database setup')
  }

  const getTemplateByType = (emailType: string) => {
    return templates.find(t => t.email_type === emailType && t.is_active)
  }

  const sendReminderEmails = async (eventId: string, emailType: 'reminder_7day' | 'reminder_1day') => {
    console.warn('Email sending not implemented - requires database setup')
    return { message: 'Email feature not configured' }
  }

  const sendThankYouEmails = async (eventId: string) => {
    console.warn('Email sending not implemented - requires database setup')
    return { message: 'Email feature not configured' }
  }

  const sendNoShowEmails = async (eventId: string) => {
    console.warn('Email sending not implemented - requires database setup')
    return { message: 'Email feature not configured' }
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

  const fetchMetrics = useCallback(async () => {
    if (!eventId) return
    // Table event_emails doesn't exist - return empty data
    console.warn('event_emails table does not exist in database')
    setEmails([])
    setMetrics({
      total_sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      failed: 0
    })
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

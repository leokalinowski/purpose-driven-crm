import { useState, useEffect, useCallback } from 'react'

export interface GlobalEmailTemplate {
  id: string
  email_type: 'confirmation' | 'reminder_7day' | 'reminder_1day' | 'thank_you' | 'no_show'
  subject: string
  html_content: string
  text_content?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Note: global_email_templates table doesn't exist in the database schema
// This hook provides stub implementations that return empty data
// The email functionality needs database tables to be created first

export const useGlobalEmailTemplates = () => {
  const [templates, setTemplates] = useState<GlobalEmailTemplate[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTemplates = useCallback(async () => {
    // Table global_email_templates doesn't exist - return empty array
    console.warn('global_email_templates table does not exist in database')
    setTemplates([])
  }, [])

  const createTemplate = async (template: Omit<GlobalEmailTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<GlobalEmailTemplate> => {
    console.warn('Cannot create template - global_email_templates table does not exist')
    throw new Error('Global email templates feature requires database setup')
  }

  const updateTemplate = async (id: string, updates: Partial<GlobalEmailTemplate>): Promise<GlobalEmailTemplate> => {
    console.warn('Cannot update template - global_email_templates table does not exist')
    throw new Error('Global email templates feature requires database setup')
  }

  const getTemplateByType = (emailType: string) => {
    return templates.find(t => t.email_type === emailType && t.is_active)
  }

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return {
    templates,
    loading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    getTemplateByType
  }
}

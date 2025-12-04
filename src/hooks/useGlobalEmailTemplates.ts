import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

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

export const useGlobalEmailTemplates = () => {
  const [templates, setTemplates] = useState<GlobalEmailTemplate[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('global_email_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching global email templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTemplate = async (template: Omit<GlobalEmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('global_email_templates')
        .insert(template)
        .select()
        .single()

      if (error) throw error
      setTemplates(prev => [data, ...prev])
      return data
    } catch (error) {
      console.error('Error creating global email template:', error)
      throw error
    }
  }

  const updateTemplate = async (id: string, updates: Partial<GlobalEmailTemplate>) => {
    try {
      const { data, error } = await supabase
        .from('global_email_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setTemplates(prev => prev.map(t => t.id === id ? data : t))
      return data
    } catch (error) {
      console.error('Error updating global email template:', error)
      throw error
    }
  }

  const getTemplateByType = (emailType: string) => {
    return templates.find(t => t.email_type === emailType && t.is_active)
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  return {
    templates,
    loading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    getTemplateByType
  }
}


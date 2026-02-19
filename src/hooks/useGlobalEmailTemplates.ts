import { useState, useEffect, useCallback } from 'react'
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

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('global_email_templates')
        .select('*')
        .order('email_type')

      if (error) throw error
      setTemplates((data || []) as unknown as GlobalEmailTemplate[])
    } catch (error) {
      console.error('Error fetching global email templates:', error)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  const createTemplate = async (template: Omit<GlobalEmailTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<GlobalEmailTemplate> => {
    const { data, error } = await supabase
      .from('global_email_templates')
      .insert(template)
      .select()
      .single()

    if (error) throw error
    await fetchTemplates()
    return data as unknown as GlobalEmailTemplate
  }

  const updateTemplate = async (id: string, updates: Partial<GlobalEmailTemplate>): Promise<GlobalEmailTemplate> => {
    const { data, error } = await supabase
      .from('global_email_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    await fetchTemplates()
    return data as unknown as GlobalEmailTemplate
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

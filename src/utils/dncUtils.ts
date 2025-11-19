import { supabase } from '@/integrations/supabase/client';

/**
 * Shared DNC checking utility for consistent behavior across all workflows
 */
export async function checkContactDNC(
  contactId: string, 
  phone: string
): Promise<{ success: boolean; isDNC: boolean; error?: string }> {
  try {
    if (!phone || !contactId) {
      return { success: false, isDNC: false, error: 'Phone number and contact ID required' };
    }

    // Normalize phone to 10 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return { success: false, isDNC: false, error: 'Phone number must be at least 10 digits' };
    }

    // Call dnc-single-check edge function
    const { data, error } = await supabase.functions.invoke('dnc-single-check', {
      body: { phone, contactId }
    });

    if (error) {
      console.error('DNC check failed:', error);
      return { success: false, isDNC: false, error: error.message };
    }

    return {
      success: data?.success || false,
      isDNC: data?.isDNC || false
    };
  } catch (error: any) {
    console.error('DNC check exception:', error);
    return { success: false, isDNC: false, error: error.message };
  }
}

/**
 * Batch DNC check for multiple contacts (used in CSV uploads)
 */
export async function batchCheckContactsDNC(
  contacts: Array<{ id: string; phone?: string | null }>
): Promise<{ total: number; checked: number; flagged: number; errors: number }> {
  let checked = 0;
  let flagged = 0;
  let errors = 0;

  const contactsWithPhone = contacts.filter(c => c.phone);
  
  for (const contact of contactsWithPhone) {
    const result = await checkContactDNC(contact.id, contact.phone!);
    
    if (result.success) {
      checked++;
      if (result.isDNC) {
        flagged++;
      }
    } else {
      errors++;
    }
  }

  return {
    total: contacts.length,
    checked,
    flagged,
    errors
  };
}

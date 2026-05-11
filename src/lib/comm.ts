import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CommContact {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  dnc?: boolean | null;
}

type Channel = 'call' | 'text' | 'email';

const channelMeta: Record<Channel, { verb: string; field: 'phone' | 'email'; protocol: 'tel' | 'sms' | 'mailto' }> = {
  call:  { verb: 'Call',  field: 'phone', protocol: 'tel' },
  text:  { verb: 'Text',  field: 'phone', protocol: 'sms' },
  email: { verb: 'Email', field: 'email', protocol: 'mailto' },
};

function displayName(c: CommContact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'this contact';
}

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

async function logActivity(
  agentId: string,
  contactId: string,
  channel: Channel,
  notes?: string,
): Promise<void> {
  const { error } = await supabase.from('contact_activities').insert({
    agent_id: agentId,
    contact_id: contactId,
    activity_type: channel,
    activity_date: new Date().toISOString(),
    notes: notes ?? null,
  });
  if (error) {
    console.warn(`[comm] failed to log ${channel} activity:`, error);
    toast.warning(`${channelMeta[channel].verb} opened, but logging failed`, {
      description: error.message,
    });
  }
}

function open(url: string): void {
  // Use a transient anchor so we don't lose focus or break SPA navigation.
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function dispatch(channel: Channel, agentId: string, contact: CommContact): Promise<void> {
  const meta = channelMeta[channel];
  const value = contact[meta.field];

  if (!value) {
    toast.error(`No ${meta.field} on file for ${displayName(contact)}`);
    return;
  }

  // DNC is informational for sphere outreach. Agents are generally permitted
  // to contact people they have an existing relationship with (the EBR
  // exemption). We surface a warning toast but proceed with the call/text and
  // log it normally — the responsibility to decide rests with the agent.
  if ((channel === 'call' || channel === 'text') && contact.dnc) {
    toast.warning(`${displayName(contact)} is on the Do Not Call list`, {
      description: 'Heads up — sphere outreach is usually OK under the EBR exemption. Use your judgment.',
    });
  }

  const target = channel === 'email' ? value : digitsOnly(value);
  open(`${meta.protocol}:${target}`);

  await logActivity(agentId, contact.id, channel);
  toast.success(`${meta.verb} logged`, {
    description: `Last ${channel} updated for ${displayName(contact)}.`,
  });
}

export function placeCall(agentId: string, contact: CommContact): Promise<void> {
  return dispatch('call', agentId, contact);
}

export function sendText(agentId: string, contact: CommContact): Promise<void> {
  return dispatch('text', agentId, contact);
}

export function sendEmail(agentId: string, contact: CommContact): Promise<void> {
  return dispatch('email', agentId, contact);
}

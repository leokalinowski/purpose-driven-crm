/**
 * ConversationStarterModal — channel-aware "what should I say?" sheet.
 *
 * Three modes:
 *   • call  — shows talking-point cards. "Start call" opens tel:, modal stays
 *              open so the agent can reference the points during the call.
 *   • text  — shows pre-written message cards. Tapping a card pre-fills the
 *              SMS body via sms:?body= and logs the activity with the message.
 *   • email — shows subject+body templates. Tapping opens mailto: with both
 *              fields pre-filled (editable in the email client).
 *
 * Agent can edit the chosen template before sending. Activity always logs to
 * `contact_activities` with the actual message used.
 */

import { useEffect, useMemo, useState } from 'react';
import { Phone, MessageSquare, Mail, Loader2, Copy, Check, ExternalLink, AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  CALL_STARTERS, TEXT_STARTERS, EMAIL_STARTERS,
  buildSmsUrl, buildMailtoUrl, buildTelUrl,
  interpolate,
  type Channel, type CallStarter, type TextStarter, type EmailStarter,
} from '@/lib/conversationStarters';
import type { CommContact } from '@/lib/comm';

interface ConversationStarterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel | null;
  contact: CommContact | null;
}

const channelMeta: Record<Channel, { Icon: typeof Phone; verb: string; label: string }> = {
  call: { Icon: Phone, verb: 'Call', label: 'What to say' },
  text: { Icon: MessageSquare, verb: 'Text', label: 'Pick a message' },
  email: { Icon: Mail, verb: 'Email', label: 'Pick a template' },
};

function openExternal(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function logActivity(agentId: string, contactId: string, channel: Channel, notes: string | null) {
  const { error } = await supabase.from('contact_activities').insert({
    agent_id: agentId,
    contact_id: contactId,
    activity_type: channel,
    activity_date: new Date().toISOString(),
    notes: notes ?? null,
  });
  if (error) {
    console.warn(`[ConversationStarterModal] log ${channel} failed:`, error);
    toast.warning(`${channelMeta[channel].verb} sent — but logging failed`, {
      description: error.message,
    });
    return false;
  }
  return true;
}

function displayName(contact: CommContact | null): string {
  if (!contact) return 'this contact';
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'this contact';
}

// DNC for sphere outreach is informational — surface it clearly but never block.
// Real-estate agents are generally permitted to contact people they have an
// existing business relationship with (EBR exemption). The agent decides.
function DncBanner({ name }: { name: string }) {
  return (
    <div className="flex gap-2.5 items-start mb-4 px-3.5 py-2.5 rounded-[10px] border bg-[hsl(35_100%_96%)] border-[hsl(35_80%_82%)]">
      <AlertTriangle className="w-4 h-4 mt-px text-[hsl(35_80%_38%)] shrink-0" />
      <div className="text-[12.5px] leading-[1.45] text-[hsl(35_80%_28%)]">
        <b className="font-semibold block">{name} is on the Do Not Call list.</b>
        Sphere outreach is generally permitted under the existing-business-relationship exemption — proceed with judgment.
      </div>
    </div>
  );
}

// ─── Channel-specific bodies ─────────────────────────────────────────────────

function CallBody({ contact, onClose }: { contact: CommContact; onClose: () => void }) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>(CALL_STARTERS[0].id);
  const [calling, setCalling] = useState(false);
  const [callPlaced, setCallPlaced] = useState(false);

  const selected = useMemo(
    () => CALL_STARTERS.find((s) => s.id === selectedId) ?? CALL_STARTERS[0],
    [selectedId],
  );

  const handleStartCall = async () => {
    if (!user?.id || !contact.phone) return;
    setCalling(true);
    openExternal(buildTelUrl(contact.phone));
    const noteSummary = `Talk track: ${selected.title}${contact.dnc ? ' (DNC — agent acknowledged)' : ''}`;
    const ok = await logActivity(user.id, contact.id, 'call', noteSummary);
    setCalling(false);
    if (ok) {
      setCallPlaced(true);
      toast.success('Call logged', { description: `${displayName(contact)} — ${selected.title}` });
    }
  };

  return (
    <>
      {contact.dnc && <DncBanner name={displayName(contact)} />}
      <div className="flex flex-col gap-1.5 mb-4">
        <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
          Pick a talk track
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CALL_STARTERS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={cn(
                'inline-flex items-center px-2.5 py-1.5 rounded-full text-[12px] font-medium border transition',
                selectedId === s.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-reop-dark-blue border-border hover:border-primary',
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{selected.context}</p>
      </div>

      <div className="bg-[hsl(184_100%_98%)] border border-[hsl(184_50%_85%)] rounded-[10px] p-4 mb-4">
        <div className="text-[11px] uppercase tracking-[0.06em] font-bold text-primary mb-2">
          Talking points
        </div>
        <ol className="m-0 pl-4 flex flex-col gap-2 text-[13.5px] text-reop-dark-blue leading-[1.5]">
          {selected.talkingPoints.map((point, i) => (
            <li key={i}>{interpolate(point, contact)}</li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2">
        {!callPlaced ? (
          <Button
            onClick={handleStartCall}
            disabled={calling || !contact.phone}
            className="h-11 w-full bg-primary text-primary-foreground hover:bg-reop-teal-hover"
          >
            {calling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
            Start call with {contact.first_name || 'them'}
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 text-sm text-reop-green font-semibold">
              <Check className="w-4 h-4" />
              Call placed and logged
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Keep this open while you talk — close when you&apos;re done.
            </p>
            <Button onClick={onClose} variant="outline" className="h-10 w-full">
              Done
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function TextBody({ contact, onClose }: { contact: CommContact; onClose: () => void }) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>(TEXT_STARTERS[0].id);
  const [body, setBody] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [copying, setCopying] = useState(false);

  // Hydrate body whenever the agent picks a different template
  useEffect(() => {
    const tpl = TEXT_STARTERS.find((s) => s.id === selectedId) ?? TEXT_STARTERS[0];
    setBody(interpolate(tpl.body, contact));
  }, [selectedId, contact]);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(body);
      toast.success('Message copied');
    } catch {
      toast.error('Could not copy — long-press the box to select');
    }
    setCopying(false);
  };

  const handleSend = async () => {
    if (!user?.id || !contact.phone || !body.trim()) return;
    setSending(true);
    openExternal(buildSmsUrl(contact.phone, body));
    const noteBody = contact.dnc ? `${body}\n\n[DNC — agent acknowledged]` : body;
    const ok = await logActivity(user.id, contact.id, 'text', noteBody);
    setSending(false);
    if (ok) {
      toast.success('Text logged', { description: `${displayName(contact)} — ${body.slice(0, 60)}${body.length > 60 ? '…' : ''}` });
      onClose();
    }
  };

  return (
    <>
      {contact.dnc && <DncBanner name={displayName(contact)} />}
      <div className="flex flex-col gap-1.5 mb-3">
        <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
          Pick a starter
        </span>
        <div className="flex flex-wrap gap-1.5">
          {TEXT_STARTERS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={cn(
                'inline-flex items-center px-2.5 py-1.5 rounded-full text-[12px] font-medium border transition',
                selectedId === s.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-reop-dark-blue border-border hover:border-primary',
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        <span className="text-xs font-semibold text-reop-dark-blue">Message</span>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="text-[14px] leading-[1.5] resize-y min-h-[96px]"
        />
        <div className="text-[11px] text-muted-foreground">
          {body.length} chars — edit before sending.
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={handleSend}
          disabled={sending || !contact.phone || !body.trim()}
          className="h-11 flex-1 bg-primary text-primary-foreground hover:bg-reop-teal-hover"
        >
          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
          Open Messages
        </Button>
        <Button
          onClick={handleCopy}
          disabled={copying || !body.trim()}
          variant="outline"
          className="h-11 sm:w-auto"
        >
          {copying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
          Copy
        </Button>
      </div>
    </>
  );
}

function EmailBody({ contact, onClose }: { contact: CommContact; onClose: () => void }) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>(EMAIL_STARTERS[0].id);
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const tpl = EMAIL_STARTERS.find((s) => s.id === selectedId) ?? EMAIL_STARTERS[0];
    setSubject(interpolate(tpl.subject, contact));
    setBody(interpolate(tpl.body, contact));
  }, [selectedId, contact]);

  const handleSend = async () => {
    if (!user?.id || !contact.email || !body.trim()) return;
    setSending(true);
    openExternal(buildMailtoUrl(contact.email, subject, body));
    const summary = `Subject: ${subject}\n\n${body}`;
    const ok = await logActivity(user.id, contact.id, 'email', summary);
    setSending(false);
    if (ok) {
      toast.success('Email logged', { description: `${displayName(contact)} — ${subject}` });
      onClose();
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1.5 mb-3">
        <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
          Pick a template
        </span>
        <div className="flex flex-wrap gap-1.5">
          {EMAIL_STARTERS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={cn(
                'inline-flex items-center px-2.5 py-1.5 rounded-full text-[12px] font-medium border transition',
                selectedId === s.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-reop-dark-blue border-border hover:border-primary',
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-3">
        <span className="text-xs font-semibold text-reop-dark-blue">Subject</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-10 px-3 border border-border rounded-lg bg-card text-sm text-reop-dark-blue focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        <span className="text-xs font-semibold text-reop-dark-blue">Body</span>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="text-[14px] leading-[1.55] resize-y min-h-[180px]"
        />
      </div>

      <Button
        onClick={handleSend}
        disabled={sending || !contact.email || !body.trim()}
        className="h-11 w-full bg-primary text-primary-foreground hover:bg-reop-teal-hover"
      >
        {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
        Open email draft
      </Button>
    </>
  );
}

// ─── The shell ───────────────────────────────────────────────────────────────

export function ConversationStarterModal({ open, onOpenChange, channel, contact }: ConversationStarterModalProps) {
  if (!channel || !contact) return null;
  const meta = channelMeta[channel];
  const Icon = meta.Icon;

  const handleClose = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] overflow-y-auto p-5 sm:p-6 flex flex-col"
      >
        <SheetHeader className="text-left mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-reop-teal-soft text-primary flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <SheetTitle className="text-base font-semibold text-reop-dark-blue">
                {meta.verb} {displayName(contact)}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate">
                {meta.label} — edit before sending.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1">
          {channel === 'call' && <CallBody contact={contact} onClose={handleClose} />}
          {channel === 'text' && <TextBody contact={contact} onClose={handleClose} />}
          {channel === 'email' && <EmailBody contact={contact} onClose={handleClose} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

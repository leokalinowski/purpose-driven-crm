/**
 * EventEmailsPanel — replaces EmailManagement for the agent-facing
 * EventDetail page.
 *
 * The previous component was an 8-tab horizontal switcher with a single
 * monolithic editor below — agents couldn't see what was automated vs.
 * what they had to send manually, what was scheduled vs. sent, or what
 * the lifecycle looked like.
 *
 * The new design groups emails by lifecycle stage in cards:
 *
 *   1. Auto follow-up settings   (controls when reminder schedule fires)
 *   2. Invitations               — manual sends (initial + 2 follow-ups)
 *   3. Reminders                 — auto-scheduled (7-day + 1-day)
 *   4. Confirmation              — auto-sent on RSVP
 *   5. Post-event                — thank-you + no-show
 *
 * Each card shows: status (auto / manual / scheduled), last-sent time,
 * subject preview, and the actions available for that email type.
 * Editing the template opens a side drawer reusing the existing
 * EmailTemplateEditor — we only redesigned the OUTER shell, not the
 * editor itself.
 *
 * Phase 5 of the Events comprehensive sweep, second iteration after the
 * user feedback that the original copy of the old EmailManagement didn't
 * match the new aesthetic.
 */

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Mail, Send, Calendar, Heart, UserX, Users, RefreshCw,
  Clock, CheckCircle2, AlertTriangle, Pencil, Eye, Sparkles, X, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useEmailTemplates, useEmailMetrics } from '@/hooks/useEmailTemplates';
import { EmailTemplateEditor } from './email/EmailTemplateEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EventEmailsPanelProps {
  eventId: string;
  eventTitle: string;
}

type EmailType =
  | 'invitation'
  | 'invitation_followup_1'
  | 'invitation_followup_2'
  | 'reminder_7day'
  | 'reminder_1day'
  | 'confirmation'
  | 'thank_you'
  | 'no_show';

type SendKind = 'manual' | 'auto' | 'on_rsvp';

interface EmailCardConfig {
  type: EmailType;
  label: string;
  description: string;
  sendKind: SendKind;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional — set the action button label when manual send is supported. */
  manualSendLabel?: string;
}

const INVITATIONS: EmailCardConfig[] = [
  { type: 'invitation',          label: 'Initial invitation', description: 'Sent to your contact list when you click Send.', sendKind: 'manual', icon: Users, manualSendLabel: 'Send invitations' },
  { type: 'invitation_followup_1', label: 'Follow-up #1',     description: 'Re-invites contacts who haven\'t RSVPd yet.',   sendKind: 'manual', icon: RefreshCw, manualSendLabel: 'Send follow-up' },
  { type: 'invitation_followup_2', label: 'Follow-up #2',     description: 'Final reminder for non-responders.',             sendKind: 'manual', icon: RefreshCw, manualSendLabel: 'Send follow-up' },
];

const REMINDERS: EmailCardConfig[] = [
  { type: 'reminder_7day', label: '7 days before', description: 'Auto-sent to RSVPs one week out.', sendKind: 'auto', icon: Calendar },
  { type: 'reminder_1day', label: '1 day before',  description: 'Final nudge to RSVPs the day before.', sendKind: 'auto', icon: Calendar },
];

const POST_EVENT: EmailCardConfig[] = [
  { type: 'thank_you', label: 'Thank you',          description: 'Sent to attendees who showed up.', sendKind: 'auto', icon: Heart, manualSendLabel: 'Send now' },
  { type: 'no_show',   label: 'No-show follow-up',  description: 'Sent to RSVPs who didn\'t check in.', sendKind: 'auto', icon: UserX, manualSendLabel: 'Send now' },
];

const CONFIRMATION_CONFIG: EmailCardConfig = {
  type: 'confirmation', label: 'RSVP confirmation', description: 'Auto-sent immediately when someone RSVPs.', sendKind: 'on_rsvp', icon: Mail,
};

export function EventEmailsPanel({ eventId, eventTitle }: EventEmailsPanelProps) {
  const {
    templates, loading: templatesLoading,
    sendInvitationEmails, sendFollowUpEmails,
    sendReminderEmails, sendThankYouEmails, sendNoShowEmails,
  } = useEmailTemplates(eventId);
  const { metrics } = useEmailMetrics(eventId);

  // Track which template editor is open in the side drawer.
  const [editing, setEditing] = useState<EmailType | null>(null);
  // Track per-type send-in-flight state so we can disable buttons + show
  // a small spinner without conflating "saving template" with "sending".
  const [sending, setSending] = useState<Record<string, boolean>>({});

  // Per-type "last sent" lookup, fetched once + after each send. Source
  // of truth: `event_emails` table, latest row per type for this event.
  const [sentSummary, setSentSummary] = useState<Record<string, { count: number; lastSent: string | null }>>({});
  const [sentLoading, setSentLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setSentLoading(true);
      const { data, error } = await supabase
        .from('event_emails')
        .select('email_type, sent_at, status')
        .eq('event_id', eventId)
        .in('status', ['sent', 'delivered', 'opened', 'clicked']);
      if (cancelled) return;
      if (error) {
        console.warn('[EventEmailsPanel] event_emails fetch failed:', error.message);
        setSentSummary({});
      } else {
        const map: Record<string, { count: number; lastSent: string | null }> = {};
        for (const row of data ?? []) {
          const t = row.email_type as string;
          if (!map[t]) map[t] = { count: 0, lastSent: null };
          map[t].count++;
          if (row.sent_at && (!map[t].lastSent || row.sent_at > map[t].lastSent)) {
            map[t].lastSent = row.sent_at;
          }
        }
        setSentSummary(map);
      }
      setSentLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [eventId]);

  // Quick-lookup of which templates exist (so cards can show "Set up" vs
  // "Edit" depending on whether a template has been customized).
  const templateExistsFor = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) if (t.is_active) set.add(t.email_type);
    return set;
  }, [templates]);

  const refreshSentSummary = async () => {
    const { data } = await supabase
      .from('event_emails')
      .select('email_type, sent_at, status')
      .eq('event_id', eventId)
      .in('status', ['sent', 'delivered', 'opened', 'clicked']);
    const map: Record<string, { count: number; lastSent: string | null }> = {};
    for (const row of data ?? []) {
      const t = row.email_type as string;
      if (!map[t]) map[t] = { count: 0, lastSent: null };
      map[t].count++;
      if (row.sent_at && (!map[t].lastSent || row.sent_at > map[t].lastSent)) {
        map[t].lastSent = row.sent_at;
      }
    }
    setSentSummary(map);
  };

  const handleSend = async (type: EmailType) => {
    setSending((s) => ({ ...s, [type]: true }));
    try {
      if (type === 'invitation') {
        await sendInvitationEmails(eventId);
        toast.success('Invitations sent');
      } else if (type === 'invitation_followup_1') {
        await sendFollowUpEmails(eventId, 1);
        toast.success('Follow-up #1 sent');
      } else if (type === 'invitation_followup_2') {
        await sendFollowUpEmails(eventId, 2);
        toast.success('Follow-up #2 sent');
      } else if (type === 'reminder_7day' || type === 'reminder_1day') {
        await sendReminderEmails(eventId, type);
        toast.success('Reminder sent');
      } else if (type === 'thank_you') {
        await sendThankYouEmails(eventId);
        toast.success('Thank-you emails sent');
      } else if (type === 'no_show') {
        await sendNoShowEmails(eventId);
        toast.success('No-show emails sent');
      }
      await refreshSentSummary();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send';
      toast.error(message);
    } finally {
      setSending((s) => ({ ...s, [type]: false }));
    }
  };

  return (
    <div className="space-y-5">
      {/* Email metrics strip — only renders when at least one email has
          been sent. Mirrors the Pipeline metrics-tile pattern. */}
      {metrics.total_sent > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricTile label="Sent" value={metrics.total_sent} sub="Total emails out" tone="primary" />
          <MetricTile label="Delivered" value={metrics.delivered} sub={`${pct(metrics.delivered, metrics.total_sent)}% of sent`} tone="ok" />
          <MetricTile label="Opened" value={metrics.opened} sub={`${pct(metrics.opened, metrics.delivered)}% of delivered`} tone="primary" />
          <MetricTile label="Clicked" value={metrics.clicked} sub={`${pct(metrics.clicked, metrics.opened)}% of opened`} tone="ok" />
        </div>
      )}

      {/* Auto follow-up scheduler */}
      <AutoFollowUpCard eventId={eventId} />

      {/* Invitations */}
      <SectionHeader
        title="Invitations"
        subtitle="You send these manually. Schedule the follow-ups via the auto-scheduler above to send them automatically."
      />
      <div className="grid md:grid-cols-3 gap-3">
        {INVITATIONS.map((cfg) => (
          <EmailCard
            key={cfg.type}
            cfg={cfg}
            templateConfigured={templateExistsFor.has(cfg.type)}
            sentInfo={sentSummary[cfg.type]}
            sentLoading={sentLoading || templatesLoading}
            sending={!!sending[cfg.type]}
            onEdit={() => setEditing(cfg.type)}
            onSend={() => handleSend(cfg.type)}
          />
        ))}
      </div>

      {/* Reminders */}
      <SectionHeader
        title="Reminders"
        subtitle="Auto-sent to RSVPs by the cron scheduler. Edit the templates here; sends happen on schedule."
      />
      <div className="grid md:grid-cols-2 gap-3">
        {REMINDERS.map((cfg) => (
          <EmailCard
            key={cfg.type}
            cfg={cfg}
            templateConfigured={templateExistsFor.has(cfg.type)}
            sentInfo={sentSummary[cfg.type]}
            sentLoading={sentLoading || templatesLoading}
            sending={!!sending[cfg.type]}
            onEdit={() => setEditing(cfg.type)}
            onSend={() => handleSend(cfg.type)}
          />
        ))}
      </div>

      {/* Confirmation */}
      <SectionHeader
        title="RSVP confirmation"
        subtitle="Sent automatically every time someone RSVPs to your public link."
      />
      <EmailCard
        cfg={CONFIRMATION_CONFIG}
        templateConfigured={templateExistsFor.has(CONFIRMATION_CONFIG.type)}
        sentInfo={sentSummary[CONFIRMATION_CONFIG.type]}
        sentLoading={sentLoading || templatesLoading}
        sending={!!sending[CONFIRMATION_CONFIG.type]}
        onEdit={() => setEditing(CONFIRMATION_CONFIG.type)}
        onSend={() => handleSend(CONFIRMATION_CONFIG.type)}
        wide
      />

      {/* Post-event */}
      <SectionHeader
        title="Post-event"
        subtitle="Sends after the event date. Auto-scheduled for attendees + no-shows respectively."
      />
      <div className="grid md:grid-cols-2 gap-3">
        {POST_EVENT.map((cfg) => (
          <EmailCard
            key={cfg.type}
            cfg={cfg}
            templateConfigured={templateExistsFor.has(cfg.type)}
            sentInfo={sentSummary[cfg.type]}
            sentLoading={sentLoading || templatesLoading}
            sending={!!sending[cfg.type]}
            onEdit={() => setEditing(cfg.type)}
            onSend={() => handleSend(cfg.type)}
          />
        ))}
      </div>

      {/* Template editor side drawer — reuses the existing
          EmailTemplateEditor exactly as-is; only the outer shell changed. */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col" side="right">
          {editing && (
            <>
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    {eventTitle}
                  </p>
                  <h2 className="text-xl font-medium tracking-tight">{labelFor(editing)} template</h2>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <EmailTemplateEditor
                  eventId={eventId}
                  emailType={editing}
                  onSave={() => {
                    toast.success('Template saved');
                  }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pt-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <p className="text-[11.5px] text-muted-foreground/80 mt-0.5 leading-snug">{subtitle}</p>
    </div>
  );
}

function MetricTile({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: 'primary' | 'ok' }) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-4 border-l-[3px]',
      tone === 'primary' ? 'border-l-primary' : 'border-l-reop-green',
    )}>
      <div className="text-[10.5px] uppercase tracking-[0.05em] font-semibold text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className={cn('text-[22px] sm:text-[24px] font-semibold leading-none -tracking-[0.02em]',
        tone === 'primary' ? 'text-primary' : 'text-reop-green',
      )}>
        {value}
      </div>
      <div className="text-[12px] mt-1.5 text-muted-foreground">{sub}</div>
    </div>
  );
}

function EmailCard({
  cfg, templateConfigured, sentInfo, sentLoading, sending, onEdit, onSend, wide,
}: {
  cfg: EmailCardConfig;
  templateConfigured: boolean;
  sentInfo?: { count: number; lastSent: string | null };
  sentLoading: boolean;
  sending: boolean;
  onEdit: () => void;
  onSend: () => void;
  wide?: boolean;
}) {
  const Icon = cfg.icon;
  const sentCount = sentInfo?.count ?? 0;

  return (
    <div className={cn(
      'bg-card border border-border rounded-xl p-4 flex flex-col gap-3',
      wide && 'md:col-span-1',
    )}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-reop-teal-soft text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <h4 className="text-sm font-semibold leading-tight">{cfg.label}</h4>
            <SendKindChip kind={cfg.sendKind} />
            {!templateConfigured && !sentLoading && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-2.5 h-2.5" />
                Default
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{cfg.description}</p>
        </div>
      </div>

      {/* Sent stat row */}
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        {sentLoading ? (
          <span>Loading…</span>
        ) : sentCount > 0 ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-reop-green" />
            <span className="text-foreground font-medium">Sent {sentCount}×</span>
            {sentInfo?.lastSent && (
              <span>· Last {format(parseISO(sentInfo.lastSent), 'MMM d, h:mm a')}</span>
            )}
          </>
        ) : (
          <>
            <Clock className="w-3.5 h-3.5" />
            <span>Not sent yet</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto">
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5 flex-1 sm:flex-initial">
          <Pencil className="w-3.5 h-3.5" />
          {templateConfigured ? 'Edit template' : 'Set up template'}
        </Button>
        {cfg.manualSendLabel && (
          <Button
            size="sm"
            onClick={onSend}
            disabled={sending}
            className="gap-1.5 flex-1 sm:flex-initial"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sending…' : cfg.manualSendLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function SendKindChip({ kind }: { kind: SendKind }) {
  if (kind === 'manual') {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
        Manual
      </span>
    );
  }
  if (kind === 'on_rsvp') {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
        On RSVP
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-reop-teal-soft text-primary border border-primary/30">
      Auto
    </span>
  );
}

function AutoFollowUpCard({ eventId }: { eventId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [followup1Days, setFollowup1Days] = useState(3);
  const [followup2Days, setFollowup2Days] = useState(7);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('events')
        .select('auto_followup_enabled, followup_1_days, followup_2_days')
        .eq('id', eventId)
        .single();
      if (cancelled) return;
      if (data) {
        setEnabled(data.auto_followup_enabled ?? false);
        setFollowup1Days(data.followup_1_days ?? 3);
        setFollowup2Days(data.followup_2_days ?? 7);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  const handleSave = async () => {
    if (followup2Days <= followup1Days) {
      toast.error('Follow-up #2 must be later than Follow-up #1.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          auto_followup_enabled: enabled,
          followup_1_days: followup1Days,
          followup_2_days: followup2Days,
        })
        .eq('id', eventId);
      if (error) throw error;
      toast.success('Auto follow-up settings saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-reop-teal-soft text-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-0.5">Auto follow-up scheduler</h3>
            <p className="text-xs text-muted-foreground leading-snug max-w-md">
              Automatically send follow-up #1 and follow-up #2 to contacts who haven't RSVPd yet. Cron runs daily 10am ET.
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} className="mt-1" />
      </div>

      {enabled && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fu1-days" className="text-xs text-muted-foreground mb-1.5 block">
                Follow-up #1 — days after invitation
              </Label>
              <Input
                id="fu1-days"
                type="number"
                min={1}
                max={30}
                value={followup1Days}
                onChange={(e) => setFollowup1Days(Number(e.target.value))}
                className="w-full sm:w-32"
              />
            </div>
            <div>
              <Label htmlFor="fu2-days" className="text-xs text-muted-foreground mb-1.5 block">
                Follow-up #2 — days after invitation
              </Label>
              <Input
                id="fu2-days"
                type="number"
                min={2}
                max={60}
                value={followup2Days}
                onChange={(e) => setFollowup2Days(Number(e.target.value))}
                className="w-full sm:w-32"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Templates for follow-up #1 and #2 must exist before the scheduler will send them.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 100);
}

function labelFor(type: EmailType): string {
  const map: Record<EmailType, string> = {
    invitation: 'Initial invitation',
    invitation_followup_1: 'Follow-up #1',
    invitation_followup_2: 'Follow-up #2',
    reminder_7day: '7 days before',
    reminder_1day: '1 day before',
    confirmation: 'RSVP confirmation',
    thank_you: 'Thank you',
    no_show: 'No-show follow-up',
  };
  return map[type];
}

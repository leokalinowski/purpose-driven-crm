import { Phone, MessageCircle, Notebook, Star, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  PrioritizedContact,
  PriorityTier,
  TIER_META,
  tierFor,
  useToggleWatchFlag,
} from '@/hooks/usePrioritizedContacts';

function stripPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function shortName(c: PrioritizedContact): string {
  const f = c.first_name?.trim() ?? '';
  const l = c.last_name?.trim() ?? '';
  const full = `${f} ${l}`.trim();
  return full || c.email || 'Unknown';
}

function ScoreBadge({ score, tier }: { score: number | null; tier: PriorityTier }) {
  const meta = TIER_META[tier];
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg px-2 py-1 min-w-[3rem]',
        meta.bg,
        meta.text,
      )}
      aria-label={`Priority score ${score ?? 'unscored'} (${meta.label})`}
    >
      <span className="text-lg md:text-xl font-bold leading-none">
        {score ?? '–'}
      </span>
      <span className="text-[10px] uppercase tracking-wider font-semibold mt-0.5">
        {meta.label}
      </span>
    </div>
  );
}

interface Props {
  contact: PrioritizedContact;
  onLog?: (c: PrioritizedContact) => void;
  onOpen?: (c: PrioritizedContact) => void;
}

export function PrioritizedContactCard({ contact, onLog, onOpen }: Props) {
  const tier = tierFor(contact.priority_score);
  const phone = contact.phone ? stripPhone(contact.phone) : '';
  const isDnc = !!contact.dnc;
  const lastTouch = contact.last_activity_date
    ? formatDistanceToNow(parseISO(contact.last_activity_date), { addSuffix: true })
    : 'never';
  const oppStage = contact.priority_signals?.active_opportunity_stage;
  const signals = contact.priority_signals?.ai_key_signals ?? [];

  const watchMutation = useToggleWatchFlag();

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-3 md:p-3.5',
        'hover:border-foreground/20 hover:shadow-sm transition-all duration-100',
        contact.priority_watch_flag && 'ring-1 ring-amber-300',
      )}
    >
      <div className="flex items-start gap-3">
        <ScoreBadge score={contact.priority_score} tier={tier} />

        <div className="min-w-0 flex-1">
          {/* Top row: name + watch flag */}
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => onOpen?.(contact)}
              className="font-semibold text-sm text-left truncate hover:underline"
            >
              {shortName(contact)}
            </button>
            <button
              type="button"
              onClick={() =>
                watchMutation.mutate({
                  contactId: contact.id,
                  next: !contact.priority_watch_flag,
                })
              }
              className={cn(
                'shrink-0 -my-1 p-1 rounded hover:bg-muted',
                contact.priority_watch_flag ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-amber-400',
              )}
              aria-label={contact.priority_watch_flag ? 'Unwatch' : 'Watch this contact'}
              title={contact.priority_watch_flag ? 'Unwatch' : 'Watch this contact'}
            >
              <Star className={cn('h-3.5 w-3.5', contact.priority_watch_flag && 'fill-amber-500')} />
            </button>
          </div>

          {/* Reasoning (Grok one-liner) */}
          {contact.priority_reasoning && (
            <div className="flex items-start gap-1 text-xs text-muted-foreground mb-1.5">
              <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-purple-500" />
              <span className="leading-snug">{contact.priority_reasoning}</span>
            </div>
          )}

          {/* Meta row: last touch + opp stage */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span>Last touch {lastTouch}</span>
            {oppStage && (
              <span className="capitalize">
                · {oppStage.replace(/_/g, ' ')}
              </span>
            )}
            {contact.category && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                {contact.category}
              </span>
            )}
          </div>

          {/* Signals chips */}
          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {signals.map((s, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/60">
        {phone && !isDnc && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-11 md:h-9 flex-1 gap-1.5 text-green-700 hover:text-green-900 hover:bg-green-50"
          >
            <a href={`tel:${phone}`} aria-label={`Call ${shortName(contact)}`}>
              <Phone className="h-4 w-4" />
              <span className="text-xs font-medium">Call</span>
            </a>
          </Button>
        )}
        {phone && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-11 md:h-9 flex-1 gap-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50"
          >
            <a href={`sms:${phone}`} aria-label={`Text ${shortName(contact)}`}>
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Text</span>
            </a>
          </Button>
        )}
        {onLog && (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 md:h-9 flex-1 gap-1.5"
            onClick={() => onLog(contact)}
          >
            <Notebook className="h-4 w-4" />
            <span className="text-xs font-medium">Log</span>
          </Button>
        )}
        {isDnc && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-red-600 font-medium ml-auto px-2">DNC</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Do Not Call list — phone actions hidden</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Component breakdown — small, audit trail for trust */}
      {contact.priority_components && (
        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground/70">
          <span title="Relationship health">R {contact.priority_components.relationship}</span>
          <span title="Pipeline momentum">P {contact.priority_components.pipeline}</span>
          <span title="AI intent">I {contact.priority_components.intent}</span>
          <span title="Agent flags">F {contact.priority_components.flags}</span>
          {contact.priority_computed_at && (
            <span className="ml-auto" title={contact.priority_computed_at}>
              · scored {formatDistanceToNow(parseISO(contact.priority_computed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

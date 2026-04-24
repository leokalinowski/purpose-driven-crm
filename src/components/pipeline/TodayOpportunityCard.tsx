import { Clock, AlertCircle, CheckCircle2, Phone, MessageCircle, Notebook, ArrowRight, DollarSign } from 'lucide-react';
import { TodayOpportunity, AttentionState } from '@/hooks/useToday';
import { pipelineTypeFromOpportunityType, OPPORTUNITY_TYPE_LABELS } from '@/config/pipelineStages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

function formatDue(dateStr: string | null): { label: string; overdue: boolean } {
  if (!dateStr) return { label: 'No due date', overdue: false };
  const d = parseISO(dateStr);
  const overdue = isPast(d) && !isToday(d);
  if (isToday(d)) return { label: 'Due today', overdue: false };
  if (isTomorrow(d)) return { label: 'Due tomorrow', overdue: false };
  if (overdue) return { label: `Overdue ${format(d, 'MMM d')}`, overdue: true };
  return { label: format(d, 'MMM d'), overdue: false };
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1000)}k`;
}

// Digits only — tel: / sms: are tolerant but cleaner this way
function stripPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

const ATTENTION_CONFIG: Record<AttentionState, { icon: React.ReactNode; label: string; dot: string }> = {
  overdue: { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Overdue', dot: 'bg-red-500' },
  no_next_step: { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'No next step', dot: 'bg-orange-500' },
  stale: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Going stale', dot: 'bg-yellow-500' },
  on_track: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'On track', dot: 'bg-green-500' },
};

const TYPE_COLORS: Record<string, string> = {
  buyer: 'bg-blue-100 text-blue-800',
  seller: 'bg-amber-100 text-amber-800',
  referral: 'bg-purple-100 text-purple-800',
};

interface Props {
  opportunity: TodayOpportunity;
  onOpen: (opp: TodayOpportunity) => void;
  onLog: (opp: TodayOpportunity) => void;
  onComplete: (opp: TodayOpportunity) => void;
}

export function TodayOpportunityCard({ opportunity: opp, onOpen, onLog, onComplete }: Props) {
  const pipelineType = (opp.pipeline_type ?? pipelineTypeFromOpportunityType(opp.opportunity_type ?? 'buyer')) as string;
  const attention = ATTENTION_CONFIG[opp.attention_state];
  const due = formatDue(opp.next_step_due_date);

  const leftBorder = {
    overdue: 'border-l-red-400',
    no_next_step: 'border-l-orange-400',
    stale: 'border-l-yellow-400',
    on_track: 'border-l-green-400',
  }[opp.attention_state];

  const phone = opp.contact?.phone ? stripPhone(opp.contact.phone) : '';
  const isDnc = !!opp.contact?.dnc;
  const hasDeal = opp.deal_value != null && opp.deal_value > 0;

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-3.5 border-l-4 cursor-pointer hover:shadow-sm transition-shadow',
        leftBorder
      )}
      onClick={() => onOpen(opp)}
    >
      {/* Top row: name + type badge + deal value */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-sm truncate block">{opp.contact_name}</span>
          <span className="text-xs text-muted-foreground">{opp.stage?.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasDeal && (
            <span className="flex items-center gap-0.5 text-sm font-semibold text-foreground">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              {formatMoney(opp.deal_value!)}
            </span>
          )}
          <Badge
            variant="outline"
            className={cn('text-xs capitalize border-0', TYPE_COLORS[pipelineType] ?? 'bg-slate-100 text-slate-700')}
          >
            {OPPORTUNITY_TYPE_LABELS[opp.opportunity_type ?? ''] ?? pipelineType}
          </Badge>
        </div>
      </div>

      {/* Next step */}
      <div className="mb-2.5">
        {opp.next_step_title ? (
          <p className="text-xs text-muted-foreground italic truncate">
            → {opp.next_step_title}
          </p>
        ) : (
          <p className="text-xs text-orange-600 font-medium">Set a next step</p>
        )}
      </div>

      {/* Bottom row: due date + actions */}
      <div
        className="flex items-center justify-between gap-2 flex-wrap"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full inline-block', attention.dot)} />
          {opp.next_step_due_date ? (
            <span className={cn('text-xs', due.overdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
              {due.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{attention.label}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {phone && !isDnc && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-11 w-11 md:h-8 md:w-8 text-green-700 hover:text-green-900 hover:bg-green-50"
              title="Call"
            >
              <a href={`tel:${phone}`} aria-label={`Call ${opp.contact_name}`}>
                <Phone className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </a>
            </Button>
          )}
          {phone && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-11 w-11 md:h-8 md:w-8 text-blue-700 hover:text-blue-900 hover:bg-blue-50"
              title="Text"
            >
              <a href={`sms:${phone}`} aria-label={`Text ${opp.contact_name}`}>
                <MessageCircle className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:h-8 md:w-8"
            title="Log activity"
            onClick={() => onLog(opp)}
            aria-label="Log activity"
          >
            <Notebook className="h-4 w-4 md:h-3.5 md:w-3.5" />
          </Button>
          {opp.next_step_title ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-11 md:h-8 px-3 md:px-2 text-xs gap-1 text-green-700 hover:text-green-900 hover:bg-green-50"
              onClick={() => onComplete(opp)}
            >
              <CheckCircle2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
              Complete
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-11 md:h-8 px-3 md:px-2 text-xs gap-1 text-orange-700 hover:text-orange-900 hover:bg-orange-50"
              onClick={() => onComplete(opp)}
            >
              <ArrowRight className="h-4 w-4 md:h-3.5 md:w-3.5" />
              Set next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

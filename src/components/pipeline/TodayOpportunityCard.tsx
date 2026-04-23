import { Clock, AlertCircle, CheckCircle2, Phone, MessageSquare, ArrowRight, CalendarClock } from 'lucide-react';
import { TodayOpportunity, AttentionState } from '@/hooks/useToday';
import { pipelineTypeFromOpportunityType, OPPORTUNITY_TYPE_LABELS } from '@/config/pipelineStages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

// Format due date nicely
function formatDue(dateStr: string | null): { label: string; overdue: boolean } {
  if (!dateStr) return { label: 'No due date', overdue: false };
  const d = parseISO(dateStr);
  const overdue = isPast(d) && !isToday(d);
  if (isToday(d)) return { label: 'Due today', overdue: false };
  if (isTomorrow(d)) return { label: 'Due tomorrow', overdue: false };
  if (overdue) return { label: `Overdue ${format(d, 'MMM d')}`, overdue: true };
  return { label: format(d, 'MMM d'), overdue: false };
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

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-3.5 border-l-4 cursor-pointer hover:shadow-sm transition-shadow',
        leftBorder
      )}
      onClick={() => onOpen(opp)}
    >
      {/* Top row: name + type badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="font-semibold text-sm truncate block">{opp.contact_name}</span>
          <span className="text-xs text-muted-foreground">{opp.stage?.replace(/_/g, ' ')}</span>
        </div>
        <Badge
          variant="outline"
          className={cn('text-xs shrink-0 capitalize border-0', TYPE_COLORS[pipelineType] ?? 'bg-slate-100 text-slate-700')}
        >
          {OPPORTUNITY_TYPE_LABELS[opp.opportunity_type ?? ''] ?? pipelineType}
        </Badge>
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
      <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          {/* Attention dot */}
          <span className={cn('h-2 w-2 rounded-full inline-block', attention.dot)} />
          {opp.next_step_due_date ? (
            <span className={cn('text-xs', due.overdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
              {due.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{attention.label}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Log activity"
            onClick={() => onLog(opp)}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          {opp.next_step_title ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-green-700 hover:text-green-900 hover:bg-green-50"
              onClick={() => onComplete(opp)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-orange-700 hover:text-orange-900 hover:bg-orange-50"
              onClick={() => onComplete(opp)}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Set next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

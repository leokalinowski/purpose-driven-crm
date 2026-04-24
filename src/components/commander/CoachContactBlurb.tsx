import { Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCoachingState, ALERT_META } from '@/hooks/useCoachingState';

/**
 * CoachContactBlurb — embedded in contact + opportunity detail drawers.
 * Shows the Coach's current take on THIS specific contact/opportunity:
 *   • Any today_list item for this contact (Coach's action + reasoning + opener)
 *   • Any alerts scoped to this contact_id or opportunity_id
 *
 * Pure read. No mutations. If the Coach has nothing to say, renders nothing.
 */

interface Props {
  contactId?: string | null;
  opportunityId?: string | null;
  className?: string;
}

export function CoachContactBlurb({ contactId, opportunityId, className }: Props) {
  const { state } = useCoachingState();

  if (!state || (!contactId && !opportunityId)) return null;

  const todayItem = state.today_list.find(it =>
    (contactId && it.contact_id === contactId) ||
    (opportunityId && it.opportunity_id === opportunityId)
  );
  const isNextHour = state.next_hour
    && ((contactId && state.next_hour.contact_id === contactId)
      || (opportunityId && state.next_hour.opportunity_id === opportunityId));
  const scopedAlerts = state.alerts.filter(a =>
    (contactId && a.contact_id === contactId) ||
    (opportunityId && a.opportunity_id === opportunityId)
  );

  if (!todayItem && !isNextHour && scopedAlerts.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/60 to-transparent p-3.5 space-y-2',
      className,
    )}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-purple-700">
        <Sparkles className="h-3 w-3" />
        {isNextHour ? 'Coach — your next hour' : 'Coach — this relationship'}
      </div>

      {state.next_hour && isNextHour && (
        <>
          <p className="text-sm leading-snug">{state.next_hour.reasoning}</p>
          <div className="rounded-lg bg-white/70 border border-border p-2.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              Opener
            </div>
            <p className="text-sm italic leading-relaxed">"{state.next_hour.first_sentence}"</p>
          </div>
        </>
      )}

      {todayItem && !isNextHour && (
        <p className="text-sm leading-snug">{todayItem.reasoning}</p>
      )}

      {scopedAlerts.length > 0 && (
        <ul className="space-y-1 pt-1">
          {scopedAlerts.map((a, i) => {
            const meta = ALERT_META[a.level];
            return (
              <li key={i} className="flex items-start gap-1.5 text-xs leading-snug">
                <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 shrink-0', meta.dot)} />
                <span className={meta.text}>{a.message}</span>
              </li>
            );
          })}
        </ul>
      )}

      {!todayItem && !isNextHour && scopedAlerts.length === 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Nothing flagged right now.
        </p>
      )}
    </div>
  );
}

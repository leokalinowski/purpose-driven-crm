import { Phone, MessageCircle, Notebook, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TodayItem, tierFor } from '@/hooks/useCoachingState';

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  urgent:   { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Urgent' },
  hot:      { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Hot' },
  warm:     { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Warm' },
  cool:     { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Cool' },
  cold:     { bg: 'bg-slate-50',  text: 'text-slate-700',  label: 'Cold' },
  unscored: { bg: 'bg-muted/40',  text: 'text-muted-foreground', label: '—' },
};

interface ActionCardProps {
  item: TodayItem;
  onCall?: (item: TodayItem) => void;
  onText?: (item: TodayItem) => void;
  onLog?: (item: TodayItem) => void;
  onDismiss?: (item: TodayItem) => void;
  showCoachBadge?: boolean;
}

export function ActionCard({ item, onCall, onText, onLog, onDismiss, showCoachBadge }: ActionCardProps) {
  const tier = tierFor(item.priority_score);
  const tierColor = TIER_COLORS[tier];

  return (
    <div className="rounded-xl border border-border bg-card hover:shadow-sm transition-shadow p-4 md:p-4.5">
      {/* Top row: name + priority + Coach badge */}
      <div className="flex items-start gap-3 mb-2">
        {/* Priority pill */}
        <div className={cn(
          'flex flex-col items-center justify-center rounded-lg px-2 py-1 min-w-[2.75rem] shrink-0',
          tierColor.bg, tierColor.text,
        )}>
          <span className="text-base font-bold leading-none">
            {item.priority_score ?? '–'}
          </span>
          <span className="text-[9px] uppercase tracking-wider font-semibold mt-0.5">
            {tierColor.label}
          </span>
        </div>

        {/* Name + coach tag */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-semibold text-sm truncate">{item.contact_name}</span>
            {showCoachBadge && (
              <Sparkles className="h-3 w-3 text-purple-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
            {item.reasoning}
          </p>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(item)}
            className="shrink-0 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Dismiss Coach suggestion"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-3 border-t border-border/60">
        {item.quick_actions.includes('call') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 md:h-8 flex-1 gap-1.5 text-green-700 hover:text-green-900 hover:bg-green-50"
            onClick={() => onCall?.(item)}
          >
            <Phone className="h-4 w-4" />
            <span className="text-xs font-medium">Call</span>
          </Button>
        )}
        {item.quick_actions.includes('text') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 md:h-8 flex-1 gap-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50"
            onClick={() => onText?.(item)}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Text</span>
          </Button>
        )}
        {item.quick_actions.includes('log') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 md:h-8 flex-1 gap-1.5"
            onClick={() => onLog?.(item)}
          >
            <Notebook className="h-4 w-4" />
            <span className="text-xs font-medium">Log</span>
          </Button>
        )}
      </div>
    </div>
  );
}
